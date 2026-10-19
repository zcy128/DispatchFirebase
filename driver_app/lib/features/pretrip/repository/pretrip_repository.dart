import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/api_config.dart';
import '../models/pretrip_model.dart';

class PreTripRepository {
  static const String _boxName = 'driver_pretrip_v1';
  static String get _baseUrl => ApiConfig.dispatchApiUrl;

  Box? _box;
  final FirebaseFirestore? _firestoreOverride;

  PreTripRepository({FirebaseFirestore? firestore})
      : _firestoreOverride = firestore;

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
      debugPrint('[PreTripRepository] Hive init error: $e');
    }
  }

  // ─── Fleet Vehicles ───────────────────────────────────────────────────────

  /// Returns a sorted list of vehicle unit numbers from the Firestore vehicles
  /// collection (e.g., ['1001', '1002', '1003']).
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
      return units;
    } catch (e) {
      debugPrint('[PreTripRepository] getFleetVehicleUnits error: $e');
      // Fall back to a small static list for offline dev
      return ['1001', '1002', '1003', '1004', '1005'];
    }
  }

  // ─── Check Today's Status ─────────────────────────────────────────────────

  /// Returns `true` if a vehicle already has a valid inspection for [date]
  /// (YYYY-MM-DD). Checks Hive cache first, then REST, then Firestore stream.
  Future<bool> isVehicleInspectedToday(
      String vehicleUnit, String date) async {
    // 1. Hive cache
    final cacheKey = 'inspected_${vehicleUnit}_$date';
    if (_box != null && _box!.get(cacheKey) == true) {
      return true;
    }

    // 2. REST
    try {
      final uri = Uri.parse(
          '$_baseUrl/pretrip-inspections/today/$vehicleUnit?date=$date');
      final res = await http.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final found = data['found'] as bool? ?? false;
        if (found) {
          _box?.put(cacheKey, true);
          return true;
        }
        return false;
      }
    } catch (_) {}

    // 3. Firestore fallback
    try {
      final fs = _firestore;
      if (fs == null) return false;
      final snap = await fs
          .collection('pretrip_inspections')
          .where('vehicleUnit', isEqualTo: vehicleUnit)
          .where('inspectionDate', isEqualTo: date)
          .limit(1)
          .get();
      final found = snap.docs.isNotEmpty;
      if (found) {
        _box?.put(cacheKey, true);
      }
      return found;
    } catch (e) {
      debugPrint('[PreTripRepository] isVehicleInspectedToday error: $e');
      return false;
    }
  }

  /// Returns the existing inspection for [vehicleUnit] on [date], or null.
  Future<PreTripInspectionRecord?> getTodayInspection(
      String vehicleUnit, String date) async {
    // REST first
    try {
      final uri = Uri.parse(
          '$_baseUrl/pretrip-inspections/today/$vehicleUnit?date=$date');
      final res = await http.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        if (data['found'] == true && data['inspection'] != null) {
          return PreTripInspectionRecord.fromMap(
              data['inspection'] as Map<String, dynamic>);
        }
        return null;
      }
    } catch (_) {}

    // Firestore fallback
    try {
      final fs = _firestore;
      if (fs == null) return null;
      final snap = await fs
          .collection('pretrip_inspections')
          .where('vehicleUnit', isEqualTo: vehicleUnit)
          .where('inspectionDate', isEqualTo: date)
          .limit(1)
          .get();
      if (snap.docs.isNotEmpty) {
        final data = snap.docs.first.data();
        data['id'] = snap.docs.first.id;
        return PreTripInspectionRecord.fromMap(data);
      }
      return null;
    } catch (e) {
      debugPrint('[PreTripRepository] getTodayInspection error: $e');
      return null;
    }
  }

  // ─── Real-time stream ─────────────────────────────────────────────────────

  /// Streams the first inspection document for [vehicleUnit] on [date].
  /// Emits null when none exists.
  Stream<PreTripInspectionRecord?> watchTodayStatus(
      String vehicleUnit, String date) {
    final fs = _firestore;
    if (fs == null) {
      return const Stream.empty();
    }
    return fs
        .collection('pretrip_inspections')
        .where('vehicleUnit', isEqualTo: vehicleUnit)
        .where('inspectionDate', isEqualTo: date)
        .limit(1)
        .snapshots()
        .map((snap) {
      if (snap.docs.isEmpty) return null;
      final data = snap.docs.first.data();
      data['id'] = snap.docs.first.id;
      return PreTripInspectionRecord.fromMap(data);
    });
  }

  // ─── Vehicle Odometer ────────────────────────────────────────────────────

  /// Fetches the latest recorded odometer for [vehicleUnit].
  Future<int> getVehicleOdometer(String vehicleUnit) async {
    if (vehicleUnit.isEmpty) return 0;

    // 1. Try REST API
    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/api/public/vehicles/$vehicleUnit');
      final res = await http.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final odo = data['odometer'];
        if (odo is num) return odo.toInt();
      }
    } catch (_) {}

    // 2. Firestore fallback
    try {
      final fs = _firestore;
      if (fs != null) {
        final snap = await fs
            .collection('vehicles')
            .where('unitNumber', isEqualTo: vehicleUnit)
            .limit(1)
            .get();
        if (snap.docs.isNotEmpty) {
          final odo = snap.docs.first.data()['odometer'];
          if (odo is num) return odo.toInt();
        } else {
          final direct = await fs.collection('vehicles').doc(vehicleUnit).get();
          if (direct.exists) {
            final odo = direct.data()?['odometer'];
            if (odo is num) return odo.toInt();
          }
        }
      }
    } catch (e) {
      debugPrint('[PreTripRepository] getVehicleOdometer error: $e');
    }
    return 0;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /// Submits a new pre-trip inspection to the REST API (Firestore fallback).
  Future<PreTripInspectionRecord> submitInspection(
      PreTripInspectionRecord record) async {
    final payload = record.toMap();
    // Remove id so server auto-generates it
    payload.remove('id');

    // REST
    bool networkError = false;
    try {
      final uri = Uri.parse('$_baseUrl/pretrip-inspections');
      final res = await http
          .post(uri,
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode(payload))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 201 || res.statusCode == 200) {
        final created = PreTripInspectionRecord.fromMap(
            jsonDecode(res.body) as Map<String, dynamic>);
        // Cache completion
        final cacheKey =
            'inspected_${record.vehicleUnit}_${record.inspectionDate}';
        _box?.put(cacheKey, true);
        return created;
      } else {
        // Server returned an explicit validation or error response
        try {
          final errBody = jsonDecode(res.body) as Map<String, dynamic>;
          final errMsg = errBody['error']?.toString() ?? 'Server error ${res.statusCode}';
          throw Exception(errMsg);
        } catch (e) {
          if (e is Exception && e.toString().contains('odometer')) {
            rethrow;
          }
          throw Exception('Failed to submit inspection (${res.statusCode}): ${res.body}');
        }
      }
    } on Exception catch (e) {
      if (e.toString().contains('odometer') || e.toString().contains('Server error')) {
        rethrow;
      }
      networkError = true;
    } catch (_) {
      networkError = true;
    }

    if (!networkError) {
      return record;
    }

    // Firestore fallback
    final fs = _firestore;
    if (fs == null) {
      return record;
    }

    // Validate odometer in Firestore fallback
    if (record.vehicleUnit.isNotEmpty && record.odometer > 0) {
      final snap = await fs
          .collection('vehicles')
          .where('unitNumber', isEqualTo: record.vehicleUnit)
          .limit(1)
          .get();
      DocumentReference? vRef;
      if (snap.docs.isNotEmpty) {
        final vDoc = snap.docs.first;
        vRef = vDoc.reference;
        final currOdo = vDoc.data()['odometer'];
        if (currOdo is num && currOdo > 0 && record.odometer < currOdo.toInt()) {
          throw Exception(
              'New odometer (${record.odometer}) cannot be less than current vehicle odometer (${currOdo.toInt()})');
        }
      }

      final docRef = fs.collection('pretrip_inspections').doc();
      final withId = record.copyWith(id: docRef.id);
      await docRef.set(withId.toMap());

      if (vRef != null) {
        await vRef.update({
          'odometer': record.odometer,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }

      final cacheKey =
          'inspected_${record.vehicleUnit}_${record.inspectionDate}';
      _box?.put(cacheKey, true);
      return withId;
    }

    final docRef = fs.collection('pretrip_inspections').doc();
    final withId = record.copyWith(id: docRef.id);
    await docRef.set(withId.toMap());
    final cacheKey =
        'inspected_${record.vehicleUnit}_${record.inspectionDate}';
    _box?.put(cacheKey, true);
    return withId;
  }
}
