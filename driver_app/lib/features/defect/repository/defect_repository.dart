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

class DefectLookupException implements Exception {
  final String message;

  const DefectLookupException(this.message);

  @override
  String toString() => message;
}

String _defectSubmitError(int statusCode, String body) {
  try {
    final decoded = jsonDecode(body);
    if (decoded is Map && decoded['error'] != null) {
      final message = decoded['error'].toString().trim();
      if (message.isNotEmpty) return message;
    }
  } catch (_) {}
  return 'Failed to submit defect report ($statusCode)';
}

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

  /// Active fleet unit numbers. An unavailable list is empty, never sample buses.
  Future<List<String>> getFleetVehicleUnits() async {
    try {
      final fs = _firestore;
      if (fs == null) return const [];
      final snap = await fs
          .collection('vehicles')
          .where('active', isEqualTo: true)
          .get();
      final units = snap.docs
          .map((d) => d.data()['unitNumber']?.toString() ?? '')
          .where((u) => u.isNotEmpty)
          .toList();
      units.sort();
      return units;
    } catch (e) {
      debugPrint('[DefectRepository] getFleetVehicleUnits error: $e');
      return const [];
    }
  }

  // ─── Fetch Reports ────────────────────────────────────────────────────────

  /// Confirmed server results, including an empty list.
  /// A failed lookup throws [DefectLookupException] when nothing is cached.
  Future<List<VehicleDefectReport>> getDefectReports({
    String? vehicleUnit,
    String? driverId,
  }) async {
    Object? restFailure;
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
        final decoded = jsonDecode(res.body);
        if (decoded is! List) {
          throw const DefectLookupException(
              'Defect report response was not valid.');
        }
        final reports = decoded
            .map((item) => VehicleDefectReport.fromJson(
                Map<String, dynamic>.from(item as Map)))
            .toList();
        _replaceCachedReports(
          reports,
          vehicleUnit: vehicleUnit,
          driverId: driverId,
        );
        return newestDefectReports(reports);
      }
      restFailure = DefectLookupException(
          'Defect report request failed (${res.statusCode}).');
    } on DefectLookupException {
      rethrow;
    } catch (e) {
      debugPrint('[DefectRepository] REST getDefectReports error: $e');
      restFailure = e;
    }

    try {
      final fromFirestore = await _reportsFromFirestore(
        vehicleUnit: vehicleUnit,
        driverId: driverId,
      );
      if (fromFirestore != null && fromFirestore.isNotEmpty) {
        _cacheReports(fromFirestore);
        return newestDefectReports(fromFirestore);
      }
    } catch (e) {
      debugPrint('[DefectRepository] Firestore getDefectReports error: $e');
    }

    final cached = _getCachedReports(vehicleUnit: vehicleUnit, driverId: driverId);
    if (cached.isNotEmpty) return cached;
    throw DefectLookupException(
        'Defect reports could not be confirmed: $restFailure');
  }

  Future<List<VehicleDefectReport>?> _reportsFromFirestore({
    String? vehicleUnit,
    String? driverId,
  }) async {
    final fs = _firestore;
    if (fs == null) return null;
    Query q = fs.collection('vehicle_defects');
    if (vehicleUnit != null && vehicleUnit.isNotEmpty) {
      q = q.where('vehicleUnitNumber', isEqualTo: vehicleUnit);
    }
    if (driverId != null && driverId.isNotEmpty) {
      q = q.where('reportedByUserId', isEqualTo: driverId);
    }
    final snap = await q.get();
    if (snap.docs.isEmpty) return const [];
    return snap.docs.map((d) {
      final data = d.data() as Map<String, dynamic>;
      data['id'] = d.id;
      return VehicleDefectReport.fromJson(data);
    }).toList();
  }

  // ─── Submit Report ────────────────────────────────────────────────────────

  /// Submits through the API so a real defect still removes the bus from dispatch.
  /// A rejected or unanswered request is not saved locally or written to Firestore.
  Future<VehicleDefectReport> submitDefectReport(
      VehicleDefectReport report) async {
    if (report.vehicleUnitNumber.trim().isEmpty) {
      throw Exception('A fleet vehicle is required.');
    }
    if (report.odometer <= 0) {
      throw Exception('A valid odometer reading is required.');
    }

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
          'Failed to submit defect report. The server did not respond.');
    } on http.ClientException {
      throw Exception(
          'Failed to submit defect report. The server did not respond.');
    }

    if (res.statusCode == 200 || res.statusCode == 201) {
      final decoded = jsonDecode(res.body);
      if (decoded is! Map) {
        throw const DefectLookupException(
            'Defect report response was not valid.');
      }
      final created =
          VehicleDefectReport.fromJson(Map<String, dynamic>.from(decoded));
      _saveToCache(created);
      return created;
    }
    throw Exception(_defectSubmitError(res.statusCode, res.body));
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

    return q.snapshots().map((snap) {
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

  void _replaceCachedReports(
    List<VehicleDefectReport> reports, {
    String? vehicleUnit,
    String? driverId,
  }) {
    if (_box == null) return;
    try {
      final stale = _getCachedReports(vehicleUnit: vehicleUnit, driverId: driverId);
      for (final report in stale) {
        _box!.delete(report.id);
      }
      _cacheReports(reports);
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
