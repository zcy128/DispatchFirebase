import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/dispatch_model.dart';
import '../repository/dispatch_repository.dart';
import 'dispatch_event.dart';
import 'dispatch_state.dart';

class DispatchBloc extends Bloc<DispatchEvent, DispatchState> {
  final DispatchRepository repository;
  String? _currentDriverId;
  Timer? _autoSyncTimer;
  StreamSubscription<List<DispatchRecord>>? _dispatchesStreamSubscription;

  DispatchBloc({required this.repository}) : super(DispatchInitial()) {
    on<LoadDispatchesForDate>(_onLoadDispatchesForDate);
    on<FirestoreDispatchesUpdatedEvent>(_onFirestoreDispatchesUpdated);
    on<AutoSyncDispatchesEvent>(_onAutoSyncDispatches);
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
    emit(DispatchLoading());

    if (event.driverId != null) {
      _currentDriverId = event.driverId;
    }

    final targetDate = DispatchRepository.normalizeDate(event.date);

    if (!repository.isWithinAllowedWindow(targetDate)) {
      emit(const DispatchError('Selected date is outside the permitted 2-week dispatch window.'));
      return;
    }

    final isToday = repository.isToday(targetDate);
    final cached = repository.getDispatchesForDate(targetDate, driverId: _currentDriverId);

    DispatchRecord? active;
    if (cached.isNotEmpty) {
      active = cached.first;
    }

    final isReadOnly = !isToday || (active?.isCheckedOut ?? false);

    emit(DispatchLoaded(
      selectedDate: targetDate,
      isToday: isToday,
      isReadOnly: isReadOnly,
      dispatches: cached,
      activeDispatch: active,
    ));

    // Cancel existing Firestore stream and attach native real-time stream listener
    await _dispatchesStreamSubscription?.cancel();
    _dispatchesStreamSubscription = repository
        .watchDispatchesForDate(targetDate, driverId: _currentDriverId)
        .listen((updatedDispatches) {
      if (!isClosed && updatedDispatches.isNotEmpty) {
        add(FirestoreDispatchesUpdatedEvent(updatedDispatches));
      }
    });

    // Hydrate initially from backend API
    try {
      final synced = await repository.syncDispatchesFromBackend(
        targetDate,
        driverId: _currentDriverId,
      );
      if (synced.isNotEmpty && !emit.isDone) {
        DispatchRecord? updatedActive;
        if (active != null) {
          updatedActive = synced.firstWhere(
            (d) => d.id == active!.id,
            orElse: () => synced.first,
          );
        } else {
          updatedActive = synced.first;
        }

        final updatedReadOnly = !isToday || updatedActive.isCheckedOut;

        emit(DispatchLoaded(
          selectedDate: targetDate,
          isToday: isToday,
          isReadOnly: updatedReadOnly,
          dispatches: synced,
          activeDispatch: updatedActive,
        ));
      }
    } catch (_) {
      // Offline fallback: cached and stream continue
    }
  }

  void _onFirestoreDispatchesUpdated(
    FirestoreDispatchesUpdatedEvent event,
    Emitter<DispatchState> emit,
  ) {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;
    final synced = event.dispatches;

    if (synced.isEmpty) return;

    DispatchRecord? updatedActive;
    if (currentState.activeDispatch != null) {
      updatedActive = synced.firstWhere(
        (d) => d.id == currentState.activeDispatch!.id,
        orElse: () => synced.first,
      );
    } else {
      updatedActive = synced.first;
    }

    final updatedReadOnly = !currentState.isToday || updatedActive.isCheckedOut;

    emit(currentState.copyWith(
      dispatches: synced,
      activeDispatch: updatedActive,
      isReadOnly: updatedReadOnly,
      clearMessages: false,
    ));
  }

  Future<void> _onAutoSyncDispatches(
    AutoSyncDispatchesEvent event,
    Emitter<DispatchState> emit,
  ) async {
    if (state is! DispatchLoaded) return;
    final currentState = state as DispatchLoaded;

    try {
      final synced = await repository.syncDispatchesFromBackend(
        currentState.selectedDate,
        driverId: _currentDriverId,
      );

      if (synced.isEmpty || emit.isDone) return;

      DispatchRecord? updatedActive;
      if (currentState.activeDispatch != null) {
        updatedActive = synced.firstWhere(
          (d) => d.id == currentState.activeDispatch!.id,
          orElse: () => synced.first,
        );
      } else {
        updatedActive = synced.first;
      }

      final updatedReadOnly = !currentState.isToday || updatedActive.isCheckedOut;

      emit(currentState.copyWith(
        dispatches: synced,
        activeDispatch: updatedActive,
        isReadOnly: updatedReadOnly,
        clearMessages: false,
      ));
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

    try {
      final updated = await repository.checkInDriver(event.dispatchId);
      final dispatches = repository.getDispatchesForDate(currentState.selectedDate, driverId: _currentDriverId);

      emit(currentState.copyWith(
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

    try {
      final updated = await repository.checkOutDriver(
        event.dispatchId,
        payrollComments: event.payrollComments,
      );
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

    try {
      final updated = await repository.recordStopArrival(event.dispatchId, event.stopId);
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

    try {
      final updated = await repository.updateStudentAttendance(
        dispatchId: event.dispatchId,
        stopId: event.stopId,
        studentId: event.studentId,
        newPickupStatus: event.newPickupStatus,
        newDropoffStatus: event.newDropoffStatus,
      );

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

    try {
      final updated = await repository.batchSchoolAction(
        dispatchId: event.dispatchId,
        stopId: event.stopId,
        actionType: event.actionType,
      );

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
}
