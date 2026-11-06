import 'dart:convert';
import 'dart:io';

import 'package:driver_app/features/student_incident/models/student_incident_model.dart';
import 'package:driver_app/features/student_incident/repository/student_incident_repository.dart';
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

Map<String, dynamic> _incidentJson(String id) => {
      'id': id,
      'incidentDate': '2026-11-05',
      'incidentTime': '08:10',
      'studentId': 12,
      'studentName': 'Avery Chen',
      'routeNo': 'R-4',
      'driverId': 'driver-1',
      'driverName': 'Alex',
      'description': 'Left the seat while the bus was moving.',
      'incidentTypes': ['safety_violation'],
      'status': 'submitted',
      'createdAt': '2026-11-05T08:10:00.000Z',
      'updatedAt': '2026-11-05T08:10:00.000Z',
    };

StudentIncident _draft() {
  final now = DateTime.utc(2026, 11, 5, 8, 10);
  return StudentIncident(
    id: '',
    incidentDate: '2026-11-05',
    incidentTime: '08:10',
    studentName: 'Avery Chen',
    routeNo: 'R-4',
    driverId: 'driver-1',
    driverName: 'Alex',
    description: 'Left the seat while the bus was moving.',
    incidentTypes: const ['safety_violation'],
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_incident_test_');
    Hive.init(tempDir.path);
  });

  tearDown(() async {
    await Hive.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test('a confirmed empty incident list stays empty', () async {
    final repo = StudentIncidentRepository(
      httpClient: _MutableClient(http.Response('[]', 200)),
    );
    expect(await repo.getStudentIncidents(driverId: 'driver-1'), isEmpty);
  });

  test('a failed incident lookup is not reported as an empty list', () async {
    final repo = StudentIncidentRepository(
      httpClient: _MutableClient(http.Response('unavailable', 503)),
    );
    expect(
      () => repo.getStudentIncidents(driverId: 'driver-1'),
      throwsA(isA<StudentIncidentLookupException>()),
    );
  });

  test('an invalid incident payload is not reported as an empty list', () async {
    final repo = StudentIncidentRepository(
      httpClient: _MutableClient(http.Response('{"ok":true}', 200)),
    );
    expect(
      () => repo.getStudentIncidents(driverId: 'driver-1'),
      throwsA(isA<StudentIncidentLookupException>()),
    );
  });

  test('a cached incident list is kept when the server later fails', () async {
    final client = _MutableClient(http.Response(
      jsonEncode([_incidentJson('inc-1')]),
      200,
    ));
    final repo = StudentIncidentRepository(httpClient: client);
    await repo.init();

    final first = await repo.getStudentIncidents(driverId: 'driver-1');
    expect(first.single.id, 'inc-1');

    client.response = http.Response('unavailable', 503);
    final second = await repo.getStudentIncidents(driverId: 'driver-1');
    expect(second.single.id, 'inc-1');
  });

  test('a confirmed empty list replaces a cached incident', () async {
    final client = _MutableClient(http.Response(
      jsonEncode([_incidentJson('inc-1')]),
      200,
    ));
    final repo = StudentIncidentRepository(httpClient: client);
    await repo.init();
    await repo.getStudentIncidents(driverId: 'driver-1');

    client.response = http.Response('[]', 200);
    expect(await repo.getStudentIncidents(driverId: 'driver-1'), isEmpty);
  });

  test('a rejected incident submit is not stored as success', () async {
    final client = _MutableClient(http.Response(
      '{"error":"studentName is required"}',
      400,
    ));
    final repo = StudentIncidentRepository(httpClient: client);

    expect(
      () => repo.submitStudentIncident(_draft()),
      throwsA(predicate<Exception>(
        (error) => error.toString().contains('studentName is required'),
      )),
    );
    expect(client.sends, 1);
  });

  test('an unanswered incident submit does not return a local record', () async {
    final client = _OfflineClient();
    final repo = StudentIncidentRepository(httpClient: client);
    await repo.init();

    expect(
      () => repo.submitStudentIncident(_draft()),
      throwsA(predicate<Exception>(
        (error) => error.toString().contains('did not respond'),
      )),
    );
    expect(client.sends, 1);
    expect(
      () => repo.getStudentIncidents(driverId: 'driver-1'),
      throwsA(isA<StudentIncidentLookupException>()),
    );
  });
}
