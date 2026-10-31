import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/network/api_client.dart';
import '../../../core/api_config.dart';
import '../models/hazard_report_model.dart';

class HazardReportRepository {
  static const String _boxName = 'driver_hazard_reports_v1';
  static String get _baseUrl => ApiConfig.dispatchApiUrl;

  Box? _box;
  final FirebaseFirestore? _firestoreOverride;
  final http.Client _httpClient;

  HazardReportRepository({
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
      debugPrint('[HazardReportRepository] Hive init error: $e');
    }
  }

  // ─── Fetch Reports ─────────────────────────────────────────────────────────

  Future<List<HazardReportModel>> getHazardReports({String? employeeId}) async {
    // 1. Try REST API
    try {
      final query = employeeId != null && employeeId.isNotEmpty
          ? '?employeeId=$employeeId'
          : '';
      final uri = Uri.parse('$_baseUrl/hazard-reports$query');
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as List<dynamic>;
        final reports = data
            .map((e) => HazardReportModel.fromJson(e as Map<String, dynamic>))
            .toList();
        await _cacheReportsLocally(reports);
        return reports;
      }
    } catch (e) {
      debugPrint('[HazardReportRepository] REST get reports failed: $e');
    }

    // 2. Try Firestore
    final fs = _firestore;
    if (fs != null) {
      try {
        Query q = fs.collection('hazard_reports');
        if (employeeId != null && employeeId.isNotEmpty) {
          q = q.where('reportedByEmployeeId', isEqualTo: employeeId);
        }
        final snap = await q.get().timeout(const Duration(seconds: 5));
        final reports = snap.docs
            .map((d) => HazardReportModel.fromJson(
                  d.data() as Map<String, dynamic>,
                  d.id,
                ))
            .toList();
        reports.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        await _cacheReportsLocally(reports);
        return reports;
      } catch (e) {
        debugPrint('[HazardReportRepository] Firestore get reports failed: $e');
      }
    }

    // 3. Fallback to Local Hive Cache
    return _getCachedReports(employeeId: employeeId);
  }

  // ─── Submit Report ─────────────────────────────────────────────────────────

  Future<HazardReportModel> submitHazardReport(HazardReportModel report) async {
    final now = DateTime.now();
    final clientGeneratedId = report.id.isNotEmpty
        ? report.id
        : 'hazard-${now.millisecondsSinceEpoch}';
    final toSubmit = report.copyWith(
      id: clientGeneratedId,
      createdAt: report.createdAt,
    );

    // 1. Try REST API
    try {
      final uri = Uri.parse('$_baseUrl/hazard-reports');
      final res = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(toSubmit.toJson()),
          )
          .timeout(const Duration(seconds: 5));

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final saved = HazardReportModel.fromJson(data, data['id']?.toString());
        await _upsertLocalCache(saved);

        final fs = _firestore;
        if (fs != null) {
          try {
            await fs
                .collection('hazard_reports')
                .doc(saved.id)
                .set(saved.toJson())
                .timeout(const Duration(seconds: 4));
          } catch (e) {
            debugPrint('[HazardReportRepository] Firestore dual-sync skipped: $e');
          }
        }

        return saved;
      } else {
        debugPrint('[HazardReportRepository] REST submit returned status ${res.statusCode}: ${res.body}');
      }
    } catch (e) {
      debugPrint('[HazardReportRepository] REST submit failed: $e');
    }

    // 2. Try Firestore
    final fs = _firestore;
    if (fs != null) {
      try {
        final docRef = fs.collection('hazard_reports').doc(clientGeneratedId);
        await docRef.set(toSubmit.toJson()).timeout(const Duration(seconds: 5));
        await _upsertLocalCache(toSubmit);
        return toSubmit;
      } catch (e) {
        // Fall back gracefully if unauthenticated client write is denied
      }
    }

    // 3. Offline fallback
    await _upsertLocalCache(toSubmit);
    return toSubmit;
  }

  // ─── Realtime Watch Stream ──────────────────────────────────────────────────

  Stream<List<HazardReportModel>> watchHazardReports({String? employeeId}) {
    final controller = StreamController<List<HazardReportModel>>();
    Timer? pollingTimer;
    StreamSubscription? firestoreSub;

    Future<void> syncReports() async {
      try {
        final reports = await getHazardReports(employeeId: employeeId);
        if (!controller.isClosed) {
          controller.add(reports);
        }
      } catch (_) {}
    }

    // 1. Initial immediate emit from cache/REST
    syncReports();

    // 2. Real-time Firestore sync with graceful fallback on permission error
    final fs = _firestore;
    if (fs != null) {
      try {
        Query q = fs.collection('hazard_reports');
        if (employeeId != null && employeeId.isNotEmpty) {
          q = q.where('reportedByEmployeeId', isEqualTo: employeeId);
        }
        firestoreSub = q.snapshots().listen(
          (snap) {
            final reports = snap.docs
                .map((d) => HazardReportModel.fromJson(
                      d.data() as Map<String, dynamic>,
                      d.id,
                    ))
                .toList();
            reports.sort((a, b) => b.createdAt.compareTo(a.createdAt));
            _cacheReportsLocally(reports);
            if (!controller.isClosed) {
              controller.add(reports);
            }
          },
          onError: (err) {
            // Fall back to polling on Firestore permission/network error
            if (pollingTimer == null || !pollingTimer!.isActive) {
              pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncReports());
            }
          },
          cancelOnError: false,
        );
      } catch (_) {
        pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncReports());
      }
    } else {
      pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncReports());
    }

    controller.onCancel = () {
      firestoreSub?.cancel();
      pollingTimer?.cancel();
    };

    return controller.stream;
  }

  // ─── Local Hive Storage Helpers ─────────────────────────────────────────────

  Future<void> _cacheReportsLocally(List<HazardReportModel> reports) async {
    try {
      if (_box == null) await init();
      final map = <String, dynamic>{};
      for (final r in reports) {
        map[r.id] = jsonEncode(r.toJson());
      }
      await _box?.putAll(map);
    } catch (e) {
      debugPrint('[HazardReportRepository] Cache write error: $e');
    }
  }

  Future<void> _upsertLocalCache(HazardReportModel report) async {
    try {
      if (_box == null) await init();
      await _box?.put(report.id, jsonEncode(report.toJson()));
    } catch (e) {
      debugPrint('[HazardReportRepository] Single cache write error: $e');
    }
  }

  List<HazardReportModel> _getCachedReports({String? employeeId}) {
    try {
      if (_box == null) return [];
      final results = <HazardReportModel>[];
      for (final key in _box!.keys) {
        final raw = _box!.get(key);
        if (raw is String) {
          final json = jsonDecode(raw) as Map<String, dynamic>;
          final item = HazardReportModel.fromJson(json, key.toString());
          if (employeeId == null ||
              employeeId.isEmpty ||
              item.reportedByEmployeeId == employeeId) {
            results.add(item);
          }
        }
      }
      results.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return results;
    } catch (e) {
      debugPrint('[HazardReportRepository] Cache read error: $e');
      return [];
    }
  }
}
