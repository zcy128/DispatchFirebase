import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/network/api_client.dart';
import '../../../core/api_config.dart';
import '../models/vehicle_signout_model.dart';

class VehicleSignoutRepository {
  static const String _boxName = 'driver_vehicle_signouts_v1';
  static String get _baseUrl => ApiConfig.dispatchApiUrl;
  static String get _uploadUrl => ApiConfig.uploadApiUrl;

  Box? _box;
  final FirebaseFirestore? _firestoreOverride;
  final http.Client _httpClient;

  VehicleSignoutRepository({
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
      debugPrint('[VehicleSignoutRepository] Hive init error: $e');
    }
  }

  // ─── Fetch Signouts ────────────────────────────────────────────────────────

  Future<List<VehicleSignoutModel>> getVehicleSignouts({
    String? unitNumber,
    String? employeeId,
    bool? isSignIn,
  }) async {
    // 1. Try REST API
    try {
      final params = <String>['role=fleet'];
      if (unitNumber != null && unitNumber.isNotEmpty) {
        params.add('unitNumber=$unitNumber');
      }
      if (employeeId != null && employeeId.isNotEmpty) {
        params.add('employeeId=$employeeId');
      }
      if (isSignIn != null) {
        params.add('isSignIn=$isSignIn');
      }
      final query = '?${params.join('&')}';
      final uri = Uri.parse('$_baseUrl/vehicle-signouts$query');
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as List<dynamic>;
        final list = data
            .map((e) => VehicleSignoutModel.fromJson(e as Map<String, dynamic>))
            .toList();
        await _cacheSignoutsLocally(list);
        return list;
      }
    } catch (e) {
      debugPrint('[VehicleSignoutRepository] REST get failed: $e');
    }

    // 2. Try Firestore
    final fs = _firestore;
    if (fs != null) {
      try {
        Query q = fs.collection('vehicle_signouts');
        if (unitNumber != null && unitNumber.isNotEmpty) {
          q = q.where('unitNumber', isEqualTo: unitNumber);
        }
        if (employeeId != null && employeeId.isNotEmpty) {
          q = q.where('employeeId', isEqualTo: employeeId);
        }
        if (isSignIn != null) {
          q = q.where('isSignIn', isEqualTo: isSignIn);
        }
        final snap = await q.get().timeout(const Duration(seconds: 5));
        final list = snap.docs
            .map((d) => VehicleSignoutModel.fromJson(d.data() as Map<String, dynamic>))
            .toList();
        list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        await _cacheSignoutsLocally(list);
        return list;
      } catch (e) {
        debugPrint('[VehicleSignoutRepository] Firestore get failed: $e');
      }
    }

    // 3. Fallback to Hive cache
    return _getCachedSignouts(
      unitNumber: unitNumber,
      employeeId: employeeId,
      isSignIn: isSignIn,
    );
  }

  // ─── Submit Signout ────────────────────────────────────────────────────────

  Future<VehicleSignoutModel> submitVehicleSignout(VehicleSignoutModel item) async {
    final now = DateTime.now();
    final clientGeneratedId = item.id.isNotEmpty
        ? item.id
        : 'vso-${now.millisecondsSinceEpoch}';
    final toSubmit = item.copyWith(
      id: clientGeneratedId,
      createdAt: item.createdAt.isNotEmpty ? item.createdAt : now.toIso8601String(),
      updatedAt: now.toIso8601String(),
    );

    String? lastError;

    // 1. Try REST API
    try {
      final uri = Uri.parse('$_baseUrl/vehicle-signouts?role=fleet');
      final res = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(toSubmit.toJson()),
          )
          .timeout(const Duration(seconds: 5));

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final saved = VehicleSignoutModel.fromJson(data);
        await _upsertLocalCache(saved);

        // Sync to Firestore for real-time listener if available
        final fs = _firestore;
        if (fs != null) {
          try {
            await fs.collection('vehicle_signouts').doc(saved.id).set(saved.toJson());
          } catch (_) {}
        }
        return saved;
      } else {
        lastError = 'HTTP ${res.statusCode}: ${res.body}';
        debugPrint('[VehicleSignoutRepository] REST post error: $lastError');
      }
    } catch (e) {
      lastError = e.toString();
      debugPrint('[VehicleSignoutRepository] REST post failed: $e');
    }

    // 2. Direct Firestore fallback
    final fs = _firestore;
    if (fs != null) {
      try {
        await fs.collection('vehicle_signouts').doc(toSubmit.id).set(toSubmit.toJson());
        await _upsertLocalCache(toSubmit);
        return toSubmit;
      } catch (e) {
        debugPrint('[VehicleSignoutRepository] Firestore fallback write failed: $e');
        lastError = 'Firestore error: $e (REST: $lastError)';
      }
    }

    // Cache locally for offline safety, then throw error so UI alerts the user
    await _upsertLocalCache(toSubmit);
    throw Exception('Failed to save to server. $lastError');
  }

  // ─── Real-Time Stream with Graceful Fallback ─────────────────────────────

  Stream<List<VehicleSignoutModel>> watchVehicleSignouts({
    String? unitNumber,
    String? employeeId,
    bool? isSignIn,
  }) {
    late StreamController<List<VehicleSignoutModel>> controller;
    StreamSubscription? firestoreSub;
    Timer? pollingTimer;

    controller = StreamController<List<VehicleSignoutModel>>.broadcast();

    Future<void> syncSignouts() async {
      try {
        final list = await getVehicleSignouts(
          unitNumber: unitNumber,
          employeeId: employeeId,
          isSignIn: isSignIn,
        );
        if (!controller.isClosed) {
          controller.add(list);
        }
      } catch (_) {}
    }

    // Initial immediate emit
    syncSignouts();

    // Firestore real-time stream
    final fs = _firestore;
    if (fs != null) {
      try {
        Query q = fs.collection('vehicle_signouts');
        if (unitNumber != null && unitNumber.isNotEmpty) {
          q = q.where('unitNumber', isEqualTo: unitNumber);
        }
        if (employeeId != null && employeeId.isNotEmpty) {
          q = q.where('employeeId', isEqualTo: employeeId);
        }
        if (isSignIn != null) {
          q = q.where('isSignIn', isEqualTo: isSignIn);
        }
        firestoreSub = q.snapshots().listen(
          (snap) {
            final list = snap.docs
                .map((d) => VehicleSignoutModel.fromJson(d.data() as Map<String, dynamic>))
                .toList();
            list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
            _cacheSignoutsLocally(list);
            if (!controller.isClosed) {
              controller.add(list);
            }
          },
          onError: (_) {
            if (pollingTimer == null || !pollingTimer!.isActive) {
              pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncSignouts());
            }
          },
          cancelOnError: false,
        );
      } catch (_) {
        pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncSignouts());
      }
    } else {
      pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) => syncSignouts());
    }

    controller.onCancel = () {
      firestoreSub?.cancel();
      pollingTimer?.cancel();
    };

    return controller.stream;
  }

  // ─── Upload Photo ────────────────────────────────────────────────────────

  Future<String?> uploadPhoto(Uint8List bytes, String filename) async {
    try {
      final uri = Uri.parse(_uploadUrl);
      final request = http.MultipartRequest('POST', uri);
      request.files.add(
        http.MultipartFile.fromBytes('file', bytes, filename: filename),
      );
      final streamedResponse = await request.send().timeout(const Duration(seconds: 10));
      final response = await http.Response.fromStream(streamedResponse);
      if (response.statusCode == 200 || response.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return json['url']?.toString();
      }
    } catch (e) {
      debugPrint('[VehicleSignoutRepository] Photo upload failed: $e');
    }
    return null;
  }

  // ─── Local Hive Cache Helpers ────────────────────────────────────────────

  Future<void> _cacheSignoutsLocally(List<VehicleSignoutModel> items) async {
    final box = _box;
    if (box == null) return;
    try {
      final map = <String, String>{};
      for (final item in items) {
        map[item.id] = jsonEncode(item.toJson());
      }
      await box.putAll(map);
    } catch (e) {
      debugPrint('[VehicleSignoutRepository] Cache write error: $e');
    }
  }

  Future<void> _upsertLocalCache(VehicleSignoutModel item) async {
    final box = _box;
    if (box == null) return;
    try {
      await box.put(item.id, jsonEncode(item.toJson()));
    } catch (e) {
      debugPrint('[VehicleSignoutRepository] Cache single write error: $e');
    }
  }

  List<VehicleSignoutModel> _getCachedSignouts({
    String? unitNumber,
    String? employeeId,
    bool? isSignIn,
  }) {
    final box = _box;
    if (box == null) return [];
    try {
      final results = <VehicleSignoutModel>[];
      for (final key in box.keys) {
        final raw = box.get(key);
        if (raw is String) {
          final decoded = jsonDecode(raw) as Map<String, dynamic>;
          final model = VehicleSignoutModel.fromJson(decoded);
          if (unitNumber != null && unitNumber.isNotEmpty && model.unitNumber != unitNumber) {
            continue;
          }
          if (employeeId != null && employeeId.isNotEmpty && model.employeeId != employeeId) {
            continue;
          }
          if (isSignIn != null && model.isSignIn != isSignIn) {
            continue;
          }
          results.add(model);
        }
      }
      results.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return results;
    } catch (e) {
      debugPrint('[VehicleSignoutRepository] Cache read error: $e');
      return [];
    }
  }
}
