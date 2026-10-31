import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/api_config.dart';
import '../../../core/network/api_client.dart';
import '../../route/repository/route_repository.dart';
import '../models/time_off_model.dart';

class TimeOffRepository {
  static const String boxName = 'driver_time_off_v1';
  static String get serverBaseUrl => ApiConfig.baseUrl;

  Box? _box;
  final http.Client _httpClient;

  TimeOffRepository({http.Client? httpClient})
      : _httpClient = httpClient ?? AuthenticatedHttpClient.instance;

  bool get isFirestoreAvailable {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> init() async {
    if (!Hive.isBoxOpen(boxName)) {
      _box = await Hive.openBox(boxName);
    } else {
      _box = Hive.box(boxName);
    }
  }

  /// Streams real-time updates from Firestore for the given employee ID.
  /// Seamlessly falls back to local Hive cache if offline or uninitialized.
  Stream<List<TimeOffRequestModel>> watchTimeOffRequests(String employeeId) {
    final controller = StreamController<List<TimeOffRequestModel>>.broadcast();

    // 1. Emit cached records first for immediate UI display
    final cached = getTimeOffRequests(employeeId: employeeId);
    controller.add(cached);

    // 2. Trigger asynchronous background sync from REST API if available
    syncTimeOffFromBackend(employeeId).then((_) {
      if (!controller.isClosed) {
        controller.add(getTimeOffRequests(employeeId: employeeId));
      }
    }).catchError((_) {});

    if (!isFirestoreAvailable) {
      return controller.stream;
    }

    StreamSubscription? sub;
    try {
      final clean = employeeId.trim();
      final normTargetId = RouteRepository.resolveEmployeeId(clean);
      final digits = clean.replaceAll(RegExp(r'\D'), '');
      final numVal = int.tryParse(digits);

      final queryKeys = <String>{
        if (clean.isNotEmpty) clean,
        if (clean.isNotEmpty) clean.toLowerCase(),
        if (clean.isNotEmpty) clean.toUpperCase(),
        if (normTargetId.isNotEmpty) ...[
          normTargetId,
          normTargetId.toLowerCase(),
          normTargetId.toUpperCase(),
        ],
        if (digits.isNotEmpty) digits,
        if (numVal != null) ...[
          '$numVal',
          numVal.toString().padLeft(3, '0'),
          numVal.toString().padLeft(4, '0'),
          'EMP-${numVal.toString().padLeft(3, '0')}',
          'EMP-${numVal.toString().padLeft(4, '0')}',
          'DRV-${numVal.toString().padLeft(3, '0')}',
          'DRV-${numVal.toString().padLeft(4, '0')}',
        ],
      }.where((s) => s.isNotEmpty && s != 'tbd' && s != 'unassigned').take(30).toList();

      if (queryKeys.isEmpty) {
        return controller.stream;
      }

      final query = FirebaseFirestore.instance
          .collection('time_off_requests')
          .where('employeeId', whereIn: queryKeys);

      sub = query.snapshots().listen(
        (snapshot) {
          final list = <TimeOffRequestModel>[];
          for (final doc in snapshot.docs) {
            final data = doc.data();
            final docEmpId = data['employeeId']?.toString() ?? '';
            final docEmpNum = data['employeeNumber']?.toString() ?? '';
            if (queryKeys.contains(docEmpId) ||
                queryKeys.contains(docEmpNum) ||
                RouteRepository.matchesDriver(docEmpId, normTargetId) ||
                RouteRepository.matchesDriver(docEmpId, employeeId) ||
                RouteRepository.matchesDriver(docEmpNum, normTargetId) ||
                RouteRepository.matchesDriver(docEmpNum, employeeId)) {
              list.add(TimeOffRequestModel.fromMap(data, doc.id));
            }
          }

          list.sort((a, b) => b.createdAt.compareTo(a.createdAt));

          // Cache updated items in Hive
          _cacheRequests(list);

          if (!controller.isClosed) {
            controller.add(list);
          }
        },
        onError: (err) {
          debugPrint('Firestore watchTimeOffRequests notice: $err');
          if (!controller.isClosed) {
            controller.add(getTimeOffRequests(employeeId: employeeId));
          }
        },
      );
    } catch (e) {
      debugPrint('Firestore initialization notice in watchTimeOffRequests: $e');
    }

    controller.onCancel = () {
      sub?.cancel();
    };

    return controller.stream;
  }

  /// Asynchronously syncs the employee's time-off requests from the REST API to Hive.
  Future<void> syncTimeOffFromBackend(String employeeId) async {
    try {
      final clean = employeeId.trim();
      final normTargetId = RouteRepository.resolveEmployeeId(clean);
      final queryId = normTargetId.isNotEmpty ? normTargetId : clean;
      if (queryId.isEmpty) return;

      final uri = Uri.parse(
          '$serverBaseUrl/api/public/dispatch/time-off-requests?employeeId=${Uri.encodeComponent(queryId)}');
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List<dynamic>;
        final models = list
            .map((item) =>
                TimeOffRequestModel.fromMap(item as Map<String, dynamic>))
            .toList();
        _cacheRequests(models);
      }
    } catch (e) {
      debugPrint('REST syncTimeOffFromBackend notice: $e');
    }
  }

  /// Returns cached time-off requests filtered by employeeId.
  List<TimeOffRequestModel> getTimeOffRequests({String? employeeId}) {
    if (_box == null) return [];
    final list = <TimeOffRequestModel>[];
    final normTarget = employeeId != null ? RouteRepository.resolveEmployeeId(employeeId) : null;

    for (var key in _box!.keys) {
      final raw = _box!.get(key);
      if (raw is Map) {
        final stringKeyMap = raw.map((k, v) => MapEntry(k.toString(), v));
        final rec = TimeOffRequestModel.fromMap(stringKeyMap, key.toString());
        if (normTarget == null ||
            RouteRepository.matchesDriver(rec.employeeId, normTarget) ||
            RouteRepository.matchesDriver(rec.employeeId, employeeId ?? '')) {
          list.add(rec);
        }
      }
    }

    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  /// Creates a new time-off request in Firestore, notifies REST API, and caches locally.
  Future<TimeOffRequestModel> createTimeOffRequest(TimeOffRequestModel request) async {
    final nowStr = DateTime.now().toIso8601String();
    final updated = request.copyWith(
      createdAt: request.createdAt.isNotEmpty ? request.createdAt : nowStr,
      updatedAt: nowStr,
    );

    // 1. Save to local Hive cache immediately
    if (_box != null) {
      await _box!.put(updated.id, updated.toMap());
    }

    // 2. Write to Firestore collection 'time_off_requests'
    if (isFirestoreAvailable) {
      try {
        await FirebaseFirestore.instance
            .collection('time_off_requests')
            .doc(updated.id)
            .set(updated.toMap(), SetOptions(merge: true));
      } catch (e) {
        debugPrint('Firestore time_off_requests set notice: $e');
      }
    }

    // 3. Post to backend REST API
    try {
      final uri = Uri.parse('$serverBaseUrl/api/public/dispatch/time-off-requests');
      final payload = {
        'employeeId': updated.employeeId,
        'employeeNumber': updated.employeeNumber,
        'employeeName': updated.employeeName,
        'leaveType': updated.leaveType.code,
        'startDate': updated.startDate,
        'endDate': updated.endDate,
        'shiftType': updated.shiftType.code,
        'comments': updated.comments,
        'requestedByUserId': updated.requestedByUserId,
        'requestedByName': updated.requestedByName,
      };

      await _httpClient.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 4));
    } catch (e) {
      debugPrint('REST API createTimeOffRequest notice: $e');
    }

    return updated;
  }

  /// Cancels an existing pending time-off request if submitted today.
  Future<TimeOffRequestModel> cancelTimeOffRequest(String requestId) async {
    final existing = getTimeOffRequestById(requestId);
    if (existing == null) {
      throw StateError('Request not found: $requestId');
    }
    if (!existing.isPending) {
      throw StateError('Cannot cancel request: only pending requests can be cancelled.');
    }
    if (!existing.isCreatedToday) {
      throw StateError('Cannot cancel request: leave requests can only be cancelled on the same day they were submitted. Please contact Dispatch.');
    }

    final cancelled = existing.copyWith(
      status: TimeOffStatus.cancelled,
      updatedAt: DateTime.now().toIso8601String(),
    );

    // 1. Update Hive
    if (_box != null) {
      await _box!.put(requestId, cancelled.toMap());
    }

    // 2. Update Firestore
    if (isFirestoreAvailable) {
      try {
        await FirebaseFirestore.instance
            .collection('time_off_requests')
            .doc(requestId)
            .update({'status': 'cancelled', 'updatedAt': cancelled.updatedAt});
      } catch (e) {
        debugPrint('Firestore cancel time_off_request notice: $e');
      }
    }

    // 3. Notify REST endpoint
    try {
      final uri = Uri.parse('$serverBaseUrl/api/public/dispatch/time-off-requests/$requestId/cancel');
      await _httpClient.post(uri).timeout(const Duration(seconds: 4));
    } catch (e) {
      debugPrint('REST cancelTimeOffRequest notice: $e');
    }

    return cancelled;
  }

  TimeOffRequestModel? getTimeOffRequestById(String id) {
    if (_box == null) return null;
    final raw = _box!.get(id);
    if (raw is Map) {
      final stringKeyMap = raw.map((k, v) => MapEntry(k.toString(), v));
      return TimeOffRequestModel.fromMap(stringKeyMap, id);
    }
    return null;
  }

  void _cacheRequests(List<TimeOffRequestModel> list) {
    if (_box == null) return;
    for (final item in list) {
      _box!.put(item.id, item.toMap());
    }
  }
}
