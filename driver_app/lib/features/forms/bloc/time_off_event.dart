import 'package:equatable/equatable.dart';
import '../models/time_off_model.dart';

abstract class TimeOffEvent extends Equatable {
  const TimeOffEvent();

  @override
  List<Object?> get props => [];
}

/// Loads and begins streaming time-off requests for an employee.
class LoadTimeOffRequestsEvent extends TimeOffEvent {
  final String employeeId;

  const LoadTimeOffRequestsEvent(this.employeeId);

  @override
  List<Object?> get props => [employeeId];
}

/// Event triggered when Firestore emits updated snapshot of time-off requests.
class FirestoreTimeOffUpdatedEvent extends TimeOffEvent {
  final List<TimeOffRequestModel> requests;

  const FirestoreTimeOffUpdatedEvent(this.requests);

  @override
  List<Object?> get props => [requests];
}

/// Filters the loaded requests by status (null for all).
class FilterTimeOffStatusEvent extends TimeOffEvent {
  final TimeOffStatus? status;

  const FilterTimeOffStatusEvent(this.status);

  @override
  List<Object?> get props => [status];
}

/// Submits a new time-off request.
class CreateTimeOffRequestEvent extends TimeOffEvent {
  final TimeOffRequestModel request;

  const CreateTimeOffRequestEvent(this.request);

  @override
  List<Object?> get props => [request];
}

/// Cancels an existing time-off request.
class CancelTimeOffRequestEvent extends TimeOffEvent {
  final String requestId;

  const CancelTimeOffRequestEvent(this.requestId);

  @override
  List<Object?> get props => [requestId];
}
