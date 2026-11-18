import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:driver_app/core/offline/http_outbox_sync_service.dart';
import 'package:driver_app/core/offline/offline_outbox.dart';
import 'package:driver_app/features/defect/models/defect_model.dart';
import 'package:driver_app/features/defect/repository/defect_repository.dart';
import 'package:driver_app/features/pretrip/models/pretrip_model.dart';
import 'package:driver_app/features/pretrip/repository/pretrip_repository.dart';

class _InMemoryOutboxStore implements OutboxStore {
  final Map<String, String> _data = {};

  @override
  Future<void> delete(String id) async => _data.remove(id);

  @override
  Future<void> put(String id, String serializedMutation) async {
    _data[id] = serializedMutation;
  }

  @override
  Future<List<String>> readAll() async => _data.values.toList(growable: false);
}

class _StubHttpClient extends http.BaseClient {
  final Future<http.Response> Function(http.BaseRequest request) handler;
  final List<http.BaseRequest> recordedRequests = [];

  _StubHttpClient(this.handler);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    recordedRequests.add(request);
    final res = await handler(request);
    return http.StreamedResponse(
      Stream<List<int>>.value(res.bodyBytes),
      res.statusCode,
      headers: res.headers,
      request: request,
    );
  }
}

void main() {
  group('HttpOutboxSyncService', () {
    test('flushes queued mutations with X-Idempotency-Key and removes 2xx items', () async {
      final outbox = OfflineOutbox(store: _InMemoryOutboxStore());
      final client = _StubHttpClient((request) async {
        expect(request.headers['X-Idempotency-Key'], isNotEmpty);
        return http.Response('{"ok":true}', 201);
      });

      final syncService = HttpOutboxSyncService(
        outbox: outbox,
        httpClient: client,
        apiBaseUrl: 'https://example.test',
      );

      await syncService.enqueueMutation(
        OutboxMutation(
          id: 'mut-1',
          entityType: 'dispatch_checkin',
          method: 'PUT',
          endpoint: '/api/dispatch/shifts/s1/check-in',
          payload: const {'checkInTime': '07:15 AM'},
          createdAt: DateTime.utc(2026, 11, 18, 7, 15),
        ),
      );

      final result = await syncService.flushPending();
      expect(result.succeededCount, 1);
      expect(result.remainingCount, 0);
      expect(client.recordedRequests.single.method, 'PUT');
      expect(
        client.recordedRequests.single.url.toString(),
        'https://example.test/api/dispatch/shifts/s1/check-in',
      );
    });

    test('DefectRepository queues on ClientException but not on 400 rejection', () async {
      final outbox = OfflineOutbox(store: _InMemoryOutboxStore());

      final offlineClient = _StubHttpClient((_) async {
        throw http.ClientException('offline');
      });
      final offlineRepo = DefectRepository(httpClient: offlineClient, outbox: outbox);

      final draft = VehicleDefectReport(
        id: '',
        vehicleId: 1,
        vehicleUnitNumber: '101',
        odometer: 12000,
        reportedByUserId: 'drv-1',
        reportedByName: 'Driver One',
        reportDate: '2026-11-18',
        reportTime: '08:00 AM',
        items: const [],
        noDefectsFound: true,
        confirmedAccurate: true,
        status: DefectReportStatus.submitted,
        createdAt: DateTime.utc(2026, 11, 18),
        updatedAt: DateTime.utc(2026, 11, 18),
      );

      await expectLater(
        () => offlineRepo.submitDefectReport(draft),
        throwsA(isA<Exception>()),
      );
      final pendingAfterOffline = await outbox.listPending();
      expect(pendingAfterOffline, hasLength(1));
      expect(pendingAfterOffline.first.entityType, 'vehicle_defect');

      final rejectClient = _StubHttpClient(
        (_) async => http.Response('{"error":"invalid"}', 400),
      );
      final rejectRepo = DefectRepository(httpClient: rejectClient, outbox: outbox);
      await expectLater(
        () => rejectRepo.submitDefectReport(draft),
        throwsA(isA<Exception>()),
      );
      expect(await outbox.listPending(), hasLength(1));
    });

    test('PreTripRepository queues on ClientException when Firestore is unavailable', () async {
      final outbox = OfflineOutbox(store: _InMemoryOutboxStore());
      final offlineClient = _StubHttpClient((_) async {
        throw http.ClientException('offline');
      });
      final repo = PreTripRepository(httpClient: offlineClient, outbox: outbox);

      final record = PreTripInspectionRecord(
        vehicleUnit: '101',
        inspectionDate: '2026-11-18',
        inspectionTime: '07:00',
        inspectorId: 'drv-1',
        inspectorName: 'Driver One',
        odometer: 12000,
        items: const {},
        signatureName: 'Driver One',
        createdAt: DateTime.utc(2026, 11, 18, 7),
        updatedAt: DateTime.utc(2026, 11, 18, 7),
      );

      await expectLater(
        () => repo.submitInspection(record),
        throwsA(isA<Exception>()),
      );
      final pending = await outbox.listPending();
      expect(pending, hasLength(1));
      expect(pending.first.entityType, 'pretrip_inspection');
      expect(pending.first.endpoint, '/api/pretrip-inspections');
    });
  });
}
