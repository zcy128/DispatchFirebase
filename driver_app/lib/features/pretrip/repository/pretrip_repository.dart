import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/api_config.dart';
import '../../../core/network/api_client.dart';
import '../models/pretrip_model.dart';

class PreTripLookupException implements Exception {
  final String message;

  const PreTripLookupException(this.message);

  @override
  String toString() => message;
}

String _pretripSubmitError(int statusCode, String body) {
  try {
    final decoded = jsonDecode(body);
    if (decoded is Map && decoded['error'] != null) {
      final message = decoded['error'].toString().trim();
      if (message.isNotEmpty) return message;
    }
  } catch (_) {}
  return 'Failed to submit inspection ($statusCode)';
}

class PreTripRepository {
  static const String _boxName = 'driver_pretrip_v1';
  static String get _baseUrl => ApiConfig.dispatchApiUrl;

  Box? _box;
  final FirebaseFirestore? _firestoreOverride;
  final http.Client _httpClient;

  PreTripRepository({FirebaseFirestore? firestore, http.Client? httpClient})
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
      debugPrint('[PreTripRepository] Hive init error: $e');
    }
  }

  // ─── Fleet Vehicles ───────────────────────────────────────────────────────

  /// Returns a sorted list of active vehicle unit numbers.
  /// An unavailable fleet list is empty. It is never replaced with sample buses.
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
      debugPrint('[PreTripRepository] getFleetVehicleUnits error: $e');
      return const [];
    }
  }

  String _inspectionCacheKey(String vehicleUnit, String date) =>
      'inspected_${vehicleUnit}_$date';

  bool _cachedAllowsOperation(String vehicleUnit, String date) {
    final raw = _box?.get(_inspectionCacheKey(vehicleUnit, date));
    return raw == OverallInspectionStatus.passed.apiValue ||
        raw == OverallInspectionStatus.passedWithMinorDefects.apiValue;
  }

  void _rememberInspection(PreTripInspectionRecord record) {
    _box?.put(
      _inspectionCacheKey(record.vehicleUnit, record.inspectionDate),
      record.overallStatus.apiValue,
    );
  }

  void _clearInspectionCache(String vehicleUnit, String date) {
    _box?.delete(_inspectionCacheKey(vehicleUnit, date));
  }

  // ─── Check Today's Status ─────────────────────────────────────────────────

  /// Null when the bus may be checked in. A message when check-in stays blocked.
  /// A failed lookup blocks check-in unless a passing inspection is already cached.
  Future<String?> checkInBlockReason(String vehicleUnit, String date) async {
    try {
      final record = await getTodayInspection(vehicleUnit, date);
      if (record == null) {
        _clearInspectionCache(vehicleUnit, date);
        return 'Check-in is blocked until the Schedule 5 pre-trip inspection is complete for bus $vehicleUnit.';
      }
      _rememberInspection(record);
      if (!record.overallStatus.allowsOperation) {
        return 'Check-in is blocked because the Schedule 5 inspection for bus $vehicleUnit has a major defect.';
      }
      return null;
    } on PreTripLookupException {
      if (_cachedAllowsOperation(vehicleUnit, date)) return null;
      return 'Check-in is blocked because the Schedule 5 inspection for bus $vehicleUnit could not be confirmed.';
    }
  }

  /// Returns `true` only when today's inspection allows the bus to operate.
  Future<bool> isVehicleInspectedToday(
      String vehicleUnit, String date) async {
    final reason = await checkInBlockReason(vehicleUnit, date);
    return reason == null;
  }

  /// Returns the existing inspection for [vehicleUnit] on [date].
  /// A confirmed absence is null. A failed lookup throws [PreTripLookupException].
  Future<PreTripInspectionRecord?> getTodayInspection(
      String vehicleUnit, String date) async {
    Object? restFailure;
    try {
      final uri = Uri.parse(
          '$_baseUrl/pretrip-inspections/today/$vehicleUnit?date=$date');
      final res =
          await _httpClient.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        if (decoded is! Map) {
          throw const PreTripLookupException(
              'Inspection status response was not valid.');
        }
        final data = Map<String, dynamic>.from(decoded);
        if (data['found'] == false) return null;
        final inspection = data['inspection'];
        if (data['found'] == true && inspection is Map) {
          return PreTripInspectionRecord.fromMap(
              Map<String, dynamic>.from(inspection));
        }
        throw const PreTripLookupException(
            'Inspection status response was not valid.');
      }
      restFailure = PreTripLookupException(
          'Inspection status request failed (${res.statusCode}).');
    } on PreTripLookupException {
      rethrow;
    } catch (e) {
      restFailure = e;
    }

    try {
      final record = await _inspectionFromFirestore(vehicleUnit, date);
      if (record != null) return record;
    } catch (e) {
      debugPrint('[PreTripRepository] getTodayInspection error: $e');
    }
    throw PreTripLookupException(
        'Inspection status could not be confirmed: $restFailure');
  }

  Future<PreTripInspectionRecord?> _inspectionFromFirestore(
      String vehicleUnit, String date) async {
    final fs = _firestore;
    if (fs == null) return null;
    final snap = await fs
        .collection('pretrip_inspections')
        .where('vehicleUnit', isEqualTo: vehicleUnit)
        .where('inspectionDate', isEqualTo: date)
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return null;
    final data = snap.docs.first.data();
    data['id'] = snap.docs.first.id;
    return PreTripInspectionRecord.fromMap(data);
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
  /// Throws [PreTripLookupException] when the reading cannot be confirmed.
  Future<int> getVehicleOdometer(String vehicleUnit) async {
    if (vehicleUnit.isEmpty) {
      throw const PreTripLookupException('Vehicle unit is required.');
    }

    Object? restFailure;
    try {
      final uri =
          Uri.parse('${ApiConfig.baseUrl}/api/public/vehicles/$vehicleUnit');
      final res =
          await _httpClient.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        if (decoded is Map) {
          final odo = decoded['odometer'];
          if (odo is num) return odo.toInt();
        }
        restFailure = const PreTripLookupException(
            'Vehicle record did not include an odometer.');
      } else if (res.statusCode == 404) {
        restFailure = PreTripLookupException(
            'No fleet record for bus $vehicleUnit.');
      } else {
        restFailure = PreTripLookupException(
            'Odometer lookup failed (${res.statusCode}).');
      }
    } on PreTripLookupException {
      rethrow;
    } catch (e) {
      restFailure = e;
    }

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
    throw PreTripLookupException(
        'Current odometer could not be confirmed: $restFailure');
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  /// Submits a new pre-trip inspection to the REST API (Firestore fallback).
  Future<PreTripInspectionRecord> submitInspection(
      PreTripInspectionRecord record) async {
    if (record.odometer <= 0) {
      throw Exception('A valid odometer reading is required.');
    }
    final payload = record.toMap();
    // Remove id so server auto-generates it
    payload.remove('id');

    // REST. Use the authenticated client. A bare post is rejected with 401,
    // and that rejection must not be saved again through Firestore.
    try {
      final uri = Uri.parse('$_baseUrl/pretrip-inspections');
      final res = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 201 || res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        final created = decoded is Map
            ? PreTripInspectionRecord.fromMap(
                Map<String, dynamic>.from(decoded))
            : record;
        _rememberInspection(created);
        return created;
      }
      throw Exception(_pretripSubmitError(res.statusCode, res.body));
    } on TimeoutException {
      // The API did not answer. Keep the offline Firestore path below.
    } on http.ClientException {
      // No connection. Keep the offline Firestore path below.
    }

    // Firestore fallback
    final fs = _firestore;
    if (fs == null) {
      throw Exception('Failed to submit inspection. The server did not respond.');
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

      _rememberInspection(withId);
      return withId;
    }

    final docRef = fs.collection('pretrip_inspections').doc();
    final withId = record.copyWith(id: docRef.id);
    await docRef.set(withId.toMap());
    _rememberInspection(withId);
    return withId;
  }
}
