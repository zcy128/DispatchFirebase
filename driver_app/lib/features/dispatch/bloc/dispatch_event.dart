import 'package:equatable/equatable.dart';
import '../models/dispatch_model.dart';

abstract class DispatchEvent extends Equatable {
  const DispatchEvent();

  @override
  List<Object?> get props => [];
}

class LoadDispatchesForDate extends DispatchEvent {
  final DateTime date;
  final String? driverId;

  const LoadDispatchesForDate(this.date, {this.driverId});

  @override
  List<Object?> get props => [date, driverId];
}

class SelectDispatch extends DispatchEvent {
  final String dispatchId;

  const SelectDispatch(this.dispatchId);

  @override
  List<Object?> get props => [dispatchId];
}

class DriverCheckInEvent extends DispatchEvent {
  final String dispatchId;

  const DriverCheckInEvent(this.dispatchId);

  @override
  List<Object?> get props => [dispatchId];
}

class DriverCheckOutEvent extends DispatchEvent {
  final String dispatchId;
  final String? payrollComments;

  const DriverCheckOutEvent(this.dispatchId, {this.payrollComments});

  @override
  List<Object?> get props => [dispatchId, payrollComments];
}

class RecordStopArrivalEvent extends DispatchEvent {
  final String dispatchId;
  final int stopId;

  const RecordStopArrivalEvent({
    required this.dispatchId,
    required this.stopId,
  });

  @override
  List<Object?> get props => [dispatchId, stopId];
}

class UpdateStudentAttendanceEvent extends DispatchEvent {
  final String dispatchId;
  final int stopId;
  final int studentId;
  final String newPickupStatus;
  final String? newDropoffStatus;

  const UpdateStudentAttendanceEvent({
    required this.dispatchId,
    required this.stopId,
    required this.studentId,
    required this.newPickupStatus,
    this.newDropoffStatus,
  });

  @override
  List<Object?> get props => [
        dispatchId,
        stopId,
        studentId,
        newPickupStatus,
        newDropoffStatus,
      ];
}

class BatchSchoolActionEvent extends DispatchEvent {
  final String dispatchId;
  final int stopId;
  final String actionType; // 'dropoff_all' | 'pickup_all'

  const BatchSchoolActionEvent({
    required this.dispatchId,
    required this.stopId,
    required this.actionType,
  });

  @override
  List<Object?> get props => [dispatchId, stopId, actionType];
}

class AutoSyncDispatchesEvent extends DispatchEvent {
  const AutoSyncDispatchesEvent();
}

class FirestoreDispatchesUpdatedEvent extends DispatchEvent {
  final List<DispatchRecord> dispatches;

  const FirestoreDispatchesUpdatedEvent(this.dispatches);

  @override
  List<Object?> get props => [dispatches];
}
