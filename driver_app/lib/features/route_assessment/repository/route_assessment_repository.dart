import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/network/api_client.dart';
import '../../../core/api_config.dart';
import '../models/route_assessment_model.dart';

class RouteAssessmentRepository {
  static const String _boxName = 'driver_route_assessments_v1';
  static String get _baseUrl => ApiConfig.dispatchApiUrl;

  Box? _box;
  final FirebaseFirestore? _firestoreOverride;
  final http.Client _httpClient;

  RouteAssessmentRepository({
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
      debugPrint('[RouteAssessmentRepository] Hive init error: $e');
    }
  }

  // ─── Fetch Assessments ───────────────────────────────────────────────────

  Future<List<RouteAssessmentModel>> getRouteAssessments({
    String? employeeId,
    String? routeId,
  }) async {
    // 1. Try REST API
    try {
      final params = <String>[];
      if (employeeId != null && employeeId.isNotEmpty) {
        params.add('employeeId=$employeeId');
      }
      if (routeId != null && routeId.isNotEmpty) {
        params.add('routeId=$routeId');
      }
      final query = params.isNotEmpty ? '?${params.join('&')}' : '';
      final uri = Uri.parse('$_baseUrl/route-assessments$query');
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as List<dynamic>;
        final assessments = data
            .map((e) => RouteAssessmentModel.fromJson(e as Map<String, dynamic>))
            .toList();
        await _cacheAssessmentsLocally(assessments);
        return assessments;
      }
    } catch (e) {
      debugPrint('[RouteAssessmentRepository] REST get failed: $e');
    }

    // 2. Try Firestore
    final fs = _firestore;
    if (fs != null) {
      try {
        Query q = fs.collection('route_assessments');
        if (employeeId != null && employeeId.isNotEmpty) {
          q = q.where('conductedByEmployeeId', isEqualTo: employeeId);
        }
        if (routeId != null && routeId.isNotEmpty) {
          q = q.where('routeId', isEqualTo: routeId);
        }
        final snap = await q.get().timeout(const Duration(seconds: 5));
        final assessments = snap.docs
            .map((d) => RouteAssessmentModel.fromJson(
                  d.data() as Map<String, dynamic>,
                  d.id,
                ))
            .toList();
        assessments.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        await _cacheAssessmentsLocally(assessments);
        return assessments;
      } catch (e) {
        debugPrint('[RouteAssessmentRepository] Firestore get failed: $e');
      }
    }

    // 3. Fallback to Hive cache
    return _getCachedAssessments(employeeId: employeeId, routeId: routeId);
  }

  // ─── Submit Assessment ───────────────────────────────────────────────────

  Future<RouteAssessmentModel> submitRouteAssessment(RouteAssessmentModel assessment) async {
    final now = DateTime.now();
    final clientGeneratedId = assessment.id.isNotEmpty
        ? assessment.id
        : 'ra-${now.millisecondsSinceEpoch}';
    final toSubmit = assessment.copyWith(
      id: clientGeneratedId,
      createdAt: assessment.createdAt,
      updatedAt: now,
    );

    // 1. Try REST API
    try {
      final uri = Uri.parse('$_baseUrl/route-assessments');
      final res = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(toSubmit.toJson()),
          )
          .timeout(const Duration(seconds: 5));

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final saved = RouteAssessmentModel.fromJson(data, data['id']?.toString());
        await _upsertLocalCache(saved);

        // Dual-write to Firestore for instant 0-second sync
        final fs = _firestore;
        if (fs != null) {
          try {
            await fs
                .collection('route_assessments')
                .doc(saved.id)
                .set(saved.toJson())
                .timeout(const Duration(seconds: 4));
          } catch (e) {
            debugPrint('[RouteAssessmentRepository] Firestore dual-sync skipped: $e');
          }
        }
        return saved;
      } else {
        debugPrint('[RouteAssessmentRepository] REST submit returned status ${res.statusCode}: ${res.body}');
      }
    } catch (e) {
      debugPrint('[RouteAssessmentRepository] REST submit failed: $e');
    }

    // 2. Try Firestore direct
    final fs = _firestore;
    if (fs != null) {
      try {
        final docRef = fs.collection('route_assessments').doc(clientGeneratedId);
        await docRef.set(toSubmit.toJson()).timeout(const Duration(seconds: 5));
        await _upsertLocalCache(toSubmit);
        return toSubmit;
      } catch (e) {
        // Fall back gracefully if unauthenticated client write is denied
      }
    }

    // 3. Offline cache fallback
    await _upsertLocalCache(toSubmit);
    return toSubmit;
  }

  // ─── Real-Time Stream ────────────────────────────────────────────────────

  Stream<List<RouteAssessmentModel>> watchRouteAssessments({String? employeeId}) {
    final controller = StreamController<List<RouteAssessmentModel>>();
    Timer? pollingTimer;
    StreamSubscription? firestoreSub;

    Future<void> syncAssessments() async {
      try {
        final assessments = await getRouteAssessments(employeeId: employeeId);
        if (!controller.isClosed) {
          controller.add(assessments);
        }
      } catch (_) {}
    }

    // 1. Initial immediate emit from cache/REST
    syncAssessments();

    // 2. Real-time Firestore stream with graceful fallback on permission error
    final fs = _firestore;
    if (fs != null) {
      try {
        Query q = fs.collection('route_assessments');
        if (employeeId != null && employeeId.isNotEmpty) {
          q = q.where('conductedByEmployeeId', isEqualTo: employeeId);
        }
        firestoreSub = q.snapshots().listen(
          (snap) {
            final assessments = snap.docs
                .map((d) => RouteAssessmentModel.fromJson(
                      d.data() as Map<String, dynamic>,
                      d.id,
                    ))
                .toList();
            assessments.sort((a, b) => b.createdAt.compareTo(a.createdAt));
            _cacheAssessmentsLocally(assessments);
            if (!controller.isClosed) {
              controller.add(assessments);
            }
          },
          onError: (err) {
            // Fall back to polling on Firestore permission/network error
            if (pollingTimer == null || !pollingTimer!.isActive) {
              pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncAssessments());
            }
          },
          cancelOnError: false,
        );
      } catch (_) {
        pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncAssessments());
      }
    } else {
      pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncAssessments());
    }

    controller.onCancel = () {
      firestoreSub?.cancel();
      pollingTimer?.cancel();
    };

    return controller.stream;
  }

  // ─── Local Cache Helpers ─────────────────────────────────────────────────

  Future<void> _cacheAssessmentsLocally(List<RouteAssessmentModel> items) async {
    final box = _box;
    if (box == null) return;
    try {
      final map = <String, String>{};
      for (final item in items) {
        map[item.id] = jsonEncode(item.toJson());
      }
      await box.putAll(map);
    } catch (e) {
      debugPrint('[RouteAssessmentRepository] Cache write error: $e');
    }
  }

  Future<void> _upsertLocalCache(RouteAssessmentModel item) async {
    final box = _box;
    if (box == null) return;
    try {
      await box.put(item.id, jsonEncode(item.toJson()));
    } catch (e) {
      debugPrint('[RouteAssessmentRepository] Cache single write error: $e');
    }
  }

  List<RouteAssessmentModel> _getCachedAssessments({
    String? employeeId,
    String? routeId,
  }) {
    final box = _box;
    if (box == null) return [];
    try {
      final results = <RouteAssessmentModel>[];
      for (final key in box.keys) {
        final raw = box.get(key);
        if (raw is String) {
          final decoded = jsonDecode(raw) as Map<String, dynamic>;
          final model = RouteAssessmentModel.fromJson(decoded, key.toString());
          if (employeeId != null &&
              employeeId.isNotEmpty &&
              model.conductedByEmployeeId != employeeId) {
            continue;
          }
          if (routeId != null && routeId.isNotEmpty && model.routeId != routeId) {
            continue;
          }
          results.add(model);
        }
      }
      results.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return results;
    } catch (e) {
      debugPrint('[RouteAssessmentRepository] Cache read error: $e');
      return [];
    }
  }
}
