import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/time_off_model.dart';
import '../repository/time_off_repository.dart';
import 'time_off_event.dart';
import 'time_off_state.dart';

class TimeOffBloc extends Bloc<TimeOffEvent, TimeOffState> {
  final TimeOffRepository repository;
  StreamSubscription<List<TimeOffRequestModel>>? _streamSubscription;
  TimeOffStatus? _currentFilter;

  TimeOffBloc({required this.repository}) : super(const TimeOffInitial()) {
    on<LoadTimeOffRequestsEvent>(_onLoadTimeOffRequests);
    on<FirestoreTimeOffUpdatedEvent>(_onFirestoreTimeOffUpdated);
    on<FilterTimeOffStatusEvent>(_onFilterTimeOffStatus);
    on<CreateTimeOffRequestEvent>(_onCreateTimeOffRequest);
    on<CancelTimeOffRequestEvent>(_onCancelTimeOffRequest);
  }

  Future<void> _onLoadTimeOffRequests(
    LoadTimeOffRequestsEvent event,
    Emitter<TimeOffState> emit,
  ) async {
    emit(const TimeOffLoading());

    // 1. Initial cached load
    final cached = repository.getTimeOffRequests(employeeId: event.employeeId);
    _currentFilter = null;
    emit(TimeOffLoaded(
      requests: cached,
      allRequests: cached,
      statusFilter: null,
    ));

    // 2. Cancel prior stream if any and subscribe to live stream
    await _streamSubscription?.cancel();
    _streamSubscription = repository
        .watchTimeOffRequests(event.employeeId)
        .listen((updatedList) {
      add(FirestoreTimeOffUpdatedEvent(updatedList));
    });
  }

  void _onFirestoreTimeOffUpdated(
    FirestoreTimeOffUpdatedEvent event,
    Emitter<TimeOffState> emit,
  ) {
    final all = event.requests;
    final filtered = _applyFilter(all, _currentFilter);

    if (state is TimeOffLoaded) {
      final current = state as TimeOffLoaded;
      emit(current.copyWith(
        requests: filtered,
        allRequests: all,
        statusFilter: () => _currentFilter,
      ));
    } else {
      emit(TimeOffLoaded(
        requests: filtered,
        allRequests: all,
        statusFilter: _currentFilter,
      ));
    }
  }

  void _onFilterTimeOffStatus(
    FilterTimeOffStatusEvent event,
    Emitter<TimeOffState> emit,
  ) {
    if (state is! TimeOffLoaded) return;
    final current = state as TimeOffLoaded;
    _currentFilter = event.status;
    final filtered = _applyFilter(current.allRequests, _currentFilter);

    emit(current.copyWith(
      requests: filtered,
      statusFilter: () => _currentFilter,
    ));
  }

  Future<void> _onCreateTimeOffRequest(
    CreateTimeOffRequestEvent event,
    Emitter<TimeOffState> emit,
  ) async {
    if (state is! TimeOffLoaded) return;
    final current = state as TimeOffLoaded;

    emit(current.copyWith(isSubmitting: true, errorMessage: () => null, successMessage: () => null));

    try {
      final created = await repository.createTimeOffRequest(event.request);
      final updatedAll = [created, ...current.allRequests.where((r) => r.id != created.id)];
      final filtered = _applyFilter(updatedAll, _currentFilter);

      emit(current.copyWith(
        requests: filtered,
        allRequests: updatedAll,
        isSubmitting: false,
        successMessage: () => 'Leave request submitted successfully.',
      ));
    } catch (e) {
      emit(current.copyWith(
        isSubmitting: false,
        errorMessage: () => 'Failed to submit request: $e',
      ));
    }
  }

  Future<void> _onCancelTimeOffRequest(
    CancelTimeOffRequestEvent event,
    Emitter<TimeOffState> emit,
  ) async {
    if (state is! TimeOffLoaded) return;
    final current = state as TimeOffLoaded;

    try {
      final cancelled = await repository.cancelTimeOffRequest(event.requestId);
      final updatedAll = current.allRequests.map((r) => r.id == cancelled.id ? cancelled : r).toList();
      final filtered = _applyFilter(updatedAll, _currentFilter);

      emit(current.copyWith(
        requests: filtered,
        allRequests: updatedAll,
        successMessage: () => 'Request cancelled.',
      ));
    } catch (e) {
      emit(current.copyWith(
        errorMessage: () => 'Failed to cancel request: $e',
      ));
    }
  }

  List<TimeOffRequestModel> _applyFilter(
    List<TimeOffRequestModel> list,
    TimeOffStatus? filter,
  ) {
    if (filter == null) return list;
    return list.where((r) => r.status == filter).toList();
  }

  @override
  Future<void> close() {
    _streamSubscription?.cancel();
    return super.close();
  }
}
