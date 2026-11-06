import 'dart:convert';
import 'dart:io';

import 'package:driver_app/features/route/repository/route_repository.dart';
import 'package:driver_app/features/timesheet/repository/timesheet_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;

class _ScriptedClient extends http.BaseClient {
  final http.Response response;

  _ScriptedClient(this.response);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    return http.StreamedResponse(
      Stream<List<int>>.value(utf8.encode(response.body)),
      response.statusCode,
      request: request,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_timesheet_test_');
    Hive.init(tempDir.path);
  });

  tearDown(() async {
    await Hive.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test('roundMoney uses half-up at two decimal places', () {
    expect(TimesheetRepository.roundMoney(1.225), 1.23);
    expect(TimesheetRepository.roundMoney(1.005), 1.01);
    expect(TimesheetRepository.roundMoney(10.004), 10.00);
  });

  test('an empty payroll list does not invent approved shifts', () async {
    final repository = TimesheetRepository(
      apiBaseUrl: 'http://example.test',
      httpClient: _ScriptedClient(http.Response('[]', 200)),
    );

    final summary = await repository.loadBiweeklyTimesheet(
      driverId: 'driver1d',
      driverName: 'David Miller',
      startDate: '2026-11-01',
    );

    expect(summary.shifts, isEmpty);
    expect(summary.totalPay, 0);
    expect(summary.shifts.any((shift) => shift.id.startsWith('TS-')), isFalse);
  });

  test('a failed payroll sync is reported instead of a sample timesheet', () async {
    final repository = TimesheetRepository(
      apiBaseUrl: 'http://example.test',
      httpClient: _ScriptedClient(http.Response('unavailable', 503)),
    );

    await expectLater(
      repository.loadBiweeklyTimesheet(
        driverId: 'driver1d',
        driverName: 'David Miller',
        startDate: '2026-11-01',
      ),
      throwsA(isA<TimesheetSyncException>()),
    );
  });

  test('zero-pay rows stay on the timesheet and week totals add up', () async {
    final body = jsonEncode([
      {
        'id': 'pay-1',
        'dispatchDate': '2026-11-02',
        'routeNo': 'R-1',
        'routeName': 'Route 1',
        'shiftType': 'AM',
        'employeeId': 'driver1d',
        'employeeName': 'David Miller',
        'payAmount': 0.015,
        'eiHours': 2.5,
        'status': 'completed',
      },
      {
        'id': 'pay-2',
        'dispatchDate': '2026-11-02',
        'routeNo': 'R-1',
        'routeName': 'Route 1',
        'shiftType': 'PM',
        'employeeId': 'driver1d',
        'employeeName': 'David Miller',
        'payAmount': 0.015,
        'eiHours': 2.5,
        'status': 'completed',
      },
    ]);
    final repository = TimesheetRepository(
      apiBaseUrl: 'http://example.test',
      httpClient: _ScriptedClient(http.Response(body, 200)),
    );

    final summary = await repository.loadBiweeklyTimesheet(
      driverId: 'driver1d',
      driverName: 'David Miller',
      startDate: '2026-11-01',
    );

    expect(summary.shifts, hasLength(2));
    expect(summary.totalPay, 0.04);
    expect(summary.week1Pay + summary.week2Pay, summary.totalPay);
    expect(summary.shifts.first.status, 'completed');
  });

  test('a logged holiday shift does not also create the other run', () async {
    final routes = RouteRepository();
    await routes.init();
    final body = jsonEncode([
      {
        'id': 'pay-am',
        'dispatchDate': '2026-10-12',
        'routeNo': 'OCDSB-001',
        'routeName': 'Route 001 - Hillcrest High School',
        'shiftType': 'AM',
        'employeeId': 'driver1d',
        'employeeName': 'David Miller',
        'payAmount': 40,
        'eiHours': 2.5,
        'status': 'approved',
      },
    ]);
    final repository = TimesheetRepository(
      apiBaseUrl: 'http://example.test',
      httpClient: _ScriptedClient(http.Response(body, 200)),
      routeRepository: routes,
    );

    final summary = await repository.loadBiweeklyTimesheet(
      driverId: 'driver1d',
      driverName: 'David Miller',
      startDate: '2026-10-11',
    );

    final holidayShifts = summary.shifts.where((shift) => shift.isHolidayCredit).toList();
    expect(holidayShifts, hasLength(1));
    expect(holidayShifts.single.shiftType, 'PM');
    expect(holidayShifts.single.payAmount, 44.40);
    expect(holidayShifts.single.eiHours, 3);
    expect(summary.shifts.any((shift) => shift.id.startsWith('TS-')), isFalse);
  });
}
