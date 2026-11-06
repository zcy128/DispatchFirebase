import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../dispatch_progress.dart';
import '../models/dispatch_model.dart';
import '../repository/dispatch_repository.dart';
import 'dispatch_event.dart';
import 'dispatch_state.dart';

class DispatchBloc extends Bloc<DispatchEvent, DispatchState> {
  final DispatchRepository repository;
  final Future<bool> Function(String vehicleUnit, String date)? isVehicleInspected;
  final Future<String?> Function(String vehicleUnit, String date)?
      inspectionBlockReason;
  String? _currentDriverId;
  Timer? _autoSyncTimer;
  StreamSubscription<List<DispatchRecord>>? _dispatchesStreamSubscription;
  int _epoch = 0;

  DispatchBloc({
    required this.repository,
    this.isVehicleInspected,
    this.inspectionBlockReason,
  }) : super(DispatchInitial()) {
    on<LoadDispatchesForDate>(_onLoadDispatchesForDate);
    on<FirestoreDispatchesUpdatedEvent>(_onFirestoreDispatchesUpdated);
    on<AutoSyncDispatchesEvent>(_onAutoSyncDispatches);
    on<SetDispatchSyncActive>(_onSetDispatchSyncActive);
    on<SelectDispatch>(_onSelectDispatch);
    on<DriverCheckInEvent>(_onDriverCheckIn);
    on<DriverCheckOutEvent>(_onDriverCheckOut);
    on<RecordStopArrivalEvent>(_onRecordStopArrival);
    on<UpdateStudentAttendanceEvent>(_onUpdateStudentAttendance);
    on<BatchSchoolActionEvent>(_onBatchSchoolAction);
  }

  void startAutoSync({Duration interval = const Duration(seconds: 4)}) {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = Timer.periodic(interval, (_) {
      if (!isClosed && state is DispatchLoaded) {
        add(const AutoSyncDispatchesEvent());
      }
    });
  }

  void stopAutoSync() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = null;
  }

  void _onSetDispatchSyncActive(
    SetDispatchSyncActive event,
    Emitter<DispatchState> emit,
  ) {
    if (event.active) {
      startAutoSync();
      if (state is DispatchLoaded) {
        add(const AutoSyncDispatchesEvent());
      }
    } else {
      stopAutoSync();
    }
  }

  DispatchLoaded? _loadedFrom(List<DispatchRecord> records, DispatchLoaded base) {
    DispatchRecord? updatedActive;
    if (base.activeDispatch != null) {
      for (final record in records) {
        if (record.id == base.activeDispatch!.id) {
          updatedActive = record;
          break;
        }
      }
      updatedActive ??= records.isEmpty ? null : records.first;
    } else if (records.isNotEmpty) {
      updatedActive = records.first;
    }

    final updatedReadOnly = !base.isToday || (updatedActive?.isCheckedOut ?? false);
    return base.copyWith(
      dispatches: records,
      activeDispatch: updatedActive,
      clearActiveDispatch: updatedActive == null,
      isReadOnly: updatedReadOnly,
      clearMessages: false,
    );
  }

  @override
  Future<void> close() {
    stopAutoSync();
    _dispatchesStreamSubscription?.cancel();
    return super.close();
  }

  Future<void> _onLoadDispatchesForDate(
    LoadDispatchesForDate event,
    Emitter<DispatchState> emit,
  ) async {
    final epoch = ++_epoch;
    if (state is! DispatchLoaded) {
      emit(DispatchLoading());
    }

    if (event.driverId != null) {
      _currentDriverId = event.driverId;
    }

    final targetDate = DispatchRepository.normalizeDate(event.date);

    try {
      if (!repository.isWithinAllowedWindow(targetDate)) {
        emit(const DispatchError('Selected date is outside the permitted 2-week dispatch window.'));
        return;
      }

      final isToday = repository.isToday(targetDate);
      final cached = repository.getDispatchesForDate(targetDate, driverId: _currentDriverId);
      final active = cached.isEmpty ? null : cached.first;
      final isReadOnly = !isToday || (active?.isCheckedOut ?? false);

      if (epoch != _epoch) return;

      emit(DispatchLoaded(
        selectedDate: targetDate,
        isToday: isToday,
        isReadOnly: isReadOnly,
        dispatches: cached,
        activeDispatch: active,
      ));

      await _dispatchesStreamSubscription?.cancel();
      _dispatchesStreamSubscription = repository
          .watchDispatchesForDate(targetDate, driverId: _currentDriverId)
          .listen((updatedDispatches) {
        if (isClosed) return;
        if (updatedDispatches.isEmpty && !repository.isFirestoreAvailable) return;
        add(FirestoreDispatchesUpdatedEvent(updatedDispatches, epoch: _epoch));
      });

      final synced = await repository.syncDispatchesFromBackend(
        targetDate,
        driverId: _currentDriverId,
        trustServer: true,
      );
      if (epoch != _epoch || emit.isDone || state is! DispatchLoaded) return;
      final loaded = _loadedFrom(synced, state as DispatchLoaded);
      if (loaded != null) emit(loaded);
    } finally {
      final ready = event.ready;
      if (ready != null && !ready.isCompleted) {
        ready.complete();
      }
    }
  }

  void _onFirestoreDispatchesUpdated(
    FirestoreDispatchesUpdatedEvent event,
    Emitter<DispatchState> emit,
  ) {
    if (event.epoch != 0 && event.epoch != _epoch) return;
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;
    final merged = mergeRemoteDispatches(
      local: currentState.dispatches,
      remote: event.dispatches,
      trustServer: false,
    );
    final loaded = _loadedFrom(merged, currentState);
    if (loaded != null) emit(loaded);
  }

  Future<void> _onAutoSyncDispatches(
    AutoSyncDispatchesEvent event,
    Emitter<DispatchState> emit,
  ) async {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;
    final epoch = _epoch;

    try {
      final synced = await repository.syncDispatchesFromBackend(
        currentState.selectedDate,
        driverId: _currentDriverId,
      );
      if (epoch != _epoch || emit.isDone || state is! DispatchLoaded) return;
      final merged = mergeRemoteDispatches(
        local: (state as DispatchLoaded).dispatches,
        remote: synced,
        trustServer: false,
      );
      final loaded = _loadedFrom(merged, state as DispatchLoaded);
      if (loaded != null) emit(loaded);
    } catch (_) {
      // Quiet background polling ignores network disconnects
    }
  }

  void _onSelectDispatch(
    SelectDispatch event,
    Emitter<DispatchState> emit,
  ) {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;

    final match = currentState.dispatches.firstWhere(
      (d) => d.id == event.dispatchId,
      orElse: () => currentState.dispatches.first,
    );

    final isReadOnly = !currentState.isToday || match.isCheckedOut;

    emit(currentState.copyWith(
      activeDispatch: match,
      isReadOnly: isReadOnly,
      clearMessages: true,
    ));
  }

  Future<void> _onDriverCheckIn(
    DriverCheckInEvent event,
    Emitter<DispatchState> emit,
  ) async {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;

    if (!currentState.isToday) {
      emit(currentState.copyWith(
        errorMessage: 'Check-in is only permitted for today\'s scheduled run.',
      ));
      return;
    }

    DispatchRecord? target;
    for (final record in currentState.dispatches) {
      if (record.id == event.dispatchId) {
        target = record;
        break;
      }
    }
    target ??= currentState.activeDispatch?.id == event.dispatchId ? currentState.activeDispatch : null;
    if (target == null) {
      emit(currentState.copyWith(errorMessage: 'Dispatch record not found.'));
      return;
    }

    final blocked = await _checkInBlockReason(target);
    if (blocked != null) {
      if (state is DispatchLoaded) {
        emit((state as DispatchLoaded).copyWith(errorMessage: blocked));
      }
      return;
    }

    _epoch++;
    try {
      final updated = await repository.checkInDriver(event.dispatchId);
      _epoch++;
      if (emit.isDone || state is! DispatchLoaded) return;
      final base = state as DispatchLoaded;
      if (!repository.isToday(base.selectedDate) || base.selectedDate != currentState.selectedDate) return;
      final dispatches = repository.getDispatchesForDate(base.selectedDate, driverId: _currentDriverId);

      emit(base.copyWith(
        dispatches: dispatches,
        activeDispatch: updated,
        isReadOnly: false,
        actionFeedback: 'Driver Check-In confirmed at ${updated.checkInTime}. Safe driving!',
        clearMessages: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(errorMessage: e.toString()));
    }
  }

  Future<void> _onDriverCheckOut(
    DriverCheckOutEvent event,
    Emitter<DispatchState> emit,
  ) async {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;

    if (!currentState.isToday) {
      emit(currentState.copyWith(
        errorMessage: 'Check-out is only permitted for today\'s run.',
      ));
      return;
    }

    _epoch++;
    try {
      final updated = await repository.checkOutDriver(
        event.dispatchId,
        payrollComments: event.payrollComments,
      );
      _epoch++;
      final dispatches = repository.getDispatchesForDate(currentState.selectedDate, driverId: _currentDriverId);

      emit(currentState.copyWith(
        dispatches: dispatches,
        activeDispatch: updated,
        isReadOnly: true, // Locked once checked out!
        actionFeedback: event.payrollComments != null && event.payrollComments!.trim().isNotEmpty
            ? 'Driver Check-Out confirmed at ${updated.checkOutTime}. Shift locked with payroll dispute comments submitted for Dispatcher Review.'
            : 'Driver Check-Out confirmed at ${updated.checkOutTime}. Shift finalized and locked.',
        clearMessages: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(errorMessage: e.toString()));
    }
  }

  Future<void> _onRecordStopArrival(
    RecordStopArrivalEvent event,
    Emitter<DispatchState> emit,
  ) async {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;

    if (currentState.isReadOnly) {
      emit(currentState.copyWith(
        errorMessage: 'Cannot modify stop arrival in read-only mode.',
      ));
      return;
    }

    _epoch++;
    try {
      final updated = await repository.recordStopArrival(event.dispatchId, event.stopId);
      _epoch++;
      final dispatches = repository.getDispatchesForDate(currentState.selectedDate, driverId: _currentDriverId);

      emit(currentState.copyWith(
        dispatches: dispatches,
        activeDispatch: updated,
        actionFeedback: 'Arrival registered at stop #${event.stopId}.',
        clearMessages: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(errorMessage: e.toString()));
    }
  }

  Future<void> _onUpdateStudentAttendance(
    UpdateStudentAttendanceEvent event,
    Emitter<DispatchState> emit,
  ) async {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;

    if (currentState.isReadOnly) {
      emit(currentState.copyWith(
        errorMessage: 'Attendance records are read-only for this date or finalized shift.',
      ));
      return;
    }

    _epoch++;
    try {
      final updated = await repository.updateStudentAttendance(
        dispatchId: event.dispatchId,
        stopId: event.stopId,
        studentId: event.studentId,
        newPickupStatus: event.newPickupStatus,
        newDropoffStatus: event.newDropoffStatus,
      );

      _epoch++;
      final dispatches = repository.getDispatchesForDate(currentState.selectedDate, driverId: _currentDriverId);

      emit(currentState.copyWith(
        dispatches: dispatches,
        activeDispatch: updated,
        clearMessages: true,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        errorMessage: e.toString().replaceFirst('StateError: ', ''),
      ));
    }
  }

  Future<void> _onBatchSchoolAction(
    BatchSchoolActionEvent event,
    Emitter<DispatchState> emit,
  ) async {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;

    if (currentState.isReadOnly) {
      emit(currentState.copyWith(
        errorMessage: 'Batch operations are not permitted in read-only mode.',
      ));
      return;
    }

    _epoch++;
    try {
      final updated = await repository.batchSchoolAction(
        dispatchId: event.dispatchId,
        stopId: event.stopId,
        actionType: event.actionType,
      );

      _epoch++;
      final dispatches = repository.getDispatchesForDate(currentState.selectedDate, driverId: _currentDriverId);
      final feedback = event.actionType == 'dropoff_all'
          ? 'All aboard students dropped off at school.'
          : 'All present students picked up from school.';

      emit(currentState.copyWith(
        dispatches: dispatches,
        activeDispatch: updated,
        actionFeedback: feedback,
        clearMessages: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        errorMessage: e.toString().replaceFirst('StateError: ', ''),
      ));
    }
  }

  Future<String?> _checkInBlockReason(DispatchRecord record) async {
    final String? hold;
    try {
      hold = await repository.vehicleServiceHold(record.vehicleUnit);
    } on DispatchRejected catch (error) {
      return error.message;
    }
    if (hold != null) return hold;

    final unit = record.vehicleUnit.trim();
    if (unit.isEmpty) {
      return 'Check-in is blocked because this run has no bus assigned.';
    }
    final date = DispatchRepository.formatDate(DateTime.now());
    if (inspectionBlockReason != null) {
      final reason = await inspectionBlockReason!.call(unit, date);
      if (reason != null && reason.isNotEmpty) return reason;
      return null;
    }
    final inspected = await isVehicleInspected?.call(unit, date);
    if (inspected != true) {
      return 'Check-in is blocked until the Schedule 5 pre-trip inspection is complete for bus $unit.';
    }
    return null;
  }
}
