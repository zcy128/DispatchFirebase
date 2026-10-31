import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import '../../../core/api_config.dart';
import '../../../core/network/api_client.dart';
import '../../route/repository/route_repository.dart';
import '../models/dispatch_model.dart';

class DispatchRejected implements Exception {
  final String message;

  const DispatchRejected(this.message);

  @override
  String toString() => message;
}

class DispatchRepository {
  static const String boxName = 'dispatch_records_v1';
  Box<String>? _box;
  final http.Client _httpClient;
  final String apiBaseUrl;

  bool get isFirestoreAvailable {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  DispatchRepository({
    http.Client? httpClient,
    String? apiBaseUrl,
  })  : _httpClient = httpClient ?? AuthenticatedHttpClient.instance,
        apiBaseUrl = apiBaseUrl ?? ApiConfig.baseUrl;

  Future<void> init() async {
    _box = await Hive.openBox<String>(boxName);
    if (_box!.isEmpty) {
      await _seedTwoWeeksData();
    }
  }

  Box<String> get box {
    if (_box == null || !_box!.isOpen) {
      throw StateError('DispatchRepository must be initialized before use.');
    }
    return _box!;
  }

  static DateTime normalizeDate(DateTime dt) {
    return DateTime(dt.year, dt.month, dt.day);
  }

  static String formatDate(DateTime dt) {
    return DateFormat('yyyy-MM-dd').format(dt);
  }

  static String formatTime(DateTime dt) {
    return DateFormat('hh:mm a').format(dt);
  }

  bool isWithinAllowedWindow(DateTime targetDate, {DateTime? referenceToday}) {
    final today = normalizeDate(referenceToday ?? DateTime.now());
    final target = normalizeDate(targetDate);
    final minDate = DateTime(today.year, today.month, today.day - 7);
    final maxDate = DateTime(today.year, today.month, today.day + 7);
    return !target.isBefore(minDate) && !target.isAfter(maxDate);
  }

  bool isToday(DateTime targetDate, {DateTime? referenceToday}) {
    final today = normalizeDate(referenceToday ?? DateTime.now());
    final target = normalizeDate(targetDate);
    return today.isAtSameMomentAs(target);
  }

  static DateTime getNextOperatingDate(DateTime fromDate) {
    final norm = normalizeDate(fromDate);
    if (norm.weekday == DateTime.friday) {
      return norm.add(const Duration(days: 3));
    } else if (norm.weekday == DateTime.saturday) {
      return norm.add(const Duration(days: 2));
    } else {
      return norm.add(const Duration(days: 1));
    }
  }

  List<DispatchRecord> getDispatchesForDate(DateTime date, {String? driverId}) {
    final dateStr = formatDate(date);
    final results = <DispatchRecord>[];

    for (final rawJson in box.values) {
      try {
        final record = DispatchRecord.fromJson(rawJson);
        if (record.date == dateStr) {
          if (driverId != null && driverId.isNotEmpty) {
            if (RouteRepository.matchesDriver(record.driverId, driverId)) {
              results.add(record);
            }
          } else {
            results.add(record);
          }
        }
      } catch (_) {
        // Skip corrupted entries
      }
    }

    results.sort((a, b) => a.shiftType.compareTo(b.shiftType));
    return results;
  }

  /// Parses a backend or Firestore shift map into a DispatchRecord.
  static DispatchRecord parseShiftMap(Map<String, dynamic> s, String dateStr) {
    final shiftDriverId = (s['driverId'] ?? '').toString();
    final rawStops = s['stops'] as List<dynamic>? ?? [];

    // First pass: collect students across shift
    final shiftStudents = <int, StudentAttendance>{};
    for (final st in rawStops) {
      final rawStudents = st['assignedStudents'] as List<dynamic>? ?? [];
      for (final stu in rawStudents) {
        final sId = stu['studentId'] is int
            ? stu['studentId'] as int
            : int.tryParse(stu['studentId']?.toString() ?? '') ?? 0;
        if (sId > 0) {
          final isPresent = stu['isPresent'] as bool?;
          final rawStatus = stu['status']?.toString();
          final rawDropoff = stu['dropoffStatus']?.toString();
          final rawDropoffTime = stu['dropoffTime']?.toString();
          final absenceReason = stu['absenceReason']?.toString();
          final isExplicitDroppedOff = rawDropoff == 'dropped_off' || rawStatus == 'dropped_off';
          final isExplicitAbsent = !isExplicitDroppedOff && (isPresent == false ||
              rawStatus == 'absent' ||
              rawStatus == 'no_show' ||
              (absenceReason != null && absenceReason.isNotEmpty));
          final pickupStatus = isExplicitDroppedOff || isPresent == true || rawStatus == 'picked_up'
              ? 'picked_up'
              : (isExplicitAbsent ? 'absent' : (rawStatus ?? 'pending'));
          final dropoffStatus = isExplicitDroppedOff
              ? 'dropped_off'
              : (isExplicitAbsent ? 'bypassed_absent' : (rawDropoff ?? 'pending'));
          final notes = (absenceReason != null && absenceReason.isNotEmpty)
              ? absenceReason
              : stu['notes']?.toString();

          final candidateAttendance = StudentAttendance(
            studentId: sId,
            studentNo: (stu['studentNo'] ?? 'STU-$sId').toString(),
            studentName: (stu['studentName'] ?? 'Student $sId').toString(),
            grade: (stu['grade'] ?? 'Gr 10').toString(),
            homeAddress: (stu['homeAddress'] ?? st['stopLocation'] ?? '').toString(),
            schoolName: (stu['schoolName'] ?? s['schoolName'] ?? st['schoolName'] ?? '').toString(),
            pickupStatus: pickupStatus,
            dropoffStatus: dropoffStatus,
            pickupTime: stu['pickupTime']?.toString(),
            dropoffTime: rawDropoffTime,
            notes: notes,
          );

          if (shiftStudents.containsKey(sId)) {
            final existing = shiftStudents[sId]!;
            final resolvedPickupStatus = (existing.isPickedUp || existing.isAbsent) && pickupStatus == 'pending'
                ? existing.pickupStatus
                : (isExplicitDroppedOff ? 'picked_up' : pickupStatus);
            final resolvedDropoff = (existing.isDroppedOff || existing.isBypassedAbsent) && dropoffStatus == 'pending'
                ? existing.dropoffStatus
                : (isExplicitDroppedOff ? 'dropped_off' : dropoffStatus);
            final resolvedPickupTime = existing.pickupTime ?? candidateAttendance.pickupTime;
            final resolvedDropoffTime = candidateAttendance.dropoffTime ?? existing.dropoffTime;
            final resolvedNotes = candidateAttendance.notes ?? existing.notes;

            shiftStudents[sId] = existing.copyWith(
              pickupStatus: resolvedPickupStatus,
              dropoffStatus: resolvedDropoff,
              pickupTime: resolvedPickupTime,
              dropoffTime: resolvedDropoffTime,
              notes: resolvedNotes,
            );
          } else {
            shiftStudents[sId] = candidateAttendance;
          }
        }
      }
    }

    // Second pass: construct stops
    final stops = <DispatchStop>[];
    for (final st in rawStops) {
      final stopId = st['stopId'] is int
          ? st['stopId'] as int
          : int.tryParse(st['stopId']?.toString() ?? '') ?? 0;
      final sequence = st['sequence'] is int
          ? st['sequence'] as int
          : int.tryParse(st['sequence']?.toString() ?? '') ?? 0;
      final stopTypeStr = (st['stopType'] ?? '').toString();
      final isSchool = stopTypeStr.toLowerCase().contains('school');
      final isDropoff = stopTypeStr.toLowerCase().contains('dropoff');

      String normalizedStopType;
      if (isSchool && isDropoff) {
        normalizedStopType = 'school_dropoff';
      } else if (isSchool && !isDropoff) {
        normalizedStopType = 'school_pickup';
      } else if (!isSchool && isDropoff) {
        normalizedStopType = 'home_dropoff';
      } else {
        normalizedStopType = 'home_pickup';
      }

      final stopLocation = (st['stopLocation'] ?? '').toString();
      final plannedTime = (st['stopScheduleTime'] ?? '').toString();
      final arrivedTime = (st['actualArrivalTime'] ?? st['stopArrivalTime'])?.toString();
      final isArrived = (arrivedTime != null && arrivedTime.isNotEmpty) || (st['isActualArrived'] == true);

      List<StudentAttendance> stopStudents = [];
      final rawStudents = st['assignedStudents'] as List<dynamic>? ?? [];
      if (rawStudents.isNotEmpty) {
        for (final stu in rawStudents) {
          final sId = stu['studentId'] is int
              ? stu['studentId'] as int
              : int.tryParse(stu['studentId']?.toString() ?? '') ?? 0;
          if (shiftStudents.containsKey(sId)) {
            stopStudents.add(shiftStudents[sId]!);
          }
        }
      } else if (isSchool) {
        stopStudents = shiftStudents.values.toList();
      }

      stops.add(DispatchStop(
        stopId: stopId,
        sequence: sequence,
        stopLocation: stopLocation,
        stopType: normalizedStopType,
        isSchoolStop: isSchool,
        schoolName: st['schoolName']?.toString(),
        plannedTime: plannedTime,
        arrivedTime: arrivedTime,
        isArrived: isArrived,
        students: stopStudents,
      ));
    }

    final isCheckedIn = s['isDriverCheckedIn'] == true;
    final isCheckedOut = s['isDriverCheckedOut'] == true;
    final String shiftStatus;
    if (isCheckedOut) {
      shiftStatus = 'completed';
    } else if (isCheckedIn) {
      shiftStatus = 'in_progress';
    } else {
      shiftStatus = 'scheduled';
    }

    final rawRate = s['driverPayAmount'] ?? s['payRate'] ?? s['payrollRate'];
    final payrollRate = rawRate is num
        ? rawRate.toDouble()
        : (double.tryParse(rawRate?.toString() ?? '') ?? 28.50);
    final payOption = (s['driverPayOption'] ?? s['payOption'] ?? 'STANDARD').toString();
    final checkoutComments = s['driverCheckoutComments']?.toString() ?? s['payrollComments']?.toString();

    return DispatchRecord(
      id: s['id'].toString(),
      date: (s['dispatchDate'] ?? dateStr).toString(),
      routeId: (s['routeId'] ?? '').toString(),
      routeNo: (s['routeNo'] ?? '').toString(),
      routeName: (s['routeName'] ?? '').toString(),
      shiftType: (s['shiftType'] ?? 'AM').toString().toUpperCase(),
      driverId: shiftDriverId,
      driverName: (s['driverName'] ?? '').toString(),
      attendantName: s['attendantName']?.toString(),
      attendantPhone: s['attendantPhone']?.toString(),
      attendantStatus: s['isAttendantCheckedIn'] == true ? 'online' : 'offline',
      attendantLastActive: s['isAttendantCheckedIn'] == true ? 'Logged in · In attendance' : 'Logged out',
      vehicleUnit: (s['unitNumber'] ?? '').toString(),
      yardName: (s['yardName'] ?? 'Main Yard').toString(),
      status: shiftStatus,
      checkInTime: isCheckedIn ? s['driverCheckedInAt']?.toString() : null,
      checkOutTime: isCheckedOut ? s['driverCheckedOutAt']?.toString() : null,
      payrollRate: payrollRate,
      payOption: payOption,
      driverCheckoutComments: checkoutComments,
      stops: stops,
    );
  }

  /// Listens to real-time updates directly from Firestore dispatch_shifts collection.
  /// Uses database-level assignedEmployeeIds index filtering when driverId is provided,
  /// completely avoiding downloading all shifts across the company.
  Stream<List<DispatchRecord>> watchDispatchesForDate(
    DateTime date, {
    String? driverId,
  }) {
    final dateStr = formatDate(date);

    if (!isFirestoreAvailable) {
      return Stream.value(getDispatchesForDate(date, driverId: driverId));
    }

    try {
      final cleanDriver = driverId?.trim() ?? '';
      final norm = cleanDriver.toLowerCase();
      final empId = cleanDriver.isNotEmpty ? RouteRepository.resolveEmployeeId(cleanDriver) : '';

      final queryKeys = <String>{
        if (cleanDriver.isNotEmpty) cleanDriver,
        if (norm.isNotEmpty) norm,
        if (empId.isNotEmpty) empId,
        if (empId.isNotEmpty) empId.toLowerCase(),
      }.where((s) => s.isNotEmpty && s != 'tbd' && s != 'unassigned').toList();

      final query = queryKeys.isNotEmpty
          ? FirebaseFirestore.instance
              .collection('dispatch_shifts')
              .where('assignedEmployeeIds', arrayContainsAny: queryKeys)
          : FirebaseFirestore.instance
              .collection('dispatch_shifts')
              .where('dispatchDate', isEqualTo: dateStr);

      return query.snapshots().asyncMap((snapshot) async {
        final records = <DispatchRecord>[];
        for (final doc in snapshot.docs) {
          final data = Map<String, dynamic>.from(doc.data());
          data['id'] = doc.id;
          final shiftDate = (data['dispatchDate'] ?? '').toString();
          if (shiftDate != dateStr) {
            continue;
          }
          final shiftDriverId = (data['driverId'] ?? '').toString();
          final shiftDriverName = (data['driverName'] ?? '').toString();
          if (cleanDriver.isNotEmpty &&
              !RouteRepository.matchesDriver(shiftDriverId, cleanDriver) &&
              !RouteRepository.matchesDriver(shiftDriverName, cleanDriver)) {
            continue;
          }

          final record = parseShiftMap(data, dateStr);
          await saveDispatch(record);
          records.add(record);
        }

        records.sort((a, b) => a.shiftType.compareTo(b.shiftType));
        if (records.isNotEmpty) {
          return records;
        }
        return getDispatchesForDate(date, driverId: driverId);
      }).handleError((error) {
        debugPrint('[Firestore Realtime] Stream error: $error');
        return getDispatchesForDate(date, driverId: driverId);
      });
    } catch (e) {
      debugPrint('[Firestore Realtime] Fallback to cache: $e');
      return Stream.value(getDispatchesForDate(date, driverId: driverId));
    }
  }

  /// Synchronizes live dispatch shifts directly from backend Go server for the given date.
  /// Converts backend shifts into DispatchRecord entities and caches them in Hive for offline access.
  Future<List<DispatchRecord>> syncDispatchesFromBackend(
    DateTime date, {
    String? driverId,
  }) async {
    try {
      final dateStr = formatDate(date);
      var urlStr = '$apiBaseUrl/api/public/dispatch/shifts?date=$dateStr';
      if (driverId != null && driverId.trim().isNotEmpty) {
        urlStr += '&driver=${Uri.encodeComponent(driverId.trim())}';
      }
      final uri = Uri.parse(urlStr);
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode != 200) {
        return getDispatchesForDate(date, driverId: driverId);
      }

      final List<dynamic> shiftsJson = jsonDecode(res.body);
      final synced = <DispatchRecord>[];

      for (final raw in shiftsJson) {
        final s = Map<String, dynamic>.from(raw as Map);
        final shiftDriverId = (s['driverId'] ?? '').toString();
        final shiftDriverName = (s['driverName'] ?? '').toString();
        if (driverId != null &&
            driverId.trim().isNotEmpty &&
            !RouteRepository.matchesDriver(shiftDriverId, driverId) &&
            !RouteRepository.matchesDriver(shiftDriverName, driverId)) {
          continue;
        }

        final record = parseShiftMap(s, dateStr);
        await saveDispatch(record);
        synced.add(record);
      }

      synced.sort((a, b) => a.shiftType.compareTo(b.shiftType));
      return synced.isNotEmpty ? synced : getDispatchesForDate(date, driverId: driverId);
    } catch (_) {
      return getDispatchesForDate(date, driverId: driverId);
    }
  }

  DispatchRecord? getDispatchById(String id) {
    final rawJson = box.get(id);
    if (rawJson == null) return null;
    try {
      return DispatchRecord.fromJson(rawJson);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveDispatch(DispatchRecord record) async {
    await box.put(record.id, record.toJson());
  }

  Future<void> _sendAccepted(
    String method,
    Uri uri,
    Map<String, dynamic> body,
    String failureMessage,
  ) async {
    final headers = {'Content-Type': 'application/json'};
    final encoded = jsonEncode(body);
    final http.Response res;
    try {
      final request = method == 'POST'
          ? _httpClient.post(uri, headers: headers, body: encoded)
          : _httpClient.put(uri, headers: headers, body: encoded);
      res = await request.timeout(const Duration(seconds: 12));
    } catch (_) {
      throw DispatchRejected(failureMessage);
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw DispatchRejected(_messageFromResponse(res, failureMessage));
    }
  }

  String _messageFromResponse(http.Response res, String fallback) {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map) {
        final message = decoded['error']?.toString().trim() ?? '';
        if (message.isNotEmpty) return message;
      }
    } catch (_) {}
    return fallback;
  }

  Future<DispatchRecord> checkInDriver(String dispatchId, {DateTime? now}) async {
    final record = getDispatchById(dispatchId);
    if (record == null) {
      throw ArgumentError('Dispatch record not found: $dispatchId');
    }

    final currentTime = now ?? DateTime.now();
    final timeStr = formatTime(currentTime);

    await _sendAccepted(
      'PUT',
      Uri.parse('$apiBaseUrl/api/public/dispatch/shifts/$dispatchId/check-in'),
      {'checkInTime': timeStr},
      'Check-in was not saved on the server. Try again.',
    );

    final updated = record.copyWith(
      status: 'in_progress',
      checkInTime: timeStr,
    );

    await saveDispatch(updated);
    return updated;
  }

  Future<DispatchRecord> checkOutDriver(
    String dispatchId, {
    DateTime? now,
    String? payrollComments,
  }) async {
    final record = getDispatchById(dispatchId);
    if (record == null) {
      throw ArgumentError('Dispatch record not found: $dispatchId');
    }

    final currentTime = now ?? DateTime.now();
    final timeStr = formatTime(currentTime);
    final comments = payrollComments?.trim();
    final hasComments = comments != null && comments.isNotEmpty;

    // 1. Direct Firestore Real-Time update if available
    if (isFirestoreAvailable) {
      try {
        final nowIso = currentTime.toUtc().toIso8601String();
        final shiftUpdates = <String, dynamic>{
          'isDriverCheckedOut': true,
          'driverCheckedOutAt': timeStr,
          'updatedAt': nowIso,
        };
        if (hasComments) {
          shiftUpdates['driverCheckoutComments'] = comments;
          shiftUpdates['payrollComments'] = comments;
        }
        await FirebaseFirestore.instance
            .collection('dispatch_shifts')
            .doc(dispatchId)
            .update(shiftUpdates);

        final payrollId = 'DP-$dispatchId-driver';
        final payrollUpdates = <String, dynamic>{
          'checkOutTime': timeStr,
          'updatedAt': nowIso,
        };
        if (hasComments) {
          payrollUpdates['hasComments'] = true;
          payrollUpdates['payrollComments'] = comments;
          payrollUpdates['status'] = 'pending_approval';
          payrollUpdates['syncedToFinance'] = false;
        } else {
          payrollUpdates['hasComments'] = false;
          payrollUpdates['status'] = 'approved';
          if (record.payrollRate > 0) {
            payrollUpdates['syncedToFinance'] = true;
          }
        }
        await FirebaseFirestore.instance
            .collection('dispatch_payrolls')
            .doc(payrollId)
            .set(payrollUpdates, SetOptions(merge: true));
      } catch (_) {
        // Fallback to REST API / local persistence on error
      }
    }

    await _sendAccepted(
      'POST',
      Uri.parse('$apiBaseUrl/api/public/dispatch/shifts/$dispatchId/check-out'),
      {
        'role': 'driver',
        'checkOutTime': timeStr,
        if (hasComments) 'payrollComments': comments,
      },
      'Check-out was not saved on the server. Try again.',
    );

    final updated = record.copyWith(
      status: 'completed',
      checkOutTime: timeStr,
      driverCheckoutComments: hasComments ? comments : record.driverCheckoutComments,
    );

    await saveDispatch(updated);
    return updated;
  }

  Future<DispatchRecord> recordStopArrival(String dispatchId, int stopId, {DateTime? now}) async {
    final record = getDispatchById(dispatchId);
    if (record == null) {
      throw ArgumentError('Dispatch record not found: $dispatchId');
    }

    final currentTime = now ?? DateTime.now();
    final timeStr = formatTime(currentTime);

    await _sendAccepted(
      'PUT',
      Uri.parse('$apiBaseUrl/api/public/dispatch/shifts/$dispatchId/stops/$stopId/arrive'),
      {'actualArrivalTime': timeStr},
      'Stop arrival was not saved on the server. Try again.',
    );

    final updatedStops = record.stops.map((stop) {
      if (stop.stopId == stopId) {
        return stop.copyWith(
          isArrived: true,
          arrivedTime: timeStr,
        );
      }
      return stop;
    }).toList();

    final updated = record.copyWith(stops: updatedStops);
    await saveDispatch(updated);
    return updated;
  }

  /// Updates student attendance with cross-stop business constraints:
  /// 1. Morning Run (Home -> School): If marked absent at home stop, student cannot drop off at school.
  /// 2. Afternoon Run (School -> Home): If marked absent at school stop, home dropoff is bypassed.
  /// 3. Before checkout, statuses can be freely amended (e.g. picked_up -> absent).
  Future<DispatchRecord> updateStudentAttendance({
    required String dispatchId,
    required int stopId,
    required int studentId,
    required String newPickupStatus, // 'picked_up' | 'absent' | 'pending'
    String? newDropoffStatus, // 'dropped_off' | 'pending'
    DateTime? now,
  }) async {
    final record = getDispatchById(dispatchId);
    if (record == null) {
      throw ArgumentError('Dispatch record not found: $dispatchId');
    }

    if (record.isCheckedOut) {
      throw StateError('Cannot modify attendance after driver check-out.');
    }

    if (!record.stops.any((s) => s.stopId == stopId)) {
      throw ArgumentError('Stop $stopId not found in dispatch $dispatchId');
    }

    if (newDropoffStatus == 'dropped_off') {
      final wasAbsentAtHome = record.stops.any((s) =>
          !s.isSchoolStop &&
          s.students.any((st) => st.studentId == studentId && st.pickupStatus == 'absent'));
      if (wasAbsentAtHome) {
        throw StateError('Cannot drop off student who was marked absent at home pickup stop.');
      }
    }

    final currentTime = now ?? DateTime.now();
    final formattedTime = formatTime(currentTime);

    try {
      final uri = Uri.parse('$apiBaseUrl/api/public/dispatch/shifts/$dispatchId/stops/$stopId/students/$studentId');
      final bool? isPresent;
      final String? status;
      final String? dropoffStatus;
      final String? dropoffTime;
      final String? pickupTime;

      if (newDropoffStatus == 'dropped_off') {
        isPresent = true;
        status = 'dropped_off';
        dropoffStatus = 'dropped_off';
        dropoffTime = formattedTime;
        pickupTime = null;
      } else if (newPickupStatus == 'picked_up') {
        isPresent = true;
        status = 'picked_up';
        dropoffStatus = null;
        dropoffTime = null;
        pickupTime = formattedTime;
      } else if (newPickupStatus == 'absent') {
        isPresent = false;
        status = 'absent';
        dropoffStatus = 'bypassed_absent';
        dropoffTime = null;
        pickupTime = null;
      } else {
        isPresent = null;
        status = newPickupStatus;
        dropoffStatus = newDropoffStatus;
        dropoffTime = null;
        pickupTime = null;
      }

      final payload = <String, dynamic>{
        'actualArrivalTime': formattedTime,
        'reportedBy': 'driver',
      };
      if (isPresent != null) payload['isPresent'] = isPresent;
      payload['status'] = status;
      if (dropoffStatus != null) payload['dropoffStatus'] = dropoffStatus;
      if (dropoffTime != null) payload['dropoffTime'] = dropoffTime;
      if (pickupTime != null) payload['pickupTime'] = pickupTime;

      await _sendAccepted(
        'PUT',
        uri,
        payload,
        'Attendance was not saved on the server. Try again.',
      );
    } catch (error) {
      if (error is DispatchRejected) rethrow;
      throw DispatchRejected('Attendance was not saved on the server. Try again.');
    }

    final updatedStops = record.stops.map((stop) {
      final updatedStudents = stop.students.map((student) {
        if (student.studentId != studentId) {
          return student;
        }

        String finalPickupStatus = student.pickupStatus;
        String finalDropoffStatus = student.dropoffStatus;
        String? pickupTime = student.pickupTime;
        String? dropoffTime = student.dropoffTime;
        var clearPickupTime = false;
        var clearDropoffTime = false;

        if (newPickupStatus == 'picked_up') {
          finalPickupStatus = 'picked_up';
          pickupTime ??= formattedTime;
          if (finalDropoffStatus == 'bypassed_absent') {
            finalDropoffStatus = 'pending';
          }
        } else if (newPickupStatus == 'absent') {
          finalPickupStatus = 'absent';
          finalDropoffStatus = 'bypassed_absent';
          pickupTime = null;
          dropoffTime = null;
          clearPickupTime = true;
          clearDropoffTime = true;
        }

        if (newDropoffStatus == 'dropped_off') {
          finalDropoffStatus = 'dropped_off';
          dropoffTime ??= formattedTime;
          if (finalPickupStatus != 'picked_up') {
            finalPickupStatus = 'picked_up';
            pickupTime ??= formattedTime;
          }
        }

        return student.copyWith(
          pickupStatus: finalPickupStatus,
          dropoffStatus: finalDropoffStatus,
          pickupTime: pickupTime,
          dropoffTime: dropoffTime,
          clearPickupTime: clearPickupTime,
          clearDropoffTime: clearDropoffTime,
          notes: student.notes,
        );
      }).toList();

      final hasAttendanceAction = stop.stopId == stopId &&
          (newPickupStatus == 'picked_up' ||
              newPickupStatus == 'absent' ||
              newDropoffStatus == 'dropped_off');
      final stopArrived = stop.isArrived || hasAttendanceAction;
      final stopArrivedTime = stop.arrivedTime ?? (stopArrived ? formattedTime : null);

      return stop.copyWith(
        isArrived: stopArrived,
        arrivedTime: stopArrivedTime,
        students: updatedStudents,
      );
    }).toList();

    final updated = record.copyWith(stops: updatedStops);
    await saveDispatch(updated);
    return updated;
  }

  /// Batch action at School Stop:
  /// - Morning Run: 'dropoff_all' (drops off all students who were picked up and not absent)
  /// - Afternoon Run: 'pickup_all' (picks up all students who are not absent)
  Future<DispatchRecord> batchSchoolAction({
    required String dispatchId,
    required int stopId,
    required String actionType, // 'dropoff_all' | 'pickup_all'
    DateTime? now,
  }) async {
    final record = getDispatchById(dispatchId);
    if (record == null) {
      throw ArgumentError('Dispatch record not found: $dispatchId');
    }

    if (record.isCheckedOut) {
      throw StateError('Cannot modify attendance after driver check-out.');
    }

    final currentTime = now ?? DateTime.now();
    final formattedTime = formatTime(currentTime);

    final targetStop = record.stops.firstWhere(
      (s) => s.stopId == stopId,
      orElse: () => throw ArgumentError('Stop $stopId not found in dispatch $dispatchId'),
    );

    const attendanceFailure = 'Attendance was not saved on the server. Try again.';
    await _sendAccepted(
      'PUT',
      Uri.parse('$apiBaseUrl/api/public/dispatch/shifts/$dispatchId/stops/$stopId/arrive'),
      {'actualArrivalTime': formattedTime},
      attendanceFailure,
    );

    final affectedStudentIds = <int>{};
    for (final student in targetStop.students) {
      if (actionType == 'pickup_all' && student.pickupStatus != 'absent') {
        affectedStudentIds.add(student.studentId);
        await _sendAccepted(
          'PUT',
          Uri.parse('$apiBaseUrl/api/public/dispatch/shifts/$dispatchId/stops/$stopId/students/${student.studentId}'),
          {
            'isPresent': true,
            'pickupTime': formattedTime,
            'actualArrivalTime': formattedTime,
            'status': 'picked_up',
            'reportedBy': 'driver',
          },
          attendanceFailure,
        );
      } else if (actionType == 'dropoff_all' && student.pickupStatus == 'picked_up' && student.dropoffStatus != 'bypassed_absent') {
        affectedStudentIds.add(student.studentId);
        await _sendAccepted(
          'PUT',
          Uri.parse('$apiBaseUrl/api/public/dispatch/shifts/$dispatchId/stops/$stopId/students/${student.studentId}'),
          {
            'isPresent': true,
            'status': 'dropped_off',
            'dropoffStatus': 'dropped_off',
            'dropoffTime': formattedTime,
            'actualArrivalTime': formattedTime,
            'reportedBy': 'driver',
          },
          attendanceFailure,
        );
      }
    }

    // 3. Update local stops and propagate student statuses
    final updatedStops = record.stops.map((stop) {
      final isTargetStop = stop.stopId == stopId;

      final updatedStudents = stop.students.map((student) {
        if (affectedStudentIds.contains(student.studentId)) {
          if (actionType == 'dropoff_all') {
            return student.copyWith(
              dropoffStatus: 'dropped_off',
              dropoffTime: student.dropoffTime ?? formattedTime,
            );
          } else if (actionType == 'pickup_all') {
            return student.copyWith(
              pickupStatus: 'picked_up',
              pickupTime: student.pickupTime ?? formattedTime,
            );
          }
        }
        return student;
      }).toList();

      if (isTargetStop) {
        return stop.copyWith(
          isArrived: true,
          arrivedTime: stop.arrivedTime ?? formattedTime,
          students: updatedStudents,
        );
      }
      return stop.copyWith(students: updatedStudents);
    }).toList();

    final updated = record.copyWith(stops: updatedStops);
    await saveDispatch(updated);
    return updated;
  }

  /// Seeds 14 days of realistic mock dispatches (7 days past, today, 7 days future)
  Future<void> _seedTwoWeeksData() async {
    final today = normalizeDate(DateTime.now());

    for (int offset = -7; offset <= 7; offset++) {
      final date = today.add(Duration(days: offset));
      final dateStr = formatDate(date);

      final isPast = offset < 0;
      final isCurrentDay = offset == 0;

      // Seed AM Run
      final amRecord = _createSampleRecord(
        id: 'DISP-$dateStr-AM',
        dateStr: dateStr,
        shiftType: 'AM',
        routeNo: 'OCDSB-001',
        routeName: 'Gloucester / Colonel By Secondary',
        vehicleUnit: 'BUS-1021',
        driverName: 'Robert Vance',
        status: isPast
            ? 'completed'
            : isCurrentDay
                ? 'scheduled'
                : 'scheduled',
        checkInTime: isPast ? '07:05 AM' : null,
        checkOutTime: isPast ? '08:45 AM' : null,
        isPast: isPast,
      );

      // Seed PM Run
      final pmRecord = _createSampleRecord(
        id: 'DISP-$dateStr-PM',
        dateStr: dateStr,
        shiftType: 'PM',
        routeNo: 'OCDSB-001',
        routeName: 'Colonel By Secondary / Gloucester Return',
        vehicleUnit: 'BUS-1021',
        driverName: 'Robert Vance',
        status: isPast ? 'completed' : 'scheduled',
        checkInTime: isPast ? '02:40 PM' : null,
        checkOutTime: isPast ? '04:15 PM' : null,
        isPast: isPast,
      );

      await saveDispatch(amRecord);
      await saveDispatch(pmRecord);
    }
  }

  DispatchRecord _createSampleRecord({
    required String id,
    required String dateStr,
    required String shiftType,
    required String routeNo,
    required String routeName,
    required String vehicleUnit,
    required String driverName,
    required String status,
    String? checkInTime,
    String? checkOutTime,
    required bool isPast,
  }) {
    final isAM = shiftType == 'AM';

    final studentsPool = [
      const StudentAttendance(
        studentId: 101,
        studentNo: 'STU-00101',
        studentName: 'Lucas Bennett',
        grade: 'Gr 9',
        homeAddress: '244 Blair Rd, Gloucester',
        schoolName: 'Colonel By Secondary School',
      ),
      const StudentAttendance(
        studentId: 102,
        studentNo: 'STU-00102',
        studentName: 'Sophia Tremblay',
        grade: 'Gr 10',
        homeAddress: '312 Montreal Rd, Gloucester',
        schoolName: 'Colonel By Secondary School',
      ),
      const StudentAttendance(
        studentId: 103,
        studentNo: 'STU-00103',
        studentName: 'Ethan Zhang',
        grade: 'Gr 11',
        homeAddress: '158 Bathgate Dr, Gloucester',
        schoolName: 'Colonel By Secondary School',
      ),
      const StudentAttendance(
        studentId: 104,
        studentNo: 'STU-00104',
        studentName: 'Maya Patel',
        grade: 'Gr 9',
        homeAddress: '88 Den Ave, Gloucester',
        schoolName: 'Colonel By Secondary School',
      ),
    ];

    List<DispatchStop> stops;

    if (isAM) {
      // Morning Run: Home Pickup stops -> School Dropoff
      stops = [
        DispatchStop(
          stopId: 1,
          sequence: 1,
          stopLocation: '244 Blair Rd & Montreal Rd',
          stopType: 'home_pickup',
          isSchoolStop: false,
          plannedTime: '07:25 AM',
          arrivedTime: isPast ? '07:23 AM' : null,
          isArrived: isPast,
          students: [
            studentsPool[0].copyWith(
              pickupStatus: isPast ? 'picked_up' : 'pending',
              pickupTime: isPast ? '07:24 AM' : null,
            ),
            studentsPool[1].copyWith(
              pickupStatus: isPast ? 'picked_up' : 'pending',
              pickupTime: isPast ? '07:24 AM' : null,
            ),
          ],
        ),
        DispatchStop(
          stopId: 2,
          sequence: 2,
          stopLocation: '158 Bathgate Dr & Den Ave',
          stopType: 'home_pickup',
          isSchoolStop: false,
          plannedTime: '07:40 AM',
          arrivedTime: isPast ? '07:38 AM' : null,
          isArrived: isPast,
          students: [
            studentsPool[2].copyWith(
              pickupStatus: isPast ? 'picked_up' : 'pending',
              pickupTime: isPast ? '07:39 AM' : null,
            ),
            studentsPool[3].copyWith(
              pickupStatus: isPast ? 'picked_up' : 'pending',
              pickupTime: isPast ? '07:40 AM' : null,
            ),
          ],
        ),
        DispatchStop(
          stopId: 3,
          sequence: 3,
          stopLocation: 'Colonel By Secondary School (Bus Bay 4)',
          stopType: 'school_dropoff',
          isSchoolStop: true,
          schoolName: 'Colonel By Secondary School',
          plannedTime: '08:05 AM',
          arrivedTime: isPast ? '08:02 AM' : null,
          isArrived: isPast,
          students: studentsPool
              .map((s) => s.copyWith(
                    pickupStatus: isPast ? 'picked_up' : 'pending',
                    dropoffStatus: isPast ? 'dropped_off' : 'pending',
                    dropoffTime: isPast ? '08:06 AM' : null,
                  ))
              .toList(),
        ),
      ];
    } else {
      // Afternoon Run: School Pickup -> Home Dropoff stops
      stops = [
        DispatchStop(
          stopId: 1,
          sequence: 1,
          stopLocation: 'Colonel By Secondary School (Bus Bay 4)',
          stopType: 'school_pickup',
          isSchoolStop: true,
          schoolName: 'Colonel By Secondary School',
          plannedTime: '03:00 PM',
          arrivedTime: isPast ? '02:55 PM' : null,
          isArrived: isPast,
          students: studentsPool
              .map((s) => s.copyWith(
                    pickupStatus: isPast ? 'picked_up' : 'pending',
                    pickupTime: isPast ? '03:02 PM' : null,
                  ))
              .toList(),
        ),
        DispatchStop(
          stopId: 2,
          sequence: 2,
          stopLocation: '158 Bathgate Dr & Den Ave',
          stopType: 'home_dropoff',
          isSchoolStop: false,
          plannedTime: '03:25 PM',
          arrivedTime: isPast ? '03:22 PM' : null,
          isArrived: isPast,
          students: [
            studentsPool[2].copyWith(
              pickupStatus: isPast ? 'picked_up' : 'pending',
              dropoffStatus: isPast ? 'dropped_off' : 'pending',
              dropoffTime: isPast ? '03:24 PM' : null,
            ),
            studentsPool[3].copyWith(
              pickupStatus: isPast ? 'picked_up' : 'pending',
              dropoffStatus: isPast ? 'dropped_off' : 'pending',
              dropoffTime: isPast ? '03:25 PM' : null,
            ),
          ],
        ),
        DispatchStop(
          stopId: 3,
          sequence: 3,
          stopLocation: '244 Blair Rd & Montreal Rd',
          stopType: 'home_dropoff',
          isSchoolStop: false,
          plannedTime: '03:45 PM',
          arrivedTime: isPast ? '03:43 PM' : null,
          isArrived: isPast,
          students: [
            studentsPool[0].copyWith(
              pickupStatus: isPast ? 'picked_up' : 'pending',
              dropoffStatus: isPast ? 'dropped_off' : 'pending',
              dropoffTime: isPast ? '03:44 PM' : null,
            ),
            studentsPool[1].copyWith(
              pickupStatus: isPast ? 'picked_up' : 'pending',
              dropoffStatus: isPast ? 'dropped_off' : 'pending',
              dropoffTime: isPast ? '03:45 PM' : null,
            ),
          ],
        ),
      ];
    }

    return DispatchRecord(
      id: id,
      date: dateStr,
      routeId: 'RT-001',
      routeNo: routeNo,
      routeName: routeName,
      shiftType: shiftType,
      driverId: 'DRV-1021',
      driverName: driverName,
      attendantName: 'Claire Dufresne',
      attendantPhone: '+1 (613) 555-0184',
      attendantStatus: !isPast ? 'online' : 'offline',
      attendantLastActive: !isPast ? 'Logged in · In attendance' : 'Logged out',
      vehicleUnit: vehicleUnit,
      status: status,
      checkInTime: checkInTime,
      checkOutTime: checkOutTime,
      stops: stops,
    );
  }
}
