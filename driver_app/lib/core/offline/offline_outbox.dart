import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// Represents a single queued write operation waiting to be synchronized
/// with the backend when network connectivity is available.
@immutable
class OutboxMutation {
  final String id;
  final String entityType;
  final String method;
  final String endpoint;
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  final int retryCount;
  final String? lastError;

  const OutboxMutation({
    required this.id,
    required this.entityType,
    required this.method,
    required this.endpoint,
    required this.payload,
    required this.createdAt,
    this.retryCount = 0,
    this.lastError,
  });

  OutboxMutation copyWith({
    int? retryCount,
    String? lastError,
  }) {
    return OutboxMutation(
      id: id,
      entityType: entityType,
      method: method,
      endpoint: endpoint,
      payload: payload,
      createdAt: createdAt,
      retryCount: retryCount ?? this.retryCount,
      lastError: lastError ?? this.lastError,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'entityType': entityType,
      'method': method,
      'endpoint': endpoint,
      'payload': payload,
      'createdAt': createdAt.toIso8601String(),
      'retryCount': retryCount,
      if (lastError != null) 'lastError': lastError,
    };
  }

  factory OutboxMutation.fromJson(Map<String, dynamic> json) {
    return OutboxMutation(
      id: json['id'] as String,
      entityType: json['entityType'] as String,
      method: json['method'] as String,
      endpoint: json['endpoint'] as String,
      payload: Map<String, dynamic>.from(json['payload'] as Map),
      createdAt: DateTime.parse(json['createdAt'] as String),
      retryCount: (json['retryCount'] as int?) ?? 0,
      lastError: json['lastError'] as String?,
    );
  }
}

/// Outcome of attempting to deliver a single [OutboxMutation].
enum OutboxDeliveryOutcome {
  /// Delivered and acknowledged by the server; remove from queue.
  succeeded,

  /// Transient failure (offline, timeout, 5xx); keep in queue and stop/retry later.
  transientFailure,

  /// Permanent rejection (4xx validation/auth conflict); drop from queue.
  permanentFailure,
}

/// Abstraction over persistent key-value storage for [OfflineOutbox].
abstract class OutboxStore {
  Future<List<String>> readAll();
  Future<void> put(String id, String serializedMutation);
  Future<void> delete(String id);
}

/// Hive-backed implementation of [OutboxStore].
class HiveOutboxStore implements OutboxStore {
  static const String defaultBoxName = 'offline_outbox_v1';

  final String boxName;
  Box<String>? _box;

  HiveOutboxStore({this.boxName = defaultBoxName});

  Future<Box<String>> _ensureBox() async {
    if (_box != null && _box!.isOpen) return _box!;
    _box = await Hive.openBox<String>(boxName);
    return _box!;
  }

  @override
  Future<List<String>> readAll() async {
    final box = await _ensureBox();
    return box.values.toList(growable: false);
  }

  @override
  Future<void> put(String id, String serializedMutation) async {
    final box = await _ensureBox();
    await box.put(id, serializedMutation);
  }

  @override
  Future<void> delete(String id) async {
    final box = await _ensureBox();
    await box.delete(id);
  }
}

/// Result summary returned by [OfflineOutbox.flush].
@immutable
class OutboxFlushResult {
  final int succeededCount;
  final int droppedCount;
  final int remainingCount;

  const OutboxFlushResult({
    required this.succeededCount,
    required this.droppedCount,
    required this.remainingCount,
  });
}

typedef OutboxExecutor = Future<OutboxDeliveryOutcome> Function(OutboxMutation mutation);

/// Ordered, idempotent offline mutation queue for field operations in dead zones.
class OfflineOutbox {
  final OutboxStore _store;

  OfflineOutbox({OutboxStore? store}) : _store = store ?? HiveOutboxStore();

  /// Enqueues an idempotent mutation. Re-using the same [id] replaces the pending entry.
  Future<void> enqueue(OutboxMutation mutation) async {
    await _store.put(mutation.id, jsonEncode(mutation.toJson()));
  }

  /// Returns all pending mutations ordered oldest-first by [OutboxMutation.createdAt].
  Future<List<OutboxMutation>> listPending() async {
    final rawEntries = await _store.readAll();
    final parsed = <OutboxMutation>[];
    for (final raw in rawEntries) {
      try {
        final map = jsonDecode(raw) as Map<String, dynamic>;
        parsed.add(OutboxMutation.fromJson(map));
      } catch (_) {
        // Skip corrupted entries without crashing the queue.
      }
    }
    parsed.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return parsed;
  }

  /// Flushes pending mutations in FIFO order until the queue is empty or a transient error occurs.
  Future<OutboxFlushResult> flush(OutboxExecutor executor) async {
    final pending = await listPending();
    var succeeded = 0;
    var dropped = 0;

    for (var i = 0; i < pending.length; i++) {
      final item = pending[i];
      try {
        final outcome = await executor(item);
        switch (outcome) {
          case OutboxDeliveryOutcome.succeeded:
            await _store.delete(item.id);
            succeeded++;
            break;
          case OutboxDeliveryOutcome.permanentFailure:
            await _store.delete(item.id);
            dropped++;
            break;
          case OutboxDeliveryOutcome.transientFailure:
            await _store.put(
              item.id,
              jsonEncode(
                item
                    .copyWith(
                      retryCount: item.retryCount + 1,
                      lastError: 'Transient delivery failure',
                    )
                    .toJson(),
              ),
            );
            return OutboxFlushResult(
              succeededCount: succeeded,
              droppedCount: dropped,
              remainingCount: pending.length - i,
            );
        }
      } catch (e) {
        await _store.put(
          item.id,
          jsonEncode(
            item
                .copyWith(
                  retryCount: item.retryCount + 1,
                  lastError: e.toString(),
                )
                .toJson(),
          ),
        );
        return OutboxFlushResult(
          succeededCount: succeeded,
          droppedCount: dropped,
          remainingCount: pending.length - i,
        );
      }
    }

    return OutboxFlushResult(
      succeededCount: succeeded,
      droppedCount: dropped,
      remainingCount: 0,
    );
  }
}
