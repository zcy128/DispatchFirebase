import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/api_config.dart';
import '../../../core/network/api_client.dart';
import '../models/route_model.dart';

class RouteRepository {
  static const String boxName = 'driver_routes_v1';
  static String get defaultApiBase => ApiConfig.baseUrl;

  final String apiBaseUrl;
  final http.Client _httpClient;
  Box<String>? _box;

  bool get isFirestoreAvailable {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  RouteRepository({
    String? apiBaseUrl,
    http.Client? httpClient,
  })  : apiBaseUrl = apiBaseUrl ?? defaultApiBase,
        _httpClient = httpClient ?? AuthenticatedHttpClient.instance;

  Future<void> init() async {
    _box = await Hive.openBox<String>(boxName);
    if (_box!.isEmpty) {
      await _seedDefaultRoute();
    }
  }

  Box<String> get box {
    if (_box == null || !_box!.isOpen) {
      throw StateError('RouteRepository must be initialized before use.');
    }
    return _box!;
  }

  /// Resolves any driver identifier (e.g. driver21d, driver21, drv-21, emp-021)
  /// into a standard employee ID format (e.g. EMP-021).
  static String resolveEmployeeId(String input) {
    final clean = input.trim();
    final lower = clean.toLowerCase();
    if (lower == 'driver1d' || lower == 'driver1' || lower == 'drv-1021' || lower == 'emp-2001' || lower == 'emp-001') {
      return 'EMP-2001';
    }
    final match = RegExp(r'^(?:driver|drv-?)(\d+)d?$', caseSensitive: false).firstMatch(lower);
    if (match != null) {
      final numVal = int.tryParse(match.group(1)!);
      if (numVal != null) {
        return 'EMP-${numVal.toString().padLeft(3, '0')}';
      }
    }
    if (lower.startsWith('emp-')) {
      final numVal = int.tryParse(lower.substring(4));
      if (numVal != null) {
        return 'EMP-${numVal.toString().padLeft(3, '0')}';
      }
    }
    return clean.toUpperCase();
  }

  /// Checks if two driver identifiers reference the same person.
  static bool matchesDriver(String driverA, String driverB) {
    final normA = driverA.trim().toLowerCase();
    final normB = driverB.trim().toLowerCase();
    if (normA == normB) return true;
    final empA = resolveEmployeeId(driverA);
    final empB = resolveEmployeeId(driverB);
    return empA.isNotEmpty && empA == empB;
  }

  Future<DriverRouteInfo?> getAssignedRoute(String driverId) async {
    final normalized = driverId.toLowerCase().trim();
    for (final rawJson in box.values) {
      try {
        final route = DriverRouteInfo.fromJson(rawJson);
        final routeDriver = route.driverId.toLowerCase().trim();
        if (routeDriver == normalized || matchesDriver(routeDriver, normalized)) {
          return route;
        }
        // Match aliases for Driver 1 (driver1d, EMP-2001, EMP-001, DRV-1021)
        final isDriver1Alias = normalized == 'driver1d' ||
            normalized == 'driver1' ||
            normalized == 'emp-2001' ||
            normalized == 'emp-001' ||
            normalized == 'drv-1021';
        final isRouteDriver1Alias = routeDriver == 'emp-2001' ||
            routeDriver == 'emp-001' ||
            routeDriver == 'driver1d' ||
            routeDriver == 'drv-1021';
        if (isDriver1Alias && isRouteDriver1Alias) {
          return route;
        }
      } catch (_) {
        // Skip corrupted entries
      }
    }
    return null;
  }

  Future<DriverRouteInfo?> getRouteForDriver(String driverId) => getAssignedRoute(driverId);

  Future<bool> isRouteAssigned(String driverId) async {
    final route = await getAssignedRoute(driverId);
    return route != null;
  }

  Future<void> saveRoute(DriverRouteInfo route) async {
    await box.put(route.id, route.toJson());
  }

  Future<void> deleteRoute(String routeId) async {
    await box.delete(routeId);
  }

  Future<void> toggleAssignment(String driverId, bool shouldBeAssigned) async {
    if (shouldBeAssigned) {
      await _seedDefaultRoute();
    } else {
      final existing = await getAssignedRoute(driverId);
      if (existing != null) {
        await deleteRoute(existing.id);
      }
    }
  }

  Future<void> toggleRouteAssignment(String driverId, bool shouldBeAssigned) =>
      toggleAssignment(driverId, shouldBeAssigned);

  /// Builds DriverRouteInfo from route and shifts JSON maps.
  static DriverRouteInfo buildRouteInfoFromMap(
    Map<String, dynamic> matchingRoute,
    List<dynamic> shiftsJson,
    String driverId,
  ) {
    final routeId = matchingRoute['id'].toString();
    final shifts = <DriverRouteShift>[];

    for (final s in shiftsJson) {
      final shiftType = (s['shiftType'] ?? 'AM').toString().toUpperCase();
      final rawStops = s['stops'] as List<dynamic>? ?? [];

      // First pass: collect all students assigned across this shift
      final shiftStudentsMap = <int, DriverRouteStudent>{};
      for (final st in rawStops) {
        final rawStudents = st['assignedStudents'] as List<dynamic>? ?? [];
        for (final stu in rawStudents) {
          final sId = stu['studentId'] is int
              ? stu['studentId'] as int
              : int.tryParse(stu['studentId']?.toString() ?? '') ?? 0;
          if (sId > 0) {
            final studentObj = _resolveStudent(sId, stu, st['stopLocation']?.toString() ?? '');
            shiftStudentsMap[sId] = studentObj;
          }
        }
      }
      final allShiftStudents = shiftStudentsMap.values.toList();

      // Second pass: build stops with live times from backend
      final stops = <DriverRouteStop>[];
      for (final st in rawStops) {
        final stopId = st['stopId'] is int
            ? st['stopId'] as int
            : int.tryParse(st['stopId']?.toString() ?? '') ?? 0;
        final sequence = st['sequence'] is int
            ? st['sequence'] as int
            : int.tryParse(st['sequence']?.toString() ?? '') ?? 0;
        final location = st['stopLocation']?.toString() ?? '';
        final rawTime = st['pullawayTime']?.toString() ?? '';
        final formattedTime = formatTimeDisplay(rawTime);
        final stopType = st['stopType']?.toString() ?? 'HomePickup';
        final isSchool = stopType == 'SchoolPickup' || stopType == 'SchoolDropoff';
        final schoolName = st['schoolName']?.toString();
        final instruction = st['comment']?.toString() ??
            (isSchool ? 'School passenger transfer zone' : 'Curbside passenger stop');

        final rawStudents = st['assignedStudents'] as List<dynamic>? ?? [];
        final students = <DriverRouteStudent>[];
        for (final stu in rawStudents) {
          final sId = stu['studentId'] is int
              ? stu['studentId'] as int
              : int.tryParse(stu['studentId']?.toString() ?? '') ?? 0;
          if (sId > 0) {
            students.add(_resolveStudent(sId, stu, location));
          }
        }

        // A school stop with no explicit roster uses the students already
        // assigned to this shift. It does not fall back to the demo roster.
        final stopStudents = (isSchool && students.isEmpty) ? allShiftStudents : students;

        stops.add(DriverRouteStop(
          stopId: stopId,
          sequence: sequence,
          location: location,
          pullawayTime: formattedTime,
          stopType: stopType,
          isSchoolStop: isSchool,
          schoolName: schoolName,
          instruction: instruction,
          latitude: (st['latitude'] as num?)?.toDouble(),
          longitude: (st['longitude'] as num?)?.toDouble(),
          students: stopStudents,
        ));
      }

      stops.sort((a, b) => a.sequence.compareTo(b.sequence));

      shifts.add(DriverRouteShift(
        shiftId: s['id']?.toString() ?? s['shiftId']?.toString() ?? 'SHIFT-$shiftType',
        shiftType: shiftType,
        shiftName: s['routeName']?.toString() ?? '$shiftType Shift',
        runDays: s['runDays']?.toString() ?? 'MTWRF',
        firstStopTime: formatTimeDisplay(s['firstStopTime']?.toString() ?? ''),
        lastStopTime: formatTimeDisplay(s['lastStopTime']?.toString() ?? ''),
        schoolsServiced: matchingRoute['routeName']?.toString() ?? '',
        stops: stops,
      ));
    }

    return DriverRouteInfo(
      id: routeId,
      routeNo: matchingRoute['routeNo']?.toString() ?? '',
      routeName: matchingRoute['routeName']?.toString() ?? '',
      schoolBoard: matchingRoute['schoolBoardCode']?.toString() ?? '',
      yardName: matchingRoute['yardName']?.toString() ?? '',
      driverId: matchingRoute['driverId']?.toString() ?? driverId,
      driverName: matchingRoute['driverName']?.toString() ?? '',
      vehicleUnit: matchingRoute['unitNumber']?.toString() ?? '',
      plateNumber: matchingRoute['plateNumber']?.toString() ?? '',
      attendantName: matchingRoute['attendantName']?.toString() ?? '',
      attendantPhone: matchingRoute['attendantPhone']?.toString() ?? '',
      attendantStatus: matchingRoute['attendantStatus']?.toString() ?? '',
      instructions: matchingRoute['instructions']?.toString() ??
          matchingRoute['comment']?.toString() ??
          '',
      shifts: shifts,
    );
  }

  /// Listens to real-time route & stop updates directly from Firestore routes & route_shifts collections.
  Stream<DriverRouteInfo?> watchRouteForDriver(String driverId) {
    final normalized = driverId.toLowerCase().trim();

    if (!isFirestoreAvailable) {
      return const Stream.empty();
    }

    try {
      late StreamController<DriverRouteInfo?> controller;
      StreamSubscription? routesSub;
      StreamSubscription? shiftsSub;
      String? currentListeningRouteId;

      final cleanDriver = driverId.trim();
      final empId = resolveEmployeeId(cleanDriver);
      final queryKeys = <String>{
        cleanDriver,
        normalized,
        if (empId.isNotEmpty) empId,
        if (empId.isNotEmpty) empId.toLowerCase(),
      }.where((s) => s.isNotEmpty && s != 'tbd' && s != 'unassigned').toList();

      controller = StreamController<DriverRouteInfo?>(
        onListen: () {
          final query = queryKeys.isNotEmpty
              ? FirebaseFirestore.instance
                  .collection('routes')
                  .where('assignedEmployeeIds', arrayContainsAny: queryKeys)
              : FirebaseFirestore.instance.collection('routes');

          routesSub = query.snapshots().listen((routesSnap) {
            Map<String, dynamic>? matchingRoute;

            for (final doc in routesSnap.docs) {
              final data = Map<String, dynamic>.from(doc.data());
              data['id'] = doc.id;
              final rDriverId = (data['driverId'] ?? '').toString();
              final rDriverName = (data['driverName'] ?? '').toString();
              final matches = matchesDriver(rDriverId, normalized) ||
                  matchesDriver(rDriverName, normalized);
              if (matches) {
                matchingRoute = data;
                break;
              }
            }

            if (matchingRoute == null) {
              shiftsSub?.cancel();
              shiftsSub = null;
              currentListeningRouteId = null;
              if (!controller.isClosed) controller.add(null);
              return;
            }

            final routeId = matchingRoute['id'].toString();

            if (shiftsSub == null || currentListeningRouteId != routeId) {
              shiftsSub?.cancel();
              currentListeningRouteId = routeId;
              final routeMeta = matchingRoute;

              shiftsSub = FirebaseFirestore.instance
                  .collection('route_shifts')
                  .where('routeId', isEqualTo: routeId)
                  .snapshots()
                  .listen((shiftsSnap) async {
                final shiftsJson = shiftsSnap.docs.map((d) {
                  final sData = Map<String, dynamic>.from(d.data());
                  sData['id'] = d.id;
                  return sData;
                }).toList();

                final liveRoute = buildRouteInfoFromMap(routeMeta, shiftsJson, normalized);
                await cacheLiveRoute(liveRoute);
                if (!controller.isClosed) controller.add(liveRoute);
              }, onError: (err) {
                debugPrint('[Firestore Route Shifts] Stream error: $err');
              });
            }
          }, onError: (err) {
            debugPrint('[Firestore Routes] Stream error: $err');
            getAssignedRoute(driverId).then((cached) {
              if (!controller.isClosed) controller.add(cached);
            });
          });
        },
        onCancel: () {
          shiftsSub?.cancel();
          routesSub?.cancel();
        },
      );

      return controller.stream;
    } catch (e) {
      debugPrint('[Firestore Realtime Route] Fallback to cache: $e');
      return Stream.fromFuture(getAssignedRoute(driverId));
    }
  }

  /// Synchronizes live route and stop times directly from backend Dispatch API.
  /// Automatically updates local Hive cache so offline access remains functional.
  Future<DriverRouteInfo?> syncRouteFromBackend(String driverId) async {
    try {
      final normalized = driverId.toLowerCase().trim();
      var urlStr = '$apiBaseUrl/api/public/routes';
      if (normalized.isNotEmpty) {
        urlStr += '?driver=${Uri.encodeComponent(normalized)}';
      }
      final routesUri = Uri.parse(urlStr);
      final res = await _httpClient.get(routesUri).timeout(const Duration(seconds: 4));
      if (res.statusCode != 200) return null;

      final List<dynamic> routesJson = jsonDecode(res.body);
      Map<String, dynamic>? matchingRoute;

      for (final r in routesJson) {
        final rDriverId = (r['driverId'] ?? '').toString();
        final rDriverName = (r['driverName'] ?? '').toString();
        final matches = matchesDriver(rDriverId, normalized) ||
            matchesDriver(rDriverName, normalized);
        if (matches) {
          matchingRoute = Map<String, dynamic>.from(r as Map);
          break;
        }
      }

      if (matchingRoute == null) return null;
      final routeId = matchingRoute['id'].toString();

      // Fetch live shifts with detailed stops and updated pullaway times
      final shiftsUri = Uri.parse('$apiBaseUrl/api/public/routes/$routeId/shifts');
      final shiftsRes = await _httpClient.get(shiftsUri).timeout(const Duration(seconds: 4));
      if (shiftsRes.statusCode != 200) return null;

      final List<dynamic> shiftsJson = jsonDecode(shiftsRes.body);
      final liveRoute = buildRouteInfoFromMap(matchingRoute, shiftsJson, normalized);

      await cacheLiveRoute(liveRoute);
      return liveRoute;
    } catch (_) {
      // Offline fallback: returns null, calling layers will use cached Hive route
      return null;
    }
  }

  static DriverRouteStudent _resolveStudent(int studentId, dynamic rawJson, String fallbackAddress) {
    final payload = rawJson is Map ? rawJson : const <String, dynamic>{};
    return DriverRouteStudent(
      studentId: studentId,
      studentNo: payload['studentNo']?.toString() ?? 'STU-$studentId',
      name: payload['studentName']?.toString() ??
          payload['name']?.toString() ??
          'Student #$studentId',
      grade: payload['grade']?.toString() ?? '',
      schoolName: payload['schoolName']?.toString() ?? '',
      address: payload['address']?.toString().trim().isNotEmpty == true
          ? payload['address'].toString()
          : fallbackAddress,
      guardianName: payload['guardianName']?.toString(),
      guardianPhone: payload['guardianPhone']?.toString(),
      specialNeeds: payload['specialNeeds']?.toString(),
    );
  }

  /// Stores a route returned by the server and drops other cached routes
  /// for the same driver, including the offline demo seed.
  Future<void> cacheLiveRoute(DriverRouteInfo route) async {
    final staleKeys = <dynamic>[];
    for (final key in box.keys) {
      final raw = box.get(key);
      if (raw == null) continue;
      try {
        final existing = DriverRouteInfo.fromJson(raw);
        if (existing.id != route.id && matchesDriver(existing.driverId, route.driverId)) {
          staleKeys.add(key);
        }
      } catch (_) {}
    }
    await saveRoute(route);
    for (final key in staleKeys) {
      await box.delete(key);
    }
  }

  static String formatTimeDisplay(String raw) {
    if (raw.trim().isEmpty) return '';
    final upper = raw.toUpperCase().trim();
    if (upper.contains('AM') || upper.contains('PM')) return raw;
    final parts = raw.split(':');
    if (parts.length >= 2) {
      final hour = int.tryParse(parts[0]) ?? 0;
      final minute = parts[1].padLeft(2, '0');
      final isPM = hour >= 12;
      final displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
      final period = isPM ? 'PM' : 'AM';
      return '${displayHour.toString().padLeft(2, '0')}:$minute $period';
    }
    return raw;
  }

  static const Map<int, DriverRouteStudent> _knownStudents = {
    9: DriverRouteStudent(
      studentId: 9,
      studentNo: '0009',
      name: 'Noah Garcia',
      grade: 'Gr 4',
      schoolName: 'Hillcrest High School',
      address: '9430 Merivale Rd, Kanata, ON',
      guardianName: 'Carlos Garcia',
      guardianPhone: '+1 (613) 555-0821',
    ),
    10: DriverRouteStudent(
      studentId: 10,
      studentNo: '0010',
      name: 'Noah Jackson',
      grade: 'Gr 6',
      schoolName: 'Hillcrest High School',
      address: '4771 Oak St, Gloucester, ON',
      guardianName: 'Amanda Jackson',
      guardianPhone: '+1 (613) 555-0433',
    ),
    5: DriverRouteStudent(
      studentId: 5,
      studentNo: '0005',
      name: 'Olivia Gonzalez',
      grade: 'JK',
      schoolName: 'Hillcrest High School',
      address: '1041 Carling Ave, Orleans, ON',
      guardianName: 'Maria Gonzalez',
      guardianPhone: '+1 (613) 555-0744',
    ),
    4: DriverRouteStudent(
      studentId: 4,
      studentNo: '0004',
      name: 'Evelyn Jackson',
      grade: 'JK',
      schoolName: 'Hillcrest High School',
      address: '8495 Pine Rd, Ottawa, ON',
      guardianName: 'Amanda Jackson',
      guardianPhone: '+1 (613) 555-0433',
    ),
    6: DriverRouteStudent(
      studentId: 6,
      studentNo: '0006',
      name: 'Benjamin Johnson',
      grade: 'Gr 3',
      schoolName: 'Hillcrest High School',
      address: '4883 Cedar Blvd, Gloucester, ON',
      guardianName: 'David Johnson',
      guardianPhone: '+1 (613) 555-0612',
    ),
    3: DriverRouteStudent(
      studentId: 3,
      studentNo: '0003',
      name: 'Olivia Jackson',
      grade: 'SK',
      schoolName: 'Hillcrest High School',
      address: '5641 Carling Ave, Ottawa, ON',
      guardianName: 'Amanda Jackson',
      guardianPhone: '+1 (613) 555-0433',
    ),
  };

  Future<void> _seedDefaultRoute() async {
    final amStops = [
      DriverRouteStop(
        stopId: 1,
        sequence: 1,
        location: '9430 Merivale Rd, Kanata, ON',
        pullawayTime: '07:30 AM',
        stopType: 'HomePickup',
        isSchoolStop: false,
        instruction: 'Pick up student on driveway curbside.',
        students: [_knownStudents[9]!],
      ),
      DriverRouteStop(
        stopId: 2,
        sequence: 2,
        location: '4771 Oak St, Gloucester, ON',
        pullawayTime: '07:38 AM',
        stopType: 'HomePickup',
        isSchoolStop: false,
        instruction: 'Residential street, watch for pedestrians.',
        students: [_knownStudents[10]!],
      ),
      DriverRouteStop(
        stopId: 3,
        sequence: 3,
        location: '1041 Carling Ave, Orleans, ON',
        pullawayTime: '07:46 AM',
        stopType: 'HomePickup',
        isSchoolStop: false,
        instruction: 'Pull onto service lane safely.',
        students: [_knownStudents[5]!],
      ),
      DriverRouteStop(
        stopId: 4,
        sequence: 4,
        location: '8495 Pine Rd, Ottawa, ON',
        pullawayTime: '07:54 AM',
        stopType: 'HomePickup',
        isSchoolStop: false,
        instruction: 'Sibling pickup with guardian waiting.',
        students: [_knownStudents[4]!],
      ),
      DriverRouteStop(
        stopId: 5,
        sequence: 5,
        location: '4883 Cedar Blvd, Gloucester, ON',
        pullawayTime: '08:02 AM',
        stopType: 'HomePickup',
        isSchoolStop: false,
        instruction: 'Wait until student safely ascends bus steps.',
        students: [_knownStudents[6]!],
      ),
      DriverRouteStop(
        stopId: 6,
        sequence: 6,
        location: '5641 Carling Ave, Ottawa, ON',
        pullawayTime: '08:12 AM',
        stopType: 'HomePickup',
        isSchoolStop: false,
        instruction: 'Parents assist student at vehicle door.',
        students: [_knownStudents[3]!],
      ),
      DriverRouteStop(
        stopId: 7,
        sequence: 7,
        location: '1900 Dauphin Rd, Ottawa, ON K1G 2L7',
        pullawayTime: '08:30 AM',
        stopType: 'SchoolDropoff',
        isSchoolStop: true,
        schoolName: 'Hillcrest High School',
        instruction: 'Park at main school bus loading zone. Hand off students to staff.',
        students: _knownStudents.values.toList(),
      ),
    ];

    final pmStops = [
      DriverRouteStop(
        stopId: 1,
        sequence: 1,
        location: '9402 Maple Ave, Nepean, ON',
        pullawayTime: '02:45 PM',
        stopType: 'SchoolPickup',
        isSchoolStop: true,
        schoolName: 'Hillcrest High School',
        instruction: 'Arrive 10 minutes prior to school bell. Load assigned roster.',
        students: _knownStudents.values.toList(),
      ),
      DriverRouteStop(
        stopId: 2,
        sequence: 2,
        location: '5641 Carling Ave, Ottawa, ON',
        pullawayTime: '03:00 PM',
        stopType: 'HomeDropoff',
        isSchoolStop: false,
        instruction: 'Ensure parent is visible before discharging.',
        students: [_knownStudents[3]!],
      ),
      DriverRouteStop(
        stopId: 3,
        sequence: 3,
        location: '4883 Cedar Blvd, Gloucester, ON',
        pullawayTime: '03:06 PM',
        stopType: 'HomeDropoff',
        isSchoolStop: false,
        instruction: 'Crosswalk safety check before pullaway.',
        students: [_knownStudents[6]!],
      ),
      DriverRouteStop(
        stopId: 4,
        sequence: 4,
        location: '8495 Pine Rd, Ottawa, ON',
        pullawayTime: '03:15 PM',
        stopType: 'HomeDropoff',
        isSchoolStop: false,
        instruction: 'Ensure stop arm remains extended during discharge.',
        students: [_knownStudents[4]!],
      ),
      DriverRouteStop(
        stopId: 5,
        sequence: 5,
        location: '1041 Carling Ave, Orleans, ON',
        pullawayTime: '03:19 PM',
        stopType: 'HomeDropoff',
        isSchoolStop: false,
        instruction: 'Residential dropoff.',
        students: [_knownStudents[5]!],
      ),
      DriverRouteStop(
        stopId: 6,
        sequence: 6,
        location: '4771 Oak St, Gloucester, ON',
        pullawayTime: '03:26 PM',
        stopType: 'HomeDropoff',
        isSchoolStop: false,
        instruction: 'Parent waiting at sidewalk.',
        students: [_knownStudents[10]!],
      ),
      DriverRouteStop(
        stopId: 7,
        sequence: 7,
        location: '9430 Merivale Rd, Kanata, ON',
        pullawayTime: '03:33 PM',
        stopType: 'HomeDropoff',
        isSchoolStop: false,
        instruction: 'Final student discharge. Post-trip child check required immediately.',
        students: [_knownStudents[9]!],
      ),
    ];

    final defaultRoute = DriverRouteInfo(
      id: 'RT-001',
      routeNo: 'OCDSB-001',
      routeName: 'Route 001 - Hillcrest High School',
      schoolBoard: 'OCDSB',
      yardName: 'Yard 1',
      driverId: 'EMP-2001',
      driverName: 'David Miller',
      vehicleUnit: '1001',
      plateNumber: 'ON-1001',
      attendantName: 'Sarah Connor',
      attendantPhone: '613-555-0999',
      attendantStatus: 'online',
      instructions: 'Hillcrest High School main bay dropoff. Be mindful of Merivale Rd morning peak traffic.',
      shifts: [
        DriverRouteShift(
          shiftId: 'SHIFT-001-AM',
          shiftType: 'AM',
          shiftName: 'Morning Inbound',
          runDays: 'MTWRF',
          firstStopTime: '07:30 AM',
          lastStopTime: '08:30 AM',
          schoolsServiced: 'Hillcrest High School',
          stops: amStops,
        ),
        DriverRouteShift(
          shiftId: 'SHIFT-001-PM',
          shiftType: 'PM',
          shiftName: 'Afternoon Outbound',
          runDays: 'MTWRF',
          firstStopTime: '02:45 PM',
          lastStopTime: '03:33 PM',
          schoolsServiced: 'Hillcrest High School',
          stops: pmStops,
        ),
      ],
    );

    await saveRoute(defaultRoute);
  }
}
