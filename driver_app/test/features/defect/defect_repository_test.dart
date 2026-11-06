import 'dart:convert';
import 'dart:io';

import 'package:driver_app/features/defect/models/defect_model.dart';
import 'package:driver_app/features/defect/repository/defect_repository.dart';
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

class _OfflineClient extends http.BaseClient {
  int sends = 0;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    sends += 1;
    throw http.ClientException('offline', request.url);
  }
}

Map<String, dynamic> _reportJson(String id) => {
      'id': id,
      'vehicleId': 21,
      'vehicleUnitNumber': '1021',
      'odometer': 1200,
      'reportedByUserId': 'driver-1',
      'reportedByName': 'Alex',
      'reportDate': '2026-11-05',
      'reportTime': '07:00',
      'items': [],
      'defectNotes': 'Service brake',
      'noDefectsFound': false,
      'confirmedAccurate': true,
      'status': 'submitted',
      'createdAt': '2026-11-05T07:00:00.000',
      'updatedAt': '2026-11-05T07:00:00.000',
    };

VehicleDefectReport _draft() {
  final now = DateTime(2026, 11, 5, 7);
  return VehicleDefectReport(
    id: '',
    vehicleId: 21,
    vehicleUnitNumber: '1021',
    odometer: 1200,
    reportedByUserId: 'driver-1',
    reportedByName: 'Alex',
    reportDate: '2026-11-05',
    reportTime: '07:00',
    items: const [],
    defectNotes: 'Service brake',
    noDefectsFound: false,
    confirmedAccurate: true,
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_defect_test_');
    Hive.init(tempDir.path);
  });

  tearDown(() async {
    await Hive.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test('fleet list is empty when Firestore is unavailable', () async {
    final repo = DefectRepository(
      httpClient: _MutableClient(http.Response('[]', 200)),
    );
    expect(await repo.getFleetVehicleUnits(), isEmpty);
  });

  test('a confirmed empty defect list stays empty', () async {
    final repo = DefectRepository(
      httpClient: _MutableClient(http.Response('[]', 200)),
    );
    expect(await repo.getDefectReports(driverId: 'driver-1'), isEmpty);
  });

  test('a failed defect lookup is not reported as an empty list', () async {
    final repo = DefectRepository(
      httpClient: _MutableClient(http.Response('unavailable', 503)),
    );
    expect(
      () => repo.getDefectReports(driverId: 'driver-1'),
      throwsA(isA<DefectLookupException>()),
    );
  });

  test('a cached defect list is kept when the server later fails', () async {
    final client = _MutableClient(http.Response(
      jsonEncode([_reportJson('def-1')]),
      200,
    ));
    final repo = DefectRepository(httpClient: client);
    await repo.init();

    final first = await repo.getDefectReports(driverId: 'driver-1');
    expect(first, hasLength(1));

    client.response = http.Response('unavailable', 503);
    final second = await repo.getDefectReports(driverId: 'driver-1');
    expect(second.single.id, 'def-1');
  });

  test('a rejected defect submit is not stored as success', () async {
    final client = _MutableClient(http.Response(
      '{"error":"vehicleUnitNumber is required"}',
      400,
    ));
    final repo = DefectRepository(httpClient: client);

    expect(
      () => repo.submitDefectReport(_draft()),
      throwsA(predicate<Exception>(
        (error) => error.toString().contains('vehicleUnitNumber is required'),
      )),
    );
    expect(client.sends, 1);
  });

  test('an unanswered defect submit does not return the local draft', () async {
    final client = _OfflineClient();
    final repo = DefectRepository(httpClient: client);

    expect(
      () => repo.submitDefectReport(_draft()),
      throwsA(predicate<Exception>(
        (error) => error.toString().contains('did not respond'),
      )),
    );
    expect(client.sends, 1);
  });
}
