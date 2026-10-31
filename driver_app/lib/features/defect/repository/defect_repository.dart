import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/api_config.dart';
import '../../../core/network/api_client.dart';
import '../models/defect_model.dart';

class DefectRepository {
  static const String _boxName = 'driver_defects_v1';
  static String get _baseUrl => ApiConfig.dispatchApiUrl;

  Box? _box;
  final FirebaseFirestore? _firestoreOverride;
  final http.Client _httpClient;

  DefectRepository({FirebaseFirestore? firestore, http.Client? httpClient})
      : _firestoreOverride = firestore,
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
      debugPrint('[DefectRepository] Hive init error: $e');
    }
  }

  // ─── Fleet Vehicles ───────────────────────────────────────────────────────

  Future<List<String>> getFleetVehicleUnits() async {
    try {
      final fs = _firestore;
      if (fs == null) {
        return ['1001', '1002', '1003', '1004', '1005'];
      }
      final snap = await fs
          .collection('vehicles')
          .where('active', isEqualTo: true)
          .get();
      final units = snap.docs
          .map((d) => d.data()['unitNumber']?.toString() ?? '')
          .where((u) => u.isNotEmpty)
          .toList();
      units.sort();
      return units.isEmpty ? ['1001', '1002', '1003', '1004', '1005'] : units;
    } catch (e) {
      debugPrint('[DefectRepository] getFleetVehicleUnits error: $e');
      return ['1001', '1002', '1003', '1004', '1005'];
    }
  }

  // ─── Fetch Reports ────────────────────────────────────────────────────────

  Future<List<VehicleDefectReport>> getDefectReports({
    String? vehicleUnit,
    String? driverId,
  }) async {
    // 1. Try REST API
    try {
      final queryParams = <String, String>{};
      if (vehicleUnit != null && vehicleUnit.isNotEmpty) {
        queryParams['vehicleUnit'] = vehicleUnit;
      }
      if (driverId != null && driverId.isNotEmpty) {
        queryParams['driverId'] = driverId;
      }

      final uri = Uri.parse('$_baseUrl/vehicle-defects')
          .replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        final reports = list
            .map((item) =>
                VehicleDefectReport.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();

        // Cache reports in Hive
        _cacheReports(reports);
        return reports;
      }
    } catch (e) {
      debugPrint('[DefectRepository] REST getDefectReports error: $e');
    }

    // 2. Try Firestore fallback
    try {
      final fs = _firestore;
      if (fs != null) {
        Query q = fs.collection('vehicle_defects');
        if (vehicleUnit != null && vehicleUnit.isNotEmpty) {
          q = q.where('vehicleUnitNumber', isEqualTo: vehicleUnit);
        }
        if (driverId != null && driverId.isNotEmpty) {
          q = q.where('reportedByUserId', isEqualTo: driverId);
        }
        final snap = await q.get();
        final reports = snap.docs.map((d) {
          final data = d.data() as Map<String, dynamic>;
          data['id'] = d.id;
          return VehicleDefectReport.fromJson(data);
        }).toList();

        _cacheReports(reports);
        return reports;
      }
    } catch (e) {
      debugPrint('[DefectRepository] Firestore getDefectReports error: $e');
    }

    // 3. Fallback to Hive cache
    return _getCachedReports(vehicleUnit: vehicleUnit, driverId: driverId);
  }

  // ─── Submit Report ────────────────────────────────────────────────────────

  Future<VehicleDefectReport> submitDefectReport(
      VehicleDefectReport report) async {
    // 1. Send via REST
    try {
      final uri = Uri.parse('$_baseUrl/vehicle-defects');
      final body = jsonEncode({
        'vehicleId': report.vehicleId,
        'vehicleUnitNumber': report.vehicleUnitNumber,
        'odometer': report.odometer,
        'reportedByUserId': report.reportedByUserId,
        'reportedByName': report.reportedByName,
        'reportDate': report.reportDate,
        'reportTime': report.reportTime,
        'items': report.items.map((i) => i.toJson()).toList(),
        'defectNotes': report.defectNotes,
        'noDefectsFound': report.noDefectsFound,
        'confirmedAccurate': report.confirmedAccurate,
      });

      final res = await _httpClient.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: body,
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final created = VehicleDefectReport.fromJson(data);
        _saveToCache(created);
        return created;
      } else {
        throw Exception('Server returned ${res.statusCode}: ${res.body}');
      }
    } catch (e) {
      debugPrint('[DefectRepository] REST submitDefectReport error: $e');

      // 2. Direct Firestore fallback
      final fs = _firestore;
      if (fs != null) {
        final docRef = fs.collection('vehicle_defects').doc();
        final created = VehicleDefectReport(
          id: docRef.id,
          vehicleId: report.vehicleId,
          vehicleUnitNumber: report.vehicleUnitNumber,
          odometer: report.odometer,
          reportedByUserId: report.reportedByUserId,
          reportedByName: report.reportedByName,
          reportDate: report.reportDate,
          reportTime: report.reportTime,
          items: report.items,
          defectNotes: report.defectNotes,
          noDefectsFound: report.noDefectsFound,
          confirmedAccurate: report.confirmedAccurate,
          status: DefectReportStatus.submitted,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );

        await docRef.set(created.toJson());
        _saveToCache(created);
        return created;
      }

      // Offline mode: cache locally
      _saveToCache(report);
      return report;
    }
  }

  // ─── Real-Time Stream ─────────────────────────────────────────────────────

  Stream<List<VehicleDefectReport>> watchDefectReports({
    String? driverId,
    String? vehicleUnit,
  }) {
    final fs = _firestore;
    if (fs == null) {
      // Return single emission of cached data
      return Stream.fromFuture(
          getDefectReports(vehicleUnit: vehicleUnit, driverId: driverId));
    }

    Query q = fs.collection('vehicle_defects');
    if (driverId != null && driverId.isNotEmpty) {
      q = q.where('reportedByUserId', isEqualTo: driverId);
    }
    if (vehicleUnit != null && vehicleUnit.isNotEmpty) {
      q = q.where('vehicleUnitNumber', isEqualTo: vehicleUnit);
    }

    return q.snapshots().handleError((err) {
      debugPrint('[DefectRepository] Firestore watch notice: $err');
    }).map((snap) {
      final reports = snap.docs.map((doc) {
        final data = doc.data() as Map<String, dynamic>;
        data['id'] = doc.id;
        return VehicleDefectReport.fromJson(data);
      }).toList();
      _cacheReports(reports);
      return reports;
    });
  }

  // ─── Hive Caching Helpers ──────────────────────────────────────────────────

  void _saveToCache(VehicleDefectReport report) {
    if (_box == null) return;
    try {
      _box!.put(report.id, jsonEncode(report.toJson()));
    } catch (_) {}
  }

  void _cacheReports(List<VehicleDefectReport> reports) {
    if (_box == null) return;
    try {
      for (final r in reports) {
        _box!.put(r.id, jsonEncode(r.toJson()));
      }
    } catch (_) {}
  }

  List<VehicleDefectReport> _getCachedReports({
    String? vehicleUnit,
    String? driverId,
  }) {
    if (_box == null) return [];
    try {
      final List<VehicleDefectReport> results = [];
      for (final key in _box!.keys) {
        final raw = _box!.get(key);
        if (raw is String) {
          final data = jsonDecode(raw) as Map<String, dynamic>;
          final report = VehicleDefectReport.fromJson(data);
          if (vehicleUnit != null &&
              vehicleUnit.isNotEmpty &&
              report.vehicleUnitNumber != vehicleUnit) {
            continue;
          }
          if (driverId != null &&
              driverId.isNotEmpty &&
              report.reportedByUserId != driverId) {
            continue;
          }
          results.add(report);
        }
      }
      results.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return results;
    } catch (_) {
      return [];
    }
  }
}
