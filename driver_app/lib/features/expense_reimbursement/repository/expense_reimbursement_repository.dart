import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../../core/network/api_client.dart';
import '../../../core/api_config.dart';
import '../models/expense_reimbursement_model.dart';

class ExpenseReimbursementRepository {
  static const String _boxName = 'driver_expenses_v1';
  static String get _baseUrl => ApiConfig.dispatchApiUrl;

  Box? _box;
  final FirebaseFirestore? _firestoreOverride;
  final http.Client _httpClient;

  ExpenseReimbursementRepository({
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
      debugPrint('[ExpenseReimbursementRepository] Hive init error: $e');
    }
  }

  // ─── Categories ─────────────────────────────────────────────────────────────

  Future<List<ExpenseCategory>> getCategories() async {
    // 1. Try REST
    try {
      final uri = Uri.parse('$_baseUrl/expense-categories');
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as List<dynamic>;
        final categories = data
            .map((e) => ExpenseCategory.fromJson(e as Map<String, dynamic>))
            .toList();
        if (categories.isNotEmpty) {
          _cacheCategories(categories);
          return categories;
        }
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] REST getCategories error: $e');
    }

    // 2. Try Firestore
    try {
      final fs = _firestore;
      if (fs != null) {
        final snap = await fs
            .collection('expense_categories')
            .where('active', isEqualTo: true)
            .get();
        if (snap.docs.isNotEmpty) {
          final categories = snap.docs.map((d) {
            final data = d.data();
            data['id'] = d.id;
            return ExpenseCategory.fromJson(data);
          }).toList();
          categories.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
          _cacheCategories(categories);
          return categories;
        }
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] Firestore getCategories error: $e');
    }

    // 3. Cached / defaults
    final cached = _getCachedCategories();
    if (cached.isNotEmpty) {
      return cached;
    }
    return ExpenseCategory.defaultCategories();
  }

  // ─── Fetch Claims ──────────────────────────────────────────────────────────

  Future<List<ExpenseReimbursementClaim>> getClaims({
    String? employeeId,
    String? status,
  }) async {
    // 1. Try REST
    try {
      final queryParams = <String, String>{};
      if (employeeId != null && employeeId.isNotEmpty) {
        queryParams['employeeId'] = employeeId;
      }
      if (status != null && status.isNotEmpty) {
        queryParams['status'] = status;
      }

      final uri = Uri.parse('$_baseUrl/expense-reimbursements')
          .replace(queryParameters: queryParams.isEmpty ? null : queryParams);

      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List<dynamic>;
        final claims = list
            .map((e) => ExpenseReimbursementClaim.fromJson(e as Map<String, dynamic>))
            .toList();
        _cacheClaims(claims);
        return claims;
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] REST getClaims error: $e');
    }

    // 2. Try Firestore
    try {
      final fs = _firestore;
      if (fs != null) {
        Query q = fs.collection('expense_reimbursements');
        if (employeeId != null && employeeId.isNotEmpty) {
          q = q.where('employeeId', isEqualTo: employeeId);
        }
        if (status != null && status.isNotEmpty) {
          q = q.where('status', isEqualTo: status);
        }
        final snap = await q.get();
        final claims = snap.docs.map((d) {
          final data = d.data() as Map<String, dynamic>;
          data['id'] = d.id;
          return ExpenseReimbursementClaim.fromJson(data);
        }).toList();

        claims.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        _cacheClaims(claims);
        return claims;
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] Firestore getClaims error: $e');
    }

    // 3. Fallback to Hive cache
    return _getCachedClaims(employeeId: employeeId, status: status);
  }

  // ─── Submit Claim ──────────────────────────────────────────────────────────

  Future<ExpenseReimbursementClaim> submitClaim(ExpenseReimbursementClaim claim) async {
    // 1. Try REST
    try {
      final uri = Uri.parse('$_baseUrl/expense-reimbursements');
      final payload = {
        'employeeId': claim.employeeId,
        'employeeName': claim.employeeName,
        'claimDate': claim.claimDate,
        'routeNo': claim.routeNo,
        'lines': claim.lines.map((l) => l.toJson()).toList(),
        'attachmentUrls': claim.attachmentUrls,
      };

      final res = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final created = ExpenseReimbursementClaim.fromJson(data);
        _saveClaimToCache(created);
        return created;
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] REST submitClaim error: $e');
    }

    // 2. Try Firestore
    try {
      final fs = _firestore;
      if (fs != null) {
        final col = fs.collection('expense_reimbursements');
        final docRef = claim.id.isNotEmpty && !claim.id.startsWith('temp-')
            ? col.doc(claim.id)
            : col.doc();

        final updated = claim.copyWith(
          id: docRef.id,
          createdAt: DateTime.now().toUtc(),
          updatedAt: DateTime.now().toUtc(),
        );

        await docRef.set(updated.toJson());
        _saveClaimToCache(updated);
        return updated;
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] Firestore submitClaim error: $e');
    }

    // 3. Offline fallback
    final offlineClaim = claim.copyWith(
      id: claim.id.isNotEmpty
          ? claim.id
          : 'offline-${DateTime.now().millisecondsSinceEpoch}',
      createdAt: DateTime.now().toUtc(),
      updatedAt: DateTime.now().toUtc(),
    );
    _saveClaimToCache(offlineClaim);
    return offlineClaim;
  }

  // ─── Cancel Claim ──────────────────────────────────────────────────────────

  Future<ExpenseReimbursementClaim> cancelClaim({
    required String claimId,
    required String employeeId,
  }) async {
    // 1. Try REST
    try {
      final uri = Uri.parse('$_baseUrl/expense-reimbursements/$claimId/cancel');
      final res = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'employeeId': employeeId}),
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final updated = ExpenseReimbursementClaim.fromJson(data);
        _saveClaimToCache(updated);
        return updated;
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] REST cancelClaim error: $e');
    }

    // 2. Try Firestore
    try {
      final fs = _firestore;
      if (fs != null) {
        final docRef = fs.collection('expense_reimbursements').doc(claimId);
        final now = DateTime.now().toUtc();
        await docRef.update({
          'status': 'cancelled',
          'updatedAt': now.toIso8601String(),
        });
        final snap = await docRef.get();
        if (snap.exists && snap.data() != null) {
          final data = snap.data()!;
          data['id'] = snap.id;
          final updated = ExpenseReimbursementClaim.fromJson(data);
          _saveClaimToCache(updated);
          return updated;
        }
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] Firestore cancelClaim error: $e');
    }

    // 3. Offline update in cache
    final cached = _getCachedClaims();
    final idx = cached.indexWhere((c) => c.id == claimId);
    if (idx != -1) {
      final cancelled = cached[idx].copyWith(
        status: ExpenseClaimStatus.cancelled,
        updatedAt: DateTime.now().toUtc(),
      );
      _saveClaimToCache(cancelled);
      return cancelled;
    }

    throw Exception('Failed to cancel claim: claim not found');
  }

  // ─── Cache Helpers ─────────────────────────────────────────────────────────

  void _cacheCategories(List<ExpenseCategory> categories) {
    if (_box == null || !_box!.isOpen) return;
    try {
      final raw = jsonEncode(categories.map((c) => c.toJson()).toList());
      _box!.put('categories_cache', raw);
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] cacheCategories error: $e');
    }
  }

  List<ExpenseCategory> _getCachedCategories() {
    if (_box == null || !_box!.isOpen) return [];
    try {
      final raw = _box!.get('categories_cache');
      if (raw != null) {
        final list = jsonDecode(raw.toString()) as List<dynamic>;
        return list.map((e) => ExpenseCategory.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] getCachedCategories error: $e');
    }
    return [];
  }

  void _cacheClaims(List<ExpenseReimbursementClaim> claims) {
    if (_box == null || !_box!.isOpen) return;
    try {
      final map = <String, String>{};
      for (final c in claims) {
        map[c.id] = jsonEncode(c.toJson());
      }
      _box!.put('claims_map', map);
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] cacheClaims error: $e');
    }
  }

  void _saveClaimToCache(ExpenseReimbursementClaim claim) {
    if (_box == null || !_box!.isOpen) return;
    try {
      final raw = _box!.get('claims_map');
      Map<dynamic, dynamic> map = {};
      if (raw is Map) {
        map = Map<dynamic, dynamic>.from(raw);
      }
      map[claim.id] = jsonEncode(claim.toJson());
      _box!.put('claims_map', map);
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] saveClaimToCache error: $e');
    }
  }

  List<ExpenseReimbursementClaim> _getCachedClaims({
    String? employeeId,
    String? status,
  }) {
    if (_box == null || !_box!.isOpen) return [];
    try {
      final raw = _box!.get('claims_map');
      if (raw is Map) {
        final list = <ExpenseReimbursementClaim>[];
        for (final entry in raw.values) {
          try {
            final data = jsonDecode(entry.toString()) as Map<String, dynamic>;
            final claim = ExpenseReimbursementClaim.fromJson(data);

            if (employeeId != null && employeeId.isNotEmpty && claim.employeeId != employeeId) {
              continue;
            }
            if (status != null && status.isNotEmpty && claim.status.apiValue != status) {
              continue;
            }
            list.add(claim);
          } catch (_) {}
        }
        list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        return list;
      }
    } catch (e) {
      debugPrint('[ExpenseReimbursementRepository] getCachedClaims error: $e');
    }
    return [];
  }
}
