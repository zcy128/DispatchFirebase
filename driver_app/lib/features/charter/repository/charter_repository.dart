import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import '../models/charter_model.dart';

class CharterRepository {
  final FirebaseFirestore _firestore;

  CharterRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  CollectionReference<Map<String, dynamic>> get _tripsRef =>
      _firestore.collection('charter_trips');

  CollectionReference<Map<String, dynamic>> get _payrollRef =>
      _firestore.collection('dispatch_payrolls');

  CollectionReference<Map<String, dynamic>> get _payrollLogRef =>
      _firestore.collection('payroll_logs');

  /// Stream charter trips assigned to the specified driver or attendant
  Stream<List<CharterTripModel>> streamAssignedTrips({
    required String driverId,
    required String username,
  }) {
    return _tripsRef
        .where('status', isNotEqualTo: 5) // Exclude cancelled
        .snapshots()
        .map((snapshot) {
      final list = <CharterTripModel>[];
      for (final doc in snapshot.docs) {
        final trip = CharterTripModel.fromMap(doc.data(), doc.id);
        if (trip.getAssignmentForUser(driverId, username) != null) {
          list.add(trip);
        }
      }
      list.sort((a, b) => a.departsAt.compareTo(b.departsAt));
      return list;
    });
  }

  /// Stream all active charter trips (for self-assignment or shift overview)
  Stream<List<CharterTripModel>> streamAllActiveTrips() {
    return _tripsRef
        .where('status', isNotEqualTo: 5)
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs
          .map((doc) => CharterTripModel.fromMap(doc.data(), doc.id))
          .toList();
      list.sort((a, b) => a.departsAt.compareTo(b.departsAt));
      return list;
    });
  }

  /// Fetch a single charter trip by ID
  Future<CharterTripModel?> getTripById(String tripId) async {
    final doc = await _tripsRef.doc(tripId).get();
    if (!doc.exists || doc.data() == null) return null;
    return CharterTripModel.fromMap(doc.data()!, doc.id);
  }

  /// Assign or claim crew for a charter trip assignment
  Future<void> assignCrewMember({
    required String tripId,
    required String assignmentId,
    required String role, // 'driver' or 'attendant'
    required String employeeId,
    required String employeeName,
    String? phone,
  }) async {
    final docRef = _tripsRef.doc(tripId);
    final snap = await docRef.get();
    if (!snap.exists) throw Exception('Trip $tripId not found');

    final trip = CharterTripModel.fromMap(snap.data()!, snap.id);
    final assignments = List<CharterAssignmentModel>.from(trip.assignments);
    final index = assignments.indexWhere((a) => a.id == assignmentId);
    if (index == -1) throw Exception('Assignment $assignmentId not found');

    final current = assignments[index];
    final map = current.toMap();
    if (role.toLowerCase() == 'driver') {
      map['driverId'] = employeeId;
      map['driverName'] = employeeName;
      if (phone != null) map['driverPhone'] = phone;
    } else {
      map['attendantId'] = employeeId;
      map['attendantName'] = employeeName;
      if (phone != null) map['attendantPhone'] = phone;
    }

    assignments[index] = CharterAssignmentModel.fromMap(map, tripId: tripId);
    final updatedTripMap = trip.toMap();
    updatedTripMap['assignments'] = assignments.map((a) => a.toMap()).toList();
    updatedTripMap['status'] = 2; // Assigned
    updatedTripMap['updatedAt'] = DateTime.now().toIso8601String();

    await docRef.set(updatedTripMap, SetOptions(merge: true));
  }

  /// Check-in driver or attendant for their assigned charter run
  Future<void> checkInCrew({
    required String tripId,
    required String assignmentId,
    required bool isDriver,
    required String employeeId,
    required String employeeName,
    String? checkInTime,
  }) async {
    final docRef = _tripsRef.doc(tripId);
    final snap = await docRef.get();
    if (!snap.exists) throw Exception('Trip $tripId not found');

    final trip = CharterTripModel.fromMap(snap.data()!, snap.id);
    final assignments = List<CharterAssignmentModel>.from(trip.assignments);
    final index = assignments.indexWhere((a) => a.id == assignmentId);
    if (index == -1) throw Exception('Assignment $assignmentId not found');

    final current = assignments[index];
    final timeStr = checkInTime ?? DateFormat('HH:mm').format(DateTime.now());

    final map = current.toMap();
    map['status'] = 1; // Checked In
    if (isDriver) {
      map['isDriverCheckedIn'] = true;
      map['driverCheckedInAt'] = timeStr;
    } else {
      map['isAttendantCheckedIn'] = true;
      map['attendantCheckedInAt'] = timeStr;
    }

    final updatedAssignment = CharterAssignmentModel.fromMap(map, tripId: tripId);
    assignments[index] = updatedAssignment;

    final updatedTripMap = trip.toMap();
    updatedTripMap['assignments'] = assignments.map((a) => a.toMap()).toList();
    if (trip.status < 3) {
      updatedTripMap['status'] = 3; // In Progress
    }
    updatedTripMap['updatedAt'] = DateTime.now().toIso8601String();

    await docRef.set(updatedTripMap, SetOptions(merge: true));

    // Sync to dispatch_payrolls and payroll_logs
    await _syncPayrollRecord(
      trip: trip,
      assignment: updatedAssignment,
      role: isDriver ? 'driver' : 'attendant',
      employeeId: employeeId,
      employeeName: employeeName,
      payOption: isDriver ? updatedAssignment.driverPayOption : updatedAssignment.attendantPayOption,
      payRate: isDriver ? updatedAssignment.driverPayRate : updatedAssignment.attendantPayRate,
      eiHours: isDriver ? updatedAssignment.driverEiHours : updatedAssignment.attendantEiHours,
      checkInTime: timeStr,
      checkOutTime: isDriver ? updatedAssignment.driverCheckedOutAt : updatedAssignment.attendantCheckedOutAt,
      comments: isDriver ? updatedAssignment.driverPayrollComments : updatedAssignment.attendantPayrollComments,
    );
  }

  /// Check-out driver or attendant from their assigned charter run
  Future<void> checkOutCrew({
    required String tripId,
    required String assignmentId,
    required bool isDriver,
    required String employeeId,
    required String employeeName,
    String? checkOutTime,
    String? comments,
  }) async {
    final docRef = _tripsRef.doc(tripId);
    final snap = await docRef.get();
    if (!snap.exists) throw Exception('Trip $tripId not found');

    final trip = CharterTripModel.fromMap(snap.data()!, snap.id);
    final assignments = List<CharterAssignmentModel>.from(trip.assignments);
    final index = assignments.indexWhere((a) => a.id == assignmentId);
    if (index == -1) throw Exception('Assignment $assignmentId not found');

    final current = assignments[index];
    final timeStr = checkOutTime ?? DateFormat('HH:mm').format(DateTime.now());

    final map = current.toMap();
    map['status'] = 2; // Checked Out
    if (isDriver) {
      map['isDriverCheckedOut'] = true;
      map['driverCheckedOutAt'] = timeStr;
      if (comments != null && comments.isNotEmpty) {
        map['driverPayrollComments'] = comments;
      }
    } else {
      map['isAttendantCheckedOut'] = true;
      map['attendantCheckedOutAt'] = timeStr;
      if (comments != null && comments.isNotEmpty) {
        map['attendantPayrollComments'] = comments;
      }
    }

    final updatedAssignment = CharterAssignmentModel.fromMap(map, tripId: tripId);
    assignments[index] = updatedAssignment;

    final updatedTripMap = trip.toMap();
    updatedTripMap['assignments'] = assignments.map((a) => a.toMap()).toList();

    // Check if all assignments are checked out
    final allCheckedOut = assignments.every(
      (a) => (a.isDriverCheckedOut || a.driverId.isEmpty) &&
             (a.isAttendantCheckedOut || a.attendantId.isEmpty),
    );
    if (allCheckedOut) {
      updatedTripMap['status'] = 4; // Completed
    }
    updatedTripMap['updatedAt'] = DateTime.now().toIso8601String();

    await docRef.set(updatedTripMap, SetOptions(merge: true));

    // Sync to dispatch_payrolls and payroll_logs
    await _syncPayrollRecord(
      trip: trip,
      assignment: updatedAssignment,
      role: isDriver ? 'driver' : 'attendant',
      employeeId: employeeId,
      employeeName: employeeName,
      payOption: isDriver ? updatedAssignment.driverPayOption : updatedAssignment.attendantPayOption,
      payRate: isDriver ? updatedAssignment.driverPayRate : updatedAssignment.attendantPayRate,
      eiHours: isDriver ? updatedAssignment.driverEiHours : updatedAssignment.attendantEiHours,
      checkInTime: (isDriver ? updatedAssignment.driverCheckedInAt : updatedAssignment.attendantCheckedInAt) ?? '08:00',
      checkOutTime: timeStr,
      comments: comments ?? (isDriver ? updatedAssignment.driverPayrollComments : updatedAssignment.attendantPayrollComments),
    );
  }

  /// Record arrival time at a specific stop
  Future<void> recordStopArrival({
    required String tripId,
    required String stopId,
    String? arrivalTime,
  }) async {
    final docRef = _tripsRef.doc(tripId);
    final snap = await docRef.get();
    if (!snap.exists) throw Exception('Trip $tripId not found');

    final trip = CharterTripModel.fromMap(snap.data()!, snap.id);
    final stops = List<CharterStopModel>.from(trip.stops);
    final index = stops.indexWhere((s) => s.id == stopId);
    if (index == -1) throw Exception('Stop $stopId not found');

    final timeStr = arrivalTime ?? DateFormat('HH:mm').format(DateTime.now());
    stops[index] = stops[index].copyWith(arrivedAt: timeStr);

    final updatedTripMap = trip.toMap();
    updatedTripMap['stops'] = stops.map((s) => s.toMap()).toList();
    if (trip.status < 3) {
      updatedTripMap['status'] = 3; // In Progress
    }
    updatedTripMap['updatedAt'] = DateTime.now().toIso8601String();

    await docRef.set(updatedTripMap, SetOptions(merge: true));
  }

  /// Record departure time from a specific stop
  Future<void> recordStopDeparture({
    required String tripId,
    required String stopId,
    String? departureTime,
  }) async {
    final docRef = _tripsRef.doc(tripId);
    final snap = await docRef.get();
    if (!snap.exists) throw Exception('Trip $tripId not found');

    final trip = CharterTripModel.fromMap(snap.data()!, snap.id);
    final stops = List<CharterStopModel>.from(trip.stops);
    final index = stops.indexWhere((s) => s.id == stopId);
    if (index == -1) throw Exception('Stop $stopId not found');

    final timeStr = departureTime ?? DateFormat('HH:mm').format(DateTime.now());
    stops[index] = stops[index].copyWith(departedAt: timeStr);

    final updatedTripMap = trip.toMap();
    updatedTripMap['stops'] = stops.map((s) => s.toMap()).toList();
    updatedTripMap['updatedAt'] = DateTime.now().toIso8601String();

    await docRef.set(updatedTripMap, SetOptions(merge: true));
  }

  /// Internal synchronization to dispatch_payrolls and payroll_logs
  Future<void> _syncPayrollRecord({
    required CharterTripModel trip,
    required CharterAssignmentModel assignment,
    required String role,
    required String employeeId,
    required String employeeName,
    required String payOption,
    required double payRate,
    required double eiHours,
    required String checkInTime,
    String? checkOutTime,
    String? comments,
  }) async {
    try {
      final shiftId = 'CHARTER-${trip.id}-${assignment.id}';
      final payrollId = 'DP-$shiftId-$role';
      final logId = 'PL-$shiftId-$role';
      final nowIso = DateTime.now().toIso8601String();

      final pRef = _payrollRef.doc(payrollId);
      final pSnap = await pRef.get();
      final existingData = pSnap.data();

      final hasComments = comments != null && comments.trim().isNotEmpty;
      String currentStatus = existingData?['status']?.toString() ??
          (checkOutTime != null
              ? (hasComments ? 'pending_approval' : 'approved')
              : 'pending_approval');

      if (existingData?['status'] == 'approved' || existingData?['status'] == 'rejected') {
        currentStatus = existingData!['status'].toString();
      }

      final routeNo = trip.tripNumber.isNotEmpty
          ? trip.tripNumber
          : 'CHR-${trip.id.length > 4 ? trip.id.substring(trip.id.length - 4).toUpperCase() : trip.id.toUpperCase()}';

      final payrollData = <String, dynamic>{
        'id': payrollId,
        'dispatchDate': trip.dispatchDate,
        'shiftId': shiftId,
        'routeNo': routeNo,
        'routeName': trip.title,
        'shiftType': 'CHARTER',
        'employeeId': employeeId,
        'employeeName': employeeName,
        'role': role,
        'vehicleId': assignment.vehicleId,
        'unitNumber': assignment.vehicleUnitNumber,
        'checkInTime': checkInTime,
        'checkOutTime': ?checkOutTime,
        'hasComments': hasComments,
        'payOption': payOption,
        'payRate': payRate,
        'eiHours': eiHours,
        'rateSource': 'charter_contract',
        'rateDescription': 'Charter Trip: ${trip.title} (${trip.clientName})',
        if (comments != null && comments.isNotEmpty) 'payrollComments': comments,
        'status': currentStatus,
        'syncedToFinance': true,
        'isCharter': true,
        'charterTripId': trip.id,
        'charterAssignmentId': assignment.id,
        'clientName': trip.clientName,
        'updatedBy': employeeName,
        'createdAt': existingData?['createdAt'] ?? nowIso,
        'updatedAt': nowIso,
      };

      await pRef.set(payrollData, SetOptions(merge: true));

      // Sync to payroll_logs
      final logRef = _payrollLogRef.doc(logId);
      final logData = <String, dynamic>{
        'id': logId,
        'dispatchPayrollId': payrollId,
        'dispatchDate': trip.dispatchDate,
        'shiftId': shiftId,
        'routeNo': routeNo,
        'routeName': trip.title,
        'shiftType': 'CHARTER',
        'employeeId': employeeId,
        'employeeName': employeeName,
        'role': role,
        'unitNumber': assignment.vehicleUnitNumber,
        'checkInTime': checkInTime,
        'checkOutTime': ?checkOutTime,
        'payOption': payOption,
        'originalPayRate': payRate,
        'payAmount': payRate,
        'originalEiHours': eiHours,
        'eiHours': eiHours,
        'rateSource': 'charter_contract',
        'rateDescription': 'Charter Trip: ${trip.title} (${trip.clientName})',
        if (comments != null && comments.isNotEmpty) 'dispatcherComments': comments,
        'status': currentStatus == 'approved' ? 'approved' : 'processed',
        'isCharter': true,
        'charterTripId': trip.id,
        'charterAssignmentId': assignment.id,
        'clientName': trip.clientName,
        'syncedAt': nowIso,
        'updatedAt': nowIso,
        'updatedBy': employeeName,
      };

      await logRef.set(logData, SetOptions(merge: true));
    } catch (e) {
      debugPrint('[CharterRepository] _syncPayrollRecord error: $e');
    }
  }
}
