import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/api_config.dart';
import '../../dispatch/repository/dispatch_repository.dart';
import '../models/student_incident_model.dart';

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
        _httpClient = httpClient ?? http.Client();

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

  // ─── Fetch Reports ────────────────────────────────────────────────────────

  Future<List<StudentIncident>> getStudentIncidents({
    String? driverId,
    int? studentId,
    String? routeNo,
  }) async {
    // 1. Try REST API
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
        final List list = jsonDecode(res.body);
        final reports = list
            .map((item) =>
                StudentIncident.fromMap(Map<String, dynamic>.from(item as Map)))
            .toList();

        _cacheReports(reports);
        return reports;
      }
    } catch (e) {
      debugPrint('[StudentIncidentRepository] REST getStudentIncidents error: $e');
    }

    // 2. Try Firestore fallback
    try {
      final fs = _firestore;
      if (fs != null) {
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
        final reports = snap.docs.map((d) {
          final data = d.data() as Map<String, dynamic>;
          return StudentIncident.fromMap(data, docId: d.id);
        }).toList();

        _cacheReports(reports);
        return reports;
      }
    } catch (e) {
      debugPrint('[StudentIncidentRepository] Firestore getStudentIncidents error: $e');
    }

    // 3. Fallback to Hive cache
    return _getCachedReports(driverId: driverId, studentId: studentId, routeNo: routeNo);
  }

  // ─── Submit Report ────────────────────────────────────────────────────────

  Future<StudentIncident> submitStudentIncident(StudentIncident incident) async {
    // 1. Try REST
    try {
      final uri = Uri.parse('$_baseUrl/student-incidents');
      final body = jsonEncode(incident.toCreatePayload());

      final res = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: body,
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final created = StudentIncident.fromMap(data);
        _saveToCache(created);
        return created;
      }
    } catch (e) {
      debugPrint('[StudentIncidentRepository] REST submitStudentIncident error: $e');
    }

    // 2. Try Firestore
    try {
      final fs = _firestore;
      if (fs != null) {
        final col = fs.collection('student_incidents');
        final docRef = incident.id.isNotEmpty && !incident.id.startsWith('temp-')
            ? col.doc(incident.id)
            : col.doc();

        final updated = incident.copyWith(
          id: docRef.id,
          createdAt: DateTime.now().toUtc(),
          updatedAt: DateTime.now().toUtc(),
        );

        await docRef.set(updated.toMap());
        _saveToCache(updated);
        return updated;
      }
    } catch (e) {
      debugPrint('[StudentIncidentRepository] Firestore submitStudentIncident error: $e');
    }

    // 3. Offline fallback
    final offlineIncident = incident.copyWith(
      id: incident.id.isNotEmpty
          ? incident.id
          : 'offline-${DateTime.now().millisecondsSinceEpoch}',
      createdAt: DateTime.now().toUtc(),
      updatedAt: DateTime.now().toUtc(),
    );
    _saveToCache(offlineIncident);
    return offlineIncident;
  }

  // ─── Hive Cache Helpers ───────────────────────────────────────────────────

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
