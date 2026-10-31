import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:driver_app/features/forms/models/time_off_model.dart';
import 'package:driver_app/features/forms/repository/time_off_repository.dart';
import 'package:driver_app/features/forms/bloc/time_off_bloc.dart';
import 'package:driver_app/features/forms/bloc/time_off_event.dart';
import 'package:driver_app/features/forms/bloc/time_off_state.dart';

void main() {
  late Directory tempDir;
  late TimeOffRepository repository;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_time_off_test_');
    Hive.init(tempDir.path);
    repository = TimeOffRepository();
    await repository.init();
  });

  tearDown(() async {
    await Hive.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('TimeOffRequestModel Tests', () {
    test('serializes and deserializes properly with toMap and fromMap', () {
      const model = TimeOffRequestModel(
        id: 'TOR-1001',
        employeeId: 'EMP-021',
        employeeNumber: '21',
        employeeName: 'Driver 21',
        leaveType: TimeOffLeaveType.vacation,
        startDate: '2026-10-15',
        endDate: '2026-10-18',
        shiftType: TimeOffShiftType.all,
        comments: 'Annual family vacation',
        status: TimeOffStatus.pending,
        createdAt: '2026-09-30T12:00:00Z',
        updatedAt: '2026-09-30T12:00:00Z',
      );

      final map = model.toMap();
      expect(map['id'], equals('TOR-1001'));
      expect(map['employeeId'], equals('EMP-021'));
      expect(map['leaveType'], equals('vacation'));
      expect(map['shiftType'], equals('ALL'));
      expect(map['status'], equals('pending'));

      final fromMap = TimeOffRequestModel.fromMap(map, 'TOR-1001');
      expect(fromMap.id, equals(model.id));
      expect(fromMap.employeeId, equals(model.employeeId));
      expect(fromMap.leaveType, equals(TimeOffLeaveType.vacation));
      expect(fromMap.shiftType, equals(TimeOffShiftType.all));
      expect(fromMap.status, equals(TimeOffStatus.pending));
      expect(fromMap.durationDays, equals(4)); // Oct 15, 16, 17, 18 = 4 days
    });

    test('durationDays accurately calculates single and multi-day spans', () {
      const singleDay = TimeOffRequestModel(
        id: 'TOR-1',
        employeeId: 'EMP-021',
        employeeName: 'Driver',
        leaveType: TimeOffLeaveType.sickLeave,
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        createdAt: '2026-09-30',
        updatedAt: '2026-09-30',
      );
      expect(singleDay.durationDays, equals(1));

      const twoDays = TimeOffRequestModel(
        id: 'TOR-2',
        employeeId: 'EMP-021',
        employeeName: 'Driver',
        leaveType: TimeOffLeaveType.personalDays,
        startDate: '2026-10-10',
        endDate: '2026-10-11',
        createdAt: '2026-09-30',
        updatedAt: '2026-09-30',
      );
      expect(twoDays.durationDays, equals(2));
    });

    test('leaveType and shiftType safely fallback to defaults for unknown codes', () {
      expect(TimeOffLeaveType.fromCode('unknown_xyz'), equals(TimeOffLeaveType.other));
      expect(TimeOffShiftType.fromCode('invalid'), equals(TimeOffShiftType.all));
      expect(TimeOffStatus.fromCode('bad_status'), equals(TimeOffStatus.pending));
    });
  });

  group('TimeOffRepository Tests', () {
    test('creates and retrieves time-off requests from Hive cache', () async {
      const request = TimeOffRequestModel(
        id: 'TOR-2001',
        employeeId: 'EMP-021',
        employeeName: 'Driver 21',
        leaveType: TimeOffLeaveType.sickLeave,
        startDate: '2026-10-05',
        endDate: '2026-10-06',
        comments: 'Medical appointment',
        createdAt: '2026-09-30T10:00:00Z',
        updatedAt: '2026-09-30T10:00:00Z',
      );

      await repository.createTimeOffRequest(request);

      final list = repository.getTimeOffRequests(employeeId: 'EMP-021');
      expect(list.length, equals(1));
      expect(list.first.id, equals('TOR-2001'));
      expect(list.first.leaveType, equals(TimeOffLeaveType.sickLeave));
      expect(list.first.status, equals(TimeOffStatus.pending));
    });

    test('cancels existing pending time-off request in cache if created today', () async {
      final nowStr = DateTime.now().toIso8601String();
      final request = TimeOffRequestModel(
        id: 'TOR-2002',
        employeeId: 'EMP-001',
        employeeName: 'Driver 1',
        leaveType: TimeOffLeaveType.vacation,
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        createdAt: nowStr,
        updatedAt: nowStr,
      );

      await repository.createTimeOffRequest(request);

      final cancelled = await repository.cancelTimeOffRequest('TOR-2002');
      expect(cancelled.status, equals(TimeOffStatus.cancelled));

      final retrieved = repository.getTimeOffRequestById('TOR-2002');
      expect(retrieved?.status, equals(TimeOffStatus.cancelled));
    });

    test('rejects cancellation if request is approved, rejected, or created on past days', () async {
      final yesterdayStr = DateTime.now().subtract(const Duration(days: 1)).toIso8601String();
      final pastRequest = TimeOffRequestModel(
        id: 'TOR-PAST',
        employeeId: 'EMP-001',
        employeeName: 'Driver 1',
        leaveType: TimeOffLeaveType.vacation,
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        status: TimeOffStatus.pending,
        createdAt: yesterdayStr,
        updatedAt: yesterdayStr,
      );
      expect(pastRequest.canCancelByDriver, isFalse);

      await repository.createTimeOffRequest(pastRequest);
      expect(
        () => repository.cancelTimeOffRequest('TOR-PAST'),
        throwsA(isA<StateError>()),
      );

      final approvedRequest = TimeOffRequestModel(
        id: 'TOR-APPROVED',
        employeeId: 'EMP-001',
        employeeName: 'Driver 1',
        leaveType: TimeOffLeaveType.vacation,
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        status: TimeOffStatus.approved,
        createdAt: DateTime.now().toIso8601String(),
        updatedAt: DateTime.now().toIso8601String(),
      );
      expect(approvedRequest.canCancelByDriver, isFalse);

      await repository.createTimeOffRequest(approvedRequest);
      expect(
        () => repository.cancelTimeOffRequest('TOR-APPROVED'),
        throwsA(isA<StateError>()),
      );
    });

    test('filters time off requests by employee alias matching', () async {
      const req1 = TimeOffRequestModel(
        id: 'TOR-3001',
        employeeId: 'EMP-021',
        employeeName: 'Driver 21',
        leaveType: TimeOffLeaveType.vacation,
        startDate: '2026-10-20',
        endDate: '2026-10-21',
        createdAt: '2026-09-30T10:00:00Z',
        updatedAt: '2026-09-30T10:00:00Z',
      );
      const req2 = TimeOffRequestModel(
        id: 'TOR-3002',
        employeeId: 'EMP-001',
        employeeName: 'Driver 1',
        leaveType: TimeOffLeaveType.sickLeave,
        startDate: '2026-10-22',
        endDate: '2026-10-22',
        createdAt: '2026-09-30T11:00:00Z',
        updatedAt: '2026-09-30T11:00:00Z',
      );

      await repository.createTimeOffRequest(req1);
      await repository.createTimeOffRequest(req2);

      // Querying with alias driver21d matches EMP-021
      final driver21List = repository.getTimeOffRequests(employeeId: 'driver21d');
      expect(driver21List.length, equals(1));
      expect(driver21List.first.id, equals('TOR-3001'));

      // Querying with alias driver1d matches EMP-001
      final driver1List = repository.getTimeOffRequests(employeeId: 'driver1d');
      expect(driver1List.length, equals(1));
      expect(driver1List.first.id, equals('TOR-3002'));
    });
  });

  group('TimeOffBloc State Flow Tests', () {
    test('LoadTimeOffRequestsEvent emits TimeOffLoading and TimeOffLoaded', () async {
      final bloc = TimeOffBloc(repository: repository);

      bloc.add(const LoadTimeOffRequestsEvent('EMP-021'));

      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<TimeOffLoading>(),
          isA<TimeOffLoaded>(),
        ]),
      );

      expect(bloc.state, isA<TimeOffLoaded>());
      final loaded = bloc.state as TimeOffLoaded;
      expect(loaded.totalCount, equals(0));

      await bloc.close();
    });

    test('CreateTimeOffRequestEvent persists and updates state smoothly', () async {
      final bloc = TimeOffBloc(repository: repository);
      bloc.add(const LoadTimeOffRequestsEvent('EMP-021'));
      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<TimeOffLoading>(),
          isA<TimeOffLoaded>(),
        ]),
      );

      const newReq = TimeOffRequestModel(
        id: 'TOR-4001',
        employeeId: 'EMP-021',
        employeeName: 'Driver 21',
        leaveType: TimeOffLeaveType.juryDuty,
        startDate: '2026-10-25',
        endDate: '2026-10-26',
        createdAt: '2026-09-30T12:00:00Z',
        updatedAt: '2026-09-30T12:00:00Z',
      );

      bloc.add(const CreateTimeOffRequestEvent(newReq));
      await Future.delayed(const Duration(milliseconds: 100));

      expect(bloc.state, isA<TimeOffLoaded>());
      final loaded = bloc.state as TimeOffLoaded;
      expect(loaded.totalCount, equals(1));
      expect(loaded.pendingCount, equals(1));
      expect(loaded.requests.first.id, equals('TOR-4001'));

      await bloc.close();
    });

    test('FilterTimeOffStatusEvent filters requests accurately', () async {
      final bloc = TimeOffBloc(repository: repository);
      bloc.add(const LoadTimeOffRequestsEvent('EMP-021'));
      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<TimeOffLoading>(),
          isA<TimeOffLoaded>(),
        ]),
      );

      // Simulate snapshot push with 1 pending, 1 approved, 1 rejected
      final requests = [
        const TimeOffRequestModel(
          id: 'TOR-1',
          employeeId: 'EMP-021',
          employeeName: 'Driver',
          leaveType: TimeOffLeaveType.vacation,
          startDate: '2026-10-15',
          endDate: '2026-10-16',
          status: TimeOffStatus.pending,
          createdAt: '2026-09-30T10:00:00Z',
          updatedAt: '2026-09-30T10:00:00Z',
        ),
        const TimeOffRequestModel(
          id: 'TOR-2',
          employeeId: 'EMP-021',
          employeeName: 'Driver',
          leaveType: TimeOffLeaveType.sickLeave,
          startDate: '2026-10-18',
          endDate: '2026-10-18',
          status: TimeOffStatus.approved,
          createdAt: '2026-09-30T11:00:00Z',
          updatedAt: '2026-09-30T11:00:00Z',
        ),
        const TimeOffRequestModel(
          id: 'TOR-3',
          employeeId: 'EMP-021',
          employeeName: 'Driver',
          leaveType: TimeOffLeaveType.personalDays,
          startDate: '2026-10-20',
          endDate: '2026-10-20',
          status: TimeOffStatus.rejected,
          createdAt: '2026-09-30T12:00:00Z',
          updatedAt: '2026-09-30T12:00:00Z',
        ),
      ];

      final nextLoaded = bloc.stream.firstWhere((s) => s is TimeOffLoaded && s.totalCount == 3);
      bloc.add(FirestoreTimeOffUpdatedEvent(requests));
      var loaded = (await nextLoaded) as TimeOffLoaded;
      expect(loaded.totalCount, equals(3));
      expect(loaded.pendingCount, equals(1));
      expect(loaded.approvedCount, equals(1));
      expect(loaded.rejectedCount, equals(1));

      // Filter by Approved
      final filterApprovedFuture = bloc.stream.firstWhere((s) => s is TimeOffLoaded && s.statusFilter == TimeOffStatus.approved);
      bloc.add(const FilterTimeOffStatusEvent(TimeOffStatus.approved));
      loaded = (await filterApprovedFuture) as TimeOffLoaded;
      expect(loaded.requests.length, equals(1));
      expect(loaded.requests.first.id, equals('TOR-2'));

      // Filter by Pending
      final filterPendingFuture = bloc.stream.firstWhere((s) => s is TimeOffLoaded && s.statusFilter == TimeOffStatus.pending);
      bloc.add(const FilterTimeOffStatusEvent(TimeOffStatus.pending));
      loaded = (await filterPendingFuture) as TimeOffLoaded;
      expect(loaded.requests.length, equals(1));
      expect(loaded.requests.first.id, equals('TOR-1'));

      // Clear filter (All)
      final filterAllFuture = bloc.stream.firstWhere((s) => s is TimeOffLoaded && s.statusFilter == null);
      bloc.add(const FilterTimeOffStatusEvent(null));
      loaded = (await filterAllFuture) as TimeOffLoaded;
      expect(loaded.requests.length, equals(3));

      await bloc.close();
    });
  });
}
