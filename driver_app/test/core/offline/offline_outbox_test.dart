import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/core/offline/offline_outbox.dart';

class _InMemoryOutboxStore implements OutboxStore {
  final Map<String, String> _data = {};

  @override
  Future<void> delete(String id) async {
    _data.remove(id);
  }

  @override
  Future<void> put(String id, String serializedMutation) async {
    _data[id] = serializedMutation;
  }

  @override
  Future<List<String>> readAll() async {
    return _data.values.toList(growable: false);
  }
}

void main() {
  group('OfflineOutbox', () {
    test('enqueues mutations and orders pending list oldest-first', () async {
      final outbox = OfflineOutbox(store: _InMemoryOutboxStore());

      await outbox.enqueue(
        OutboxMutation(
          id: 'req-2',
          entityType: 'pretrip',
          method: 'POST',
          endpoint: '/api/pretrip',
          payload: const {'unit': '102'},
          createdAt: DateTime.utc(2026, 11, 18, 10, 5),
        ),
      );
      await outbox.enqueue(
        OutboxMutation(
          id: 'req-1',
          entityType: 'dispatch',
          method: 'POST',
          endpoint: '/api/dispatch/checkin',
          payload: const {'route': 'R101'},
          createdAt: DateTime.utc(2026, 11, 18, 10, 0),
        ),
      );

      final pending = await outbox.listPending();
      expect(pending.map((m) => m.id).toList(), ['req-1', 'req-2']);
    });

    test('flushes succeeded and permanentFailure items while stopping on transientFailure', () async {
      final outbox = OfflineOutbox(store: _InMemoryOutboxStore());

      await outbox.enqueue(
        OutboxMutation(
          id: 'm1',
          entityType: 'dispatch',
          method: 'POST',
          endpoint: '/api/dispatch/checkin',
          payload: const {},
          createdAt: DateTime.utc(2026, 11, 18, 8, 0),
        ),
      );
      await outbox.enqueue(
        OutboxMutation(
          id: 'm2',
          entityType: 'defect',
          method: 'POST',
          endpoint: '/api/defects',
          payload: const {},
          createdAt: DateTime.utc(2026, 11, 18, 8, 1),
        ),
      );
      await outbox.enqueue(
        OutboxMutation(
          id: 'm3',
          entityType: 'pretrip',
          method: 'POST',
          endpoint: '/api/pretrip',
          payload: const {},
          createdAt: DateTime.utc(2026, 11, 18, 8, 2),
        ),
      );

      final result = await outbox.flush((mutation) async {
        if (mutation.id == 'm1') return OutboxDeliveryOutcome.succeeded;
        if (mutation.id == 'm2') return OutboxDeliveryOutcome.permanentFailure;
        return OutboxDeliveryOutcome.transientFailure;
      });

      expect(result.succeededCount, 1);
      expect(result.droppedCount, 1);
      expect(result.remainingCount, 1);

      final remaining = await outbox.listPending();
      expect(remaining, hasLength(1));
      expect(remaining.first.id, 'm3');
      expect(remaining.first.retryCount, 1);
    });
  });
}
