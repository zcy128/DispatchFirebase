import 'models/dispatch_model.dart';

const blockedVehicleStatuses = <String>{
  'maintenance',
  'out of service',
  'in inspection',
  'periodic inspection',
  'defective',
  'under repair',
};

/// Returns a driver-facing reason when [status] or [active] keeps the bus off the road.
String? vehicleServiceHoldReason({
  required String status,
  required bool active,
  required String unitNumber,
}) {
  final unit = unitNumber.trim();
  if (!active) {
    return 'Check-in is blocked because bus $unit is out of service.';
  }
  final normalized = status.trim().toLowerCase();
  if (blockedVehicleStatuses.contains(normalized)) {
    return 'Check-in is blocked because bus $unit is ${status.trim()}.';
  }
  return null;
}

/// Keeps local check-in, arrival, and attendance when a slower sync is behind the driver.
DispatchRecord keepLocalDispatchProgress(DispatchRecord local, DispatchRecord remote) {
  final keepCheckout = local.isCheckedOut && !remote.isCheckedOut;
  final keepCheckIn = !keepCheckout && local.isCheckedIn && !remote.isCheckedIn;

  final stops = remote.stops.map((remoteStop) {
    DispatchStop? localStop;
    for (final stop in local.stops) {
      if (stop.stopId == remoteStop.stopId) {
        localStop = stop;
        break;
      }
    }
    if (localStop == null) return remoteStop;
    return _keepStopProgress(localStop, remoteStop);
  }).toList();

  return remote.copyWith(
    status: keepCheckout || keepCheckIn ? local.status : remote.status,
    checkInTime: keepCheckout || keepCheckIn ? local.checkInTime : remote.checkInTime,
    clearCheckInTime: !(keepCheckout || keepCheckIn) && remote.checkInTime == null,
    checkOutTime: keepCheckout ? local.checkOutTime : remote.checkOutTime,
    clearCheckOutTime: !keepCheckout && remote.checkOutTime == null,
    driverCheckoutComments: keepCheckout ? local.driverCheckoutComments : remote.driverCheckoutComments,
    clearCheckoutComments: !keepCheckout && (remote.driverCheckoutComments == null || remote.driverCheckoutComments!.isEmpty),
    stops: stops,
  );
}

DispatchStop _keepStopProgress(DispatchStop local, DispatchStop remote) {
  final keepArrival = local.isArrived && !remote.isArrived;
  final students = remote.students.map((remoteStudent) {
    StudentAttendance? localStudent;
    for (final student in local.students) {
      if (student.studentId == remoteStudent.studentId) {
        localStudent = student;
        break;
      }
    }
    if (localStudent == null) return remoteStudent;
    return _keepStudentProgress(localStudent, remoteStudent);
  }).toList();

  return remote.copyWith(
    isArrived: keepArrival ? true : remote.isArrived,
    arrivedTime: keepArrival ? local.arrivedTime : remote.arrivedTime,
    clearArrivedTime: !keepArrival && remote.arrivedTime == null,
    students: students,
  );
}

StudentAttendance _keepStudentProgress(StudentAttendance local, StudentAttendance remote) {
  final keepPickup = local.pickupStatus != 'pending' && remote.pickupStatus == 'pending';
  final keepDropoff = local.dropoffStatus != 'pending' && remote.dropoffStatus == 'pending';
  return remote.copyWith(
    pickupStatus: keepPickup ? local.pickupStatus : remote.pickupStatus,
    pickupTime: keepPickup ? local.pickupTime : remote.pickupTime,
    clearPickupTime: !keepPickup && remote.pickupTime == null,
    dropoffStatus: keepDropoff ? local.dropoffStatus : remote.dropoffStatus,
    dropoffTime: keepDropoff ? local.dropoffTime : remote.dropoffTime,
    clearDropoffTime: !keepDropoff && remote.dropoffTime == null,
    notes: (remote.notes == null || remote.notes!.isEmpty) ? local.notes : remote.notes,
  );
}

List<DispatchRecord> mergeRemoteDispatches({
  required List<DispatchRecord> local,
  required List<DispatchRecord> remote,
  required bool trustServer,
}) {
  if (trustServer) return remote;
  return remote.map((remoteRecord) {
    DispatchRecord? current;
    for (final item in local) {
      if (item.id == remoteRecord.id) {
        current = item;
        break;
      }
    }
    if (current == null) return remoteRecord;
    return keepLocalDispatchProgress(current, remoteRecord);
  }).toList();
}
