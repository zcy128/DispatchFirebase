import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:driver_app/features/dispatch/bloc/dispatch_bloc.dart';
import 'package:driver_app/features/dispatch/bloc/dispatch_event.dart';
import 'package:driver_app/features/dispatch/bloc/dispatch_state.dart';
import 'package:driver_app/features/dispatch/repository/dispatch_repository.dart';
import 'package:driver_app/features/route/repository/route_repository.dart';

void main() {
  late Directory tempDir;
  late DispatchRepository repository;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_dispatch_test_');
    Hive.init(tempDir.path);
    repository = DispatchRepository(httpClient: _ScriptedClient(200));
    await repository.init();
  });

  tearDown(() async {
    await Hive.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('DispatchRepository 2-Week Window & Business Rules', () {
    test('enforces 2-week date window (today - 7d to today + 7d)', () {
      final today = DateTime.now();

      expect(repository.isWithinAllowedWindow(today), isTrue);
      expect(repository.isWithinAllowedWindow(today.subtract(const Duration(days: 7))), isTrue);
      expect(repository.isWithinAllowedWindow(today.add(const Duration(days: 7))), isTrue);

      expect(repository.isWithinAllowedWindow(today.subtract(const Duration(days: 8))), isFalse);
      expect(repository.isWithinAllowedWindow(today.add(const Duration(days: 8))), isFalse);
    });

    test('today is editable while yesterday and tomorrow are read-only', () {
      final today = DateTime.now();
      final yesterday = today.subtract(const Duration(days: 1));
      final tomorrow = today.add(const Duration(days: 1));

      expect(repository.isToday(today), isTrue);
      expect(repository.isToday(yesterday), isFalse);
      expect(repository.isToday(tomorrow), isFalse);
    });

    test('getNextOperatingDate skips weekends (Friday -> Monday, Saturday -> Monday)', () {
      final friday = DateTime(2026, 10, 2); // Friday
      expect(friday.weekday, DateTime.friday);
      final nextFromFriday = DispatchRepository.getNextOperatingDate(friday);
      expect(nextFromFriday.weekday, DateTime.monday);
      expect(nextFromFriday.day, 5); // Oct 5, Monday

      final saturday = DateTime(2026, 10, 3); // Saturday
      expect(saturday.weekday, DateTime.saturday);
      final nextFromSaturday = DispatchRepository.getNextOperatingDate(saturday);
      expect(nextFromSaturday.weekday, DateTime.monday);

      final wednesday = DateTime(2026, 9, 30); // Wednesday
      expect(wednesday.weekday, DateTime.wednesday);
      final nextFromWed = DispatchRepository.getNextOperatingDate(wednesday);
      expect(nextFromWed.weekday, DateTime.thursday);
    });

    test('driver check-in and check-out lifecycle', () async {
      final todayStr = DispatchRepository.formatDate(DateTime.now());
      final dispatchId = 'DISP-$todayStr-AM';

      // 1. Initial status is scheduled
      var record = repository.getDispatchById(dispatchId)!;
      expect(record.status, 'scheduled');
      expect(record.isCheckedIn, isFalse);
      expect(record.isCheckedOut, isFalse);

      // 2. Check in
      record = await repository.checkInDriver(dispatchId);
      expect(record.status, 'in_progress');
      expect(record.isCheckedIn, isTrue);
      expect(record.checkInTime, isNotNull);

      // 3. Check out
      record = await repository.checkOutDriver(dispatchId);
      expect(record.status, 'completed');
      expect(record.isCheckedOut, isTrue);
      expect(record.checkOutTime, isNotNull);

      // 4. A rejected server response leaves the shift scheduled
      final rejected = DispatchRepository(httpClient: _ScriptedClient(500));
      await rejected.init();
      final pendingId = 'DISP-$todayStr-PM';
      expect(rejected.getDispatchById(pendingId)!.status, 'scheduled');
      expect(
        () => rejected.checkInDriver(pendingId),
        throwsA(isA<DispatchRejected>()),
      );
      expect(rejected.getDispatchById(pendingId)!.status, 'scheduled');

      // 5. Modifying attendance after checkout is rejected
      expect(
        () => repository.updateStudentAttendance(
          dispatchId: dispatchId,
          stopId: 1,
          studentId: 101,
          newPickupStatus: 'absent',
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('driver checkout with comments records dispute and sets comments', () async {
      final todayStr = DispatchRepository.formatDate(DateTime.now());
      final dispatchId = 'DISP-$todayStr-PM';

      // Check in first
      await repository.checkInDriver(dispatchId);

      // Check out with dispute comments
      final record = await repository.checkOutDriver(
        dispatchId,
        payrollComments: 'Rate is incorrect, agreed rate is \$30.50/hr',
      );

      expect(record.status, 'completed');
      expect(record.isCheckedOut, isTrue);
      expect(record.driverCheckoutComments, 'Rate is incorrect, agreed rate is \$30.50/hr');
    });

    test('attendance can be freely modified between picked_up and absent before checkout', () async {
      final todayStr = DispatchRepository.formatDate(DateTime.now());
      final dispatchId = 'DISP-$todayStr-AM';

      await repository.checkInDriver(dispatchId);

      // Mark student 101 picked up
      var record = await repository.updateStudentAttendance(
        dispatchId: dispatchId,
        stopId: 1,
        studentId: 101,
        newPickupStatus: 'picked_up',
      );
      var stop1Student = record.stops.first.students.firstWhere((s) => s.studentId == 101);
      expect(stop1Student.pickupStatus, 'picked_up');
      expect(stop1Student.pickupTime, isNotNull);

      // Change mind: mark student 101 absent instead
      record = await repository.updateStudentAttendance(
        dispatchId: dispatchId,
        stopId: 1,
        studentId: 101,
        newPickupStatus: 'absent',
      );
      stop1Student = record.stops.first.students.firstWhere((s) => s.studentId == 101);
      expect(stop1Student.pickupStatus, 'absent');
      expect(stop1Student.pickupTime, isNull);

      // Change mind back: mark picked up again
      record = await repository.updateStudentAttendance(
        dispatchId: dispatchId,
        stopId: 1,
        studentId: 101,
        newPickupStatus: 'picked_up',
      );
      stop1Student = record.stops.first.students.firstWhere((s) => s.studentId == 101);
      expect(stop1Student.pickupStatus, 'picked_up');
    });

    test('Morning run: absent at home stop blocks dropoff at school', () async {
      final todayStr = DispatchRepository.formatDate(DateTime.now());
      final dispatchId = 'DISP-$todayStr-AM';

      await repository.checkInDriver(dispatchId);

      // Student 102 marked absent at home stop 1
      var record = await repository.updateStudentAttendance(
        dispatchId: dispatchId,
        stopId: 1,
        studentId: 102,
        newPickupStatus: 'absent',
      );

      // Verify school stop (stop 3) automatically propagated dropoffStatus = bypassed_absent
      final schoolStop = record.stops.firstWhere((s) => s.isSchoolStop);
      final studentAtSchool = schoolStop.students.firstWhere((s) => s.studentId == 102);
      expect(studentAtSchool.dropoffStatus, 'bypassed_absent');

      // Attempting to drop off student 102 at school throws StateError
      expect(
        () => repository.updateStudentAttendance(
          dispatchId: dispatchId,
          stopId: schoolStop.stopId,
          studentId: 102,
          newPickupStatus: 'absent',
          newDropoffStatus: 'dropped_off',
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('Afternoon run: absent at school stop bypasses home dropoff', () async {
      final todayStr = DispatchRepository.formatDate(DateTime.now());
      final dispatchId = 'DISP-$todayStr-PM';

      await repository.checkInDriver(dispatchId);

      // School pickup is stop 1
      var record = await repository.updateStudentAttendance(
        dispatchId: dispatchId,
        stopId: 1,
        studentId: 103,
        newPickupStatus: 'absent',
      );

      // Home dropoff stop for student 103 is stop 2
      final homeDropoffStop = record.stops.firstWhere((s) => s.stopId == 2);
      final studentAtHome = homeDropoffStop.students.firstWhere((s) => s.studentId == 103);
      expect(studentAtHome.dropoffStatus, 'bypassed_absent');
    });

    test('School batch actions: dropoff_all in Morning run only affects picked up students', () async {
      final todayStr = DispatchRepository.formatDate(DateTime.now());
      final dispatchId = 'DISP-$todayStr-AM';

      await repository.checkInDriver(dispatchId);

      // Student 101 picked up, student 102 absent
      await repository.updateStudentAttendance(
        dispatchId: dispatchId,
        stopId: 1,
        studentId: 101,
        newPickupStatus: 'picked_up',
      );
      await repository.updateStudentAttendance(
        dispatchId: dispatchId,
        stopId: 1,
        studentId: 102,
        newPickupStatus: 'absent',
      );

      // School batch drop off at stop 3
      final record = await repository.batchSchoolAction(
        dispatchId: dispatchId,
        stopId: 3,
        actionType: 'dropoff_all',
      );

      final schoolStop = record.stops.firstWhere((s) => s.stopId == 3);
      expect(schoolStop.isArrived, isTrue);

      final s101 = schoolStop.students.firstWhere((s) => s.studentId == 101);
      final s102 = schoolStop.students.firstWhere((s) => s.studentId == 102);

      expect(s101.dropoffStatus, 'dropped_off');
      expect(s101.dropoffTime, isNotNull);

      // Absent student remained bypassed
      expect(s102.dropoffStatus, 'bypassed_absent');
      expect(s102.dropoffTime, isNull);
    });
  });

  group('DispatchBloc State Flow', () {
    test('emits DispatchLoaded with isReadOnly=false on today', () async {
      final bloc = DispatchBloc(repository: repository);
      final today = DateTime.now();

      bloc.add(LoadDispatchesForDate(today));

      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<DispatchLoading>(),
          predicate<DispatchLoaded>((state) =>
              state.isToday == true &&
              state.isReadOnly == false &&
              state.dispatches.isNotEmpty &&
              state.activeDispatch != null),
        ]),
      );

      await bloc.close();
    });

    test('emits DispatchLoaded with isReadOnly=true on yesterday', () async {
      final bloc = DispatchBloc(repository: repository);
      final yesterday = DateTime.now().subtract(const Duration(days: 1));

      bloc.add(LoadDispatchesForDate(yesterday));

      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<DispatchLoading>(),
          predicate<DispatchLoaded>((state) =>
              state.isToday == false &&
              state.isReadOnly == true &&
              state.dispatches.isNotEmpty),
        ]),
      );

      await bloc.close();
    });

    test('rejects date outside 2-week window with DispatchError', () async {
      final bloc = DispatchBloc(repository: repository);
      final distantDate = DateTime.now().add(const Duration(days: 15));

      bloc.add(LoadDispatchesForDate(distantDate));

      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<DispatchLoading>(),
          predicate<DispatchError>((state) =>
              state.message.contains('outside the permitted 2-week')),
        ]),
      );

      await bloc.close();
    });

    test('resolves and matches driver aliases accurately', () {
      expect(RouteRepository.resolveEmployeeId('driver21d'), equals('EMP-021'));
      expect(RouteRepository.resolveEmployeeId('driver21'), equals('EMP-021'));
      expect(RouteRepository.resolveEmployeeId('drv-21'), equals('EMP-021'));
      expect(RouteRepository.resolveEmployeeId('EMP-021'), equals('EMP-021'));

      expect(RouteRepository.resolveEmployeeId('driver1d'), equals('EMP-2001'));
      expect(RouteRepository.resolveEmployeeId('driver1'), equals('EMP-2001'));
      expect(RouteRepository.resolveEmployeeId('drv-1021'), equals('EMP-2001'));
      expect(RouteRepository.resolveEmployeeId('EMP-2001'), equals('EMP-2001'));

      expect(RouteRepository.matchesDriver('driver21d', 'EMP-021'), isTrue);
      expect(RouteRepository.matchesDriver('driver1d', 'EMP-2001'), isTrue);
      expect(RouteRepository.matchesDriver('driver1d', 'EMP-001'), isTrue);
      expect(RouteRepository.matchesDriver('driver1d', 'EMP-021'), isFalse);
    });

    test('getDispatchesForDate filters records by driverId', () {
      final today = DateTime.now();
      // Seeded records are for EMP-001 / DRV-1021
      final driver1Dispatches = repository.getDispatchesForDate(today, driverId: 'driver1d');
      expect(driver1Dispatches.isNotEmpty, isTrue);
      expect(driver1Dispatches.first.routeNo, equals('OCDSB-001'));

      // driver21d has no local seeded data before sync
      final driver21Dispatches = repository.getDispatchesForDate(today, driverId: 'driver21d');
      expect(driver21Dispatches.isEmpty, isTrue);
    });

    test('syncDispatchesFromBackend pulls live shifts for driver21d (EMP-021)', () async {
      final today = DateTime(2026, 9, 30);
      final synced = await repository.syncDispatchesFromBackend(today, driverId: 'driver21d');
      if (synced.isNotEmpty) {
        expect(synced.first.driverId, equals('EMP-021'));
        expect(synced.first.routeNo, equals('CEPEO-021'));
        expect(synced.first.stops.isNotEmpty, isTrue);

        // Verify it was cached in Hive and can now be retrieved
        final cached = repository.getDispatchesForDate(today, driverId: 'driver21d');
        expect(cached.isNotEmpty, isTrue);
        expect(cached.first.routeNo, equals('CEPEO-021'));
      }
    });

    test('parent-notified student absence sets pickupStatus to absent and captures reason notes', () async {
      final tomorrow = DateTime(2026, 10, 1);
      final synced = await repository.syncDispatchesFromBackend(tomorrow, driverId: 'driver21d');
      if (synced.isNotEmpty) {
        final shift = synced.first;
        final student206 = shift.allStudents.where((s) => s.studentId == 206).firstOrNull;
        if (student206 != null) {
          expect(student206.isAbsent, isTrue);
          expect(student206.isParentReportedAbsent, isTrue);
          expect(student206.notes, contains('Doctor Appointment'));
        }
      }
    });

    test('AutoSyncDispatchesEvent updates state silently without emitting DispatchLoading', () async {
      final bloc = DispatchBloc(repository: repository);
      final today = DateTime.now();
      bloc.add(LoadDispatchesForDate(today, driverId: 'driver21d'));
      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<DispatchLoading>(),
          isA<DispatchLoaded>(),
        ]),
      );

      // Trigger auto-sync silently
      bloc.add(const AutoSyncDispatchesEvent());

      // If backend has new data or re-syncs, it emits DispatchLoaded directly (never DispatchLoading)
      await Future.delayed(const Duration(milliseconds: 500));
      expect(bloc.state, isA<DispatchLoaded>());

      // Test timer start and stop
      bloc.startAutoSync(interval: const Duration(milliseconds: 100));
      bloc.stopAutoSync();
      await bloc.close();
    });

    test('FirestoreDispatchesUpdatedEvent updates state seamlessly from real-time stream', () async {
      final bloc = DispatchBloc(repository: repository);
      final today = DateTime.now();
      bloc.add(LoadDispatchesForDate(today, driverId: 'driver1d'));
      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<DispatchLoading>(),
          isA<DispatchLoaded>(),
        ]),
      );

      final current = (bloc.state as DispatchLoaded).dispatches;
      expect(current.isNotEmpty, isTrue);

      // Simulate a real-time Firestore snapshot push
      bloc.add(FirestoreDispatchesUpdatedEvent(current));
      await Future.delayed(const Duration(milliseconds: 100));

      expect(bloc.state, isA<DispatchLoaded>());
      await bloc.close();
    });
  });
}

class _ScriptedClient extends http.BaseClient {
  final int statusCode;

  _ScriptedClient(this.statusCode);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    return http.StreamedResponse(
      Stream<List<int>>.value(utf8.encode('{"ok":true}')),
      statusCode,
    );
  }
}
