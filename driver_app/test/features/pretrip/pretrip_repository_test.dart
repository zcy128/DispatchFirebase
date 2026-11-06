import 'dart:convert';
import 'dart:io';

import 'package:driver_app/features/pretrip/models/pretrip_model.dart';
import 'package:driver_app/features/pretrip/repository/pretrip_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;

class _MutableClient extends http.BaseClient {
  http.Response response;
  int sends = 0;

  _MutableClient(this.response);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    sends += 1;
    return http.StreamedResponse(
      Stream<List<int>>.value(utf8.encode(response.body)),
      response.statusCode,
      request: request,
    );
  }
}

Map<String, dynamic> _inspectionBody(String overallStatus) => {
      'found': true,
      'inspection': {
        'vehicleUnit': '1001',
        'inspectionDate': '2026-11-05',
        'inspectionTime': '07:00',
        'inspectorId': 'EMP-1',
        'inspectorName': 'Alex',
        'overallStatus': overallStatus,
        'signatureName': 'Alex',
        'odometer': 1200,
        'items': {},
        'createdAt': '2026-11-05T07:00:00.000',
        'updatedAt': '2026-11-05T07:00:00.000',
      },
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_pretrip_test_');
    Hive.init(tempDir.path);
  });

  tearDown(() async {
    await Hive.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test('fleet list is empty when Firestore is unavailable', () async {
    final repo = PreTripRepository(
      httpClient: _MutableClient(http.Response('[]', 200)),
    );
    expect(await repo.getFleetVehicleUnits(), isEmpty);
  });

  test('confirmed absence is null and a failed lookup throws', () async {
    final client = _MutableClient(http.Response('{"found":false}', 200));
    final repo = PreTripRepository(httpClient: client);
    expect(await repo.getTodayInspection('1001', '2026-11-05'), isNull);

    client.response = http.Response('unavailable', 503);
    expect(
      () => repo.getTodayInspection('1001', '2026-11-05'),
      throwsA(isA<PreTripLookupException>()),
    );
  });

  test('a major-defect inspection does not release the bus', () async {
    final client = _MutableClient(http.Response(
      jsonEncode(_inspectionBody('failed_major_defects')),
      200,
    ));
    final repo = PreTripRepository(httpClient: client);
    await repo.init();

    final reason = await repo.checkInBlockReason('1001', '2026-11-05');
    expect(reason, contains('major defect'));
    expect(await repo.isVehicleInspectedToday('1001', '2026-11-05'), isFalse);

    client.response = http.Response('unavailable', 503);
    expect(await repo.isVehicleInspectedToday('1001', '2026-11-05'), isFalse);
  });

  test('a passing inspection stays usable when the server later fails', () async {
    final client = _MutableClient(http.Response(
      jsonEncode(_inspectionBody('passed')),
      200,
    ));
    final repo = PreTripRepository(httpClient: client);
    await repo.init();

    expect(await repo.isVehicleInspectedToday('1001', '2026-11-05'), isTrue);

    client.response = http.Response('unavailable', 503);
    expect(await repo.isVehicleInspectedToday('1001', '2026-11-05'), isTrue);
  });

  test('a legacy inspected flag does not release the bus offline', () async {
    final client = _MutableClient(http.Response('unavailable', 503));
    final repo = PreTripRepository(httpClient: client);
    await repo.init();
    final box = await Hive.openBox('driver_pretrip_v1');
    await box.put('inspected_1001_2026-11-05', true);

    expect(await repo.isVehicleInspectedToday('1001', '2026-11-05'), isFalse);
  });

  test('odometer lookup distinguishes a reading from a failed request', () async {
    final client = _MutableClient(http.Response('{"odometer":1200}', 200));
    final repo = PreTripRepository(httpClient: client);
    expect(await repo.getVehicleOdometer('1001'), 1200);

    client.response = http.Response('missing', 404);
    expect(
      () => repo.getVehicleOdometer('1001'),
      throwsA(isA<PreTripLookupException>()),
    );
  });

  test('submit rejects a zero odometer before calling the server', () async {
    final client = _MutableClient(http.Response('{}', 500));
    final repo = PreTripRepository(httpClient: client);
    final now = DateTime(2026, 11, 5, 7);
    final record = PreTripInspectionRecord(
      vehicleUnit: '1001',
      inspectionDate: '2026-11-05',
      inspectionTime: '07:00',
      inspectorId: 'EMP-1',
      inspectorName: 'Alex',
      odometer: 0,
      items: const {},
      signatureName: 'Alex',
      createdAt: now,
      updatedAt: now,
    );

    expect(() => repo.submitInspection(record), throwsA(isA<Exception>()));
    expect(client.sends, 0);
  });
}
