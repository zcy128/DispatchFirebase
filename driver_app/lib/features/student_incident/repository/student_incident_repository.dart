import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/network/api_client.dart';
import '../../../core/api_config.dart';
import '../../dispatch/repository/dispatch_repository.dart';
import '../models/student_incident_model.dart';

class StudentIncidentLookupException implements Exception {
  final String message;

  const StudentIncidentLookupException(this.message);

  @override
  String toString() => message;
}

String _studentIncidentSubmitError(int statusCode, String body) {
  try {
    final decoded = jsonDecode(body);
    if (decoded is Map && decoded['error'] != null) {
      final message = decoded['error'].toString().trim();
      if (message.isNotEmpty) return message;
    }
  } catch (_) {}
  return 'Failed to submit student incident ($statusCode)';
}

class StudentIncidentRepository {
  static const String _boxName = 'driver_student_incidents_v1';
  static String get _baseUrl => ApiConfig.dispatchApiUrl;

  Box? _box;
  final FirebaseFirestore? _firestoreOverride;
  final http.Client _httpClient;

  StudentIncidentRepository({
    FirebaseFirestore? firestore,
    http.Client? httpClient,
  })  : _firestoreOverride = firestore,
        _httpClient = httpClient ?? AuthenticatedHttpClient.instance;

  bool get isFirestoreAvailable {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  FirebaseFirestore? get _firestore {
    if (_firestoreOverride != null) return _firestoreOverride;
    if (!isFirestoreAvailable) return null;
    try {
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  Future<void> init() async {
    try {
      _box = await Hive.openBox(_boxName);
    } catch (e) {
      debugPrint('[StudentIncidentRepository] Hive init error: $e');
    }
  }

  // ─── Extract Roster Students From Dispatches ───────────────────────────────

  List<RosterStudentOption> getRosterStudentsFromDispatches({
    required DateTime date,
    String? driverId,
    required DispatchRepository dispatchRepo,
  }) {
    final dispatches = dispatchRepo.getDispatchesForDate(date, driverId: driverId);
    final options = <RosterStudentOption>[];
    final seen = <String>{};

    for (final dispatch in dispatches) {
      for (final stop in dispatch.stops) {
        for (final student in stop.students) {
          final dedupKey = student.studentId > 0
              ? 'id_${student.studentId}'
              : 'name_${student.studentName.trim().toLowerCase()}';
          if (!seen.add(dedupKey)) continue;

          options.add(
            RosterStudentOption(
              key: dedupKey,
              studentId: student.studentId,
              studentNo: student.studentNo,
              studentName: student.studentName,
              grade: student.grade,
              schoolName: student.schoolName.isNotEmpty
                  ? student.schoolName
                  : (stop.schoolName ?? ''),
              routeNo: dispatch.routeNo,
              routeName: dispatch.routeName,
              routeId: int.tryParse(dispatch.routeId),
              shiftType: dispatch.shiftType,
            ),
          );
        }
      }
    }

    options.sort(
      (a, b) => a.studentName.toLowerCase().compareTo(b.studentName.toLowerCase()),
    );
    return options;
  }

  /// Shift payloads omit grade. Look up the student directory so the report
  /// does not invent a grade.
  Future<List<RosterStudentOption>> fillMissingGrades(
    List<RosterStudentOption> options,
  ) async {
    if (options.isEmpty) return options;
    return Future.wait(options.map((opt) async {
      if (opt.grade.trim().isNotEmpty) return opt;
      final grade = await _lookupStudentGrade(opt);
      if (grade == null || grade.isEmpty) return opt;
      return opt.withGrade(grade);
    }));
  }

  Future<String?> _lookupStudentGrade(RosterStudentOption opt) async {
    final ids = <String>[];
    final studentNo = opt.studentNo.trim();
    if (studentNo.isNotEmpty) {
      ids.add('STU-$studentNo');
    }
    if (opt.studentId > 0) {
      final padded = 'STU-${opt.studentId.toString().padLeft(4, '0')}';
      if (!ids.contains(padded)) ids.add(padded);
    }

    for (final id in ids) {
      try {
        final uri = Uri.parse(
          '${ApiConfig.baseUrl}/api/students/${Uri.encodeComponent(id)}',
        );
        final res = await _httpClient.get(uri).timeout(const Duration(seconds: 6));
        if (res.statusCode != 200) continue;
        final decoded = jsonDecode(res.body);
        if (decoded is Map) {
          final grade = (decoded['grade'] ?? '').toString().trim();
          if (grade.isNotEmpty) return grade;
        }
      } catch (e) {
        debugPrint('[StudentIncidentRepository] grade lookup error: $e');
      }
    }
    return null;
  }

  // ─── Fetch Reports ────────────────────────────────────────────────────────

  /// Confirmed server results, including an empty list.
  /// A failed lookup throws [StudentIncidentLookupException] when nothing is cached.
  Future<List<StudentIncident>> getStudentIncidents({
    String? driverId,
    int? studentId,
    String? routeNo,
  }) async {
    Object? restFailure;
    try {
      final queryParams = <String, String>{};
      if (driverId != null && driverId.isNotEmpty) {
        queryParams['driverId'] = driverId;
      }
      if (studentId != null && studentId > 0) {
        queryParams['studentId'] = studentId.toString();
      }
      if (routeNo != null && routeNo.isNotEmpty) {
        queryParams['routeNo'] = routeNo;
      }

      final uri = Uri.parse('$_baseUrl/student-incidents')
          .replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        if (decoded is! List) {
          throw const StudentIncidentLookupException(
            'Student incident response was not valid.',
          );
        }
        final reports = <StudentIncident>[];
        for (final item in decoded) {
          if (item is! Map) {
            throw const StudentIncidentLookupException(
              'Student incident response was not valid.',
            );
          }
          reports.add(
            StudentIncident.fromMap(Map<String, dynamic>.from(item)),
          );
        }
        final sorted = newestStudentIncidents(reports);
        _replaceCachedReports(
          sorted,
          driverId: driverId,
          studentId: studentId,
          routeNo: routeNo,
        );
        return sorted;
      }
      restFailure = StudentIncidentLookupException(
        'Student incident request failed (${res.statusCode}).',
      );
    } on StudentIncidentLookupException {
      rethrow;
    } catch (e) {
      debugPrint('[StudentIncidentRepository] REST getStudentIncidents error: $e');
      restFailure = e;
    }

    try {
      final fromFirestore = await _reportsFromFirestore(
        driverId: driverId,
        studentId: studentId,
        routeNo: routeNo,
      );
      if (fromFirestore != null && fromFirestore.isNotEmpty) {
        _cacheReports(fromFirestore);
        return newestStudentIncidents(fromFirestore);
      }
    } catch (e) {
      debugPrint(
        '[StudentIncidentRepository] Firestore getStudentIncidents error: $e',
      );
    }

    final cached = _getCachedReports(
      driverId: driverId,
      studentId: studentId,
      routeNo: routeNo,
    );
    if (cached.isNotEmpty) return cached;
    throw StudentIncidentLookupException(
      'Student incidents could not be confirmed: $restFailure',
    );
  }

  Future<List<StudentIncident>?> _reportsFromFirestore({
    String? driverId,
    int? studentId,
    String? routeNo,
  }) async {
    final fs = _firestore;
    if (fs == null) return null;
    Query q = fs.collection('student_incidents');
    if (driverId != null && driverId.isNotEmpty) {
      q = q.where('driverId', isEqualTo: driverId);
    }
    if (studentId != null && studentId > 0) {
      q = q.where('studentId', isEqualTo: studentId);
    }
    if (routeNo != null && routeNo.isNotEmpty) {
      q = q.where('routeNo', isEqualTo: routeNo);
    }
    final snap = await q.get();
    if (snap.docs.isEmpty) return const [];
    return snap.docs.map((d) {
      final data = d.data() as Map<String, dynamic>;
      return StudentIncident.fromMap(data, docId: d.id);
    }).toList();
  }

  // ─── Submit Report ────────────────────────────────────────────────────────

  /// The office record exists only after the API accepts it.
  /// A rejected or unanswered request is not written locally or to Firestore.
  Future<StudentIncident> submitStudentIncident(StudentIncident incident) async {
    if (incident.studentName.trim().isEmpty) {
      throw Exception('A student name is required.');
    }
    if (incident.driverId.trim().isEmpty) {
      throw Exception('A driver is required.');
    }

    final uri = Uri.parse('$_baseUrl/student-incidents');
    final body = jsonEncode(incident.toCreatePayload());

    final http.Response res;
    try {
      res = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: body,
          )
          .timeout(const Duration(seconds: 8));
    } on TimeoutException {
      throw Exception(
        'Failed to submit student incident. The server did not respond.',
      );
    } on http.ClientException {
      throw Exception(
        'Failed to submit student incident. The server did not respond.',
      );
    }

    if (res.statusCode == 200 || res.statusCode == 201) {
      final decoded = jsonDecode(res.body);
      if (decoded is! Map) {
        throw const StudentIncidentLookupException(
          'Student incident response was not valid.',
        );
      }
      final created = StudentIncident.fromMap(Map<String, dynamic>.from(decoded));
      _saveToCache(created);
      return created;
    }
    throw Exception(_studentIncidentSubmitError(res.statusCode, res.body));
  }

  // ─── Hive Cache Helpers ───────────────────────────────────────────────────

  void _replaceCachedReports(
    List<StudentIncident> reports, {
    String? driverId,
    int? studentId,
    String? routeNo,
  }) {
    if (_box == null || !_box!.isOpen) return;
    try {
      final stale = _getCachedReports(
        driverId: driverId,
        studentId: studentId,
        routeNo: routeNo,
      );
      for (final report in stale) {
        _box!.delete(report.id);
      }
      _cacheReports(reports);
    } catch (e) {
      debugPrint('[StudentIncidentRepository] _replaceCachedReports error: $e');
    }
  }

  void _cacheReports(List<StudentIncident> reports) {
    if (_box == null || !_box!.isOpen) return;
    try {
      for (final r in reports) {
        _box!.put(r.id, jsonEncode(r.toMap()));
      }
    } catch (e) {
      debugPrint('[StudentIncidentRepository] _cacheReports error: $e');
    }
  }

  void _saveToCache(StudentIncident report) {
    if (_box == null || !_box!.isOpen) return;
    try {
      _box!.put(report.id, jsonEncode(report.toMap()));
    } catch (e) {
      debugPrint('[StudentIncidentRepository] _saveToCache error: $e');
    }
  }

  List<StudentIncident> _getCachedReports({
    String? driverId,
    int? studentId,
    String? routeNo,
  }) {
    if (_box == null || !_box!.isOpen) return [];
    try {
      final list = <StudentIncident>[];
      for (final key in _box!.keys) {
        final raw = _box!.get(key);
        if (raw is String) {
          final map = jsonDecode(raw) as Map<String, dynamic>;
          final report = StudentIncident.fromMap(map);

          if (driverId != null &&
              driverId.isNotEmpty &&
              report.driverId != driverId) {
            continue;
          }
          if (studentId != null &&
              studentId > 0 &&
              report.studentId != studentId) {
            continue;
          }
          if (routeNo != null &&
              routeNo.isNotEmpty &&
              report.routeNo != routeNo) {
            continue;
          }

          list.add(report);
        }
      }
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    } catch (e) {
      debugPrint('[StudentIncidentRepository] _getCachedReports error: $e');
      return [];
    }
  }
}
