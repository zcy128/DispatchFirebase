import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/dispatch/bloc/dispatch_state.dart';
import 'package:driver_app/features/dispatch/dispatch_progress.dart';
import 'package:driver_app/features/dispatch/models/dispatch_model.dart';

DispatchRecord _record({
  String status = 'scheduled',
  String? checkInTime,
  String? checkOutTime,
  bool arrived = false,
  String pickup = 'pending',
}) {
  return DispatchRecord(
    id: 'DISP-1',
    date: '2026-11-05',
    routeId: 'RT-1',
    routeNo: 'R1',
    routeName: 'Route 1',
    shiftType: 'AM',
    driverId: 'EMP-2001',
    driverName: 'Driver',
    vehicleUnit: '1001',
    status: status,
    checkInTime: checkInTime,
    checkOutTime: checkOutTime,
    stops: [
      DispatchStop(
        stopId: 1,
        sequence: 1,
        stopLocation: 'Home',
        stopType: 'home_pickup',
        isSchoolStop: false,
        plannedTime: '07:30 AM',
        isArrived: arrived,
        arrivedTime: arrived ? '07:31 AM' : null,
        students: [
          StudentAttendance(
            studentId: 101,
            studentNo: 'S101',
            studentName: 'A Student',
            grade: '3',
            homeAddress: '1 Main',
            schoolName: 'School',
            pickupStatus: pickup,
            pickupTime: pickup == 'picked_up' ? '07:32 AM' : null,
          ),
        ],
      ),
    ],
  );
}

void main() {
  test('a success message clears the previous error', () {
    final loaded = DispatchLoaded(
      selectedDate: DateTime(2026, 11, 5),
      isToday: true,
      isReadOnly: false,
      dispatches: const [],
      errorMessage: 'Check-in was not saved on the server. Try again.',
    );

    final next = loaded.copyWith(actionFeedback: 'Driver Check-In confirmed.');

    expect(next.actionFeedback, 'Driver Check-In confirmed.');
    expect(next.errorMessage, isNull);
  });

  test('an error clears the previous success message', () {
    final loaded = DispatchLoaded(
      selectedDate: DateTime(2026, 11, 5),
      isToday: true,
      isReadOnly: false,
      dispatches: const [],
      actionFeedback: 'Driver Check-In confirmed.',
    );

    final next = loaded.copyWith(errorMessage: 'Stop arrival was not saved.');

    expect(next.errorMessage, 'Stop arrival was not saved.');
    expect(next.actionFeedback, isNull);
  });

  test('a slower sync cannot undo a local check-in or pickup', () {
    final local = _record(
      status: 'in_progress',
      checkInTime: '07:05 AM',
      arrived: true,
      pickup: 'picked_up',
    );
    final remote = _record();

    final merged = keepLocalDispatchProgress(local, remote);

    expect(merged.isCheckedIn, isTrue);
    expect(merged.checkInTime, '07:05 AM');
    expect(merged.stops.single.isArrived, isTrue);
    expect(merged.stops.single.students.single.pickupStatus, 'picked_up');
  });

  test('vehicle hold reasons block out-of-service buses only', () {
    expect(
      vehicleServiceHoldReason(status: 'In Service', active: true, unitNumber: '1001'),
      isNull,
    );
    expect(
      vehicleServiceHoldReason(status: 'Out of Service', active: true, unitNumber: '42'),
      contains('42'),
    );
    expect(
      vehicleServiceHoldReason(status: 'In Service', active: false, unitNumber: '42'),
      contains('out of service'),
    );
  });

  test('an empty remote list clears the visible runs', () {
    final merged = mergeRemoteDispatches(
      local: [_record(status: 'in_progress', checkInTime: '07:05 AM')],
      remote: const [],
      trustServer: false,
    );
    expect(merged, isEmpty);
  });
}
