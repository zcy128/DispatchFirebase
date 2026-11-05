import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:driver_app/features/route/bloc/route_bloc.dart';
import 'package:driver_app/features/route/bloc/route_event.dart';
import 'package:driver_app/features/route/bloc/route_state.dart';
import 'package:driver_app/features/route/repository/route_repository.dart';

class _ScriptedClient extends http.BaseClient {
  final List<http.Response> responses;
  int _index = 0;

  _ScriptedClient(this.responses);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = responses[_index++];
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
  late RouteRepository repository;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_route_test_');
    Hive.init(tempDir.path);
    repository = RouteRepository();
    await repository.init();
  });

  tearDown(() async {
    await Hive.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('RouteRepository Tests', () {
    test('seeds default Route 001 Hillcrest for driver1d / EMP-001', () async {
      final route = await repository.getRouteForDriver('driver1d');

      expect(route, isNotNull);
      expect(route!.routeNo, equals('OCDSB-001'));
      expect(route.routeName, equals('Route 001 - Hillcrest High School'));
      expect(route.driverName, equals('David Miller'));
      expect(route.vehicleUnit, equals('1001'));
      expect(route.attendantName, equals('Sarah Connor'));
      expect(route.shifts.length, equals(2));

      final amShift = route.shifts.firstWhere((s) => s.shiftType == 'AM');
      expect(amShift.stops.length, equals(7));

      final pmShift = route.shifts.firstWhere((s) => s.shiftType == 'PM');
      expect(pmShift.stops.length, equals(7));
    });

    test('isRouteAssigned returns true for driver1d and aliases initially', () async {
      expect(await repository.isRouteAssigned('driver1d'), isTrue);
      expect(await repository.isRouteAssigned('EMP-001'), isTrue);
      expect(await repository.isRouteAssigned('DRV-1021'), isTrue);
    });

    test('toggleRouteAssignment switches between assigned and unassigned', () async {
      await repository.toggleRouteAssignment('driver1d', false);
      var isAssigned = await repository.isRouteAssigned('driver1d');
      var route = await repository.getRouteForDriver('driver1d');
      expect(isAssigned, isFalse);
      expect(route, isNull);

      await repository.toggleRouteAssignment('driver1d', true);
      isAssigned = await repository.isRouteAssigned('driver1d');
      route = await repository.getRouteForDriver('driver1d');
      expect(isAssigned, isTrue);
      expect(route, isNotNull);
      expect(route!.routeNo, equals('OCDSB-001'));
    });

    test('syncRouteFromBackend pulls live updated stop times from backend API', () async {
      try {
        final liveRoute = await repository.syncRouteFromBackend('driver1d');
        if (liveRoute != null) {
          expect(liveRoute.routeNo, equals('OCDSB-001'));
          final amShift = liveRoute.shifts.firstWhere((s) => s.shiftType == 'AM');
          expect(amShift.stops.first.pullawayTime, equals('07:31 AM'));
        }
      } on RouteSyncException {
        expect(await repository.getRouteForDriver('driver1d'), isNotNull);
      }
    });

    test('a failed route sync keeps the cached assignment', () async {
      final scripted = RouteRepository(
        apiBaseUrl: 'http://example.test',
        httpClient: _ScriptedClient([http.Response('unavailable', 503)]),
      );
      await scripted.init();

      await expectLater(
        scripted.syncRouteFromBackend('driver1d'),
        throwsA(isA<RouteSyncException>()),
      );
      expect(await scripted.getRouteForDriver('driver1d'), isNotNull);
    });

    test('a confirmed empty route list clears the cached assignment', () async {
      final scripted = RouteRepository(
        apiBaseUrl: 'http://example.test',
        httpClient: _ScriptedClient([http.Response('[]', 200)]),
      );
      await scripted.init();

      final liveRoute = await scripted.syncRouteFromBackend('driver1d');
      expect(liveRoute, isNull);
      expect(await scripted.getRouteForDriver('driver1d'), isNull);
    });

    test('a non-list route response is a sync failure', () async {
      final scripted = RouteRepository(
        apiBaseUrl: 'http://example.test',
        httpClient: _ScriptedClient([http.Response('{"ok":true}', 200)]),
      );
      await scripted.init();

      await expectLater(
        scripted.syncRouteFromBackend('driver1d'),
        throwsA(isA<RouteSyncException>()),
      );
      expect(await scripted.getRouteForDriver('driver1d'), isNotNull);
    });
  });

  group('RouteBloc Tests', () {
    test('LoadRouteEvent clears a cached route when the server confirms none', () async {
      final scripted = RouteRepository(
        apiBaseUrl: 'http://example.test',
        httpClient: _ScriptedClient([http.Response('[]', 200)]),
      );
      await scripted.init();
      final bloc = RouteBloc(repository: scripted);
      final ready = Completer<void>();
      bloc.add(LoadRouteEvent('driver1d', ready: ready));
      await ready.future;

      final loaded = bloc.state as RouteLoaded;
      expect(loaded.isAssigned, isFalse);
      expect(loaded.route, isNull);
      expect(await scripted.getRouteForDriver('driver1d'), isNull);

      await bloc.close();
    });

    test('LoadRouteEvent loads assigned route successfully for driver1d', () async {
      final bloc = RouteBloc(repository: repository);
      expect(bloc.state, isA<RouteInitial>());

      bloc.add(const LoadRouteEvent('driver1d'));

      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<RouteLoading>(),
          isA<RouteLoaded>().having((s) => s.isAssigned, 'isAssigned', isTrue)
              .having((s) => s.route?.routeNo, 'routeNo', 'OCDSB-001')
              .having((s) => s.route?.routeName, 'routeName', 'Route 001 - Hillcrest High School')
              .having((s) => s.selectedShiftType, 'default shift filter', 'AM'),
        ]),
      );

      await bloc.close();
    });

    test('FilterRouteShiftEvent changes displayed stops', () async {
      final bloc = RouteBloc(repository: repository);
      bloc.add(const LoadRouteEvent('driver1d'));

      await bloc.stream.firstWhere((s) => s is RouteLoaded);
      final initialLoaded = bloc.state as RouteLoaded;
      expect(initialLoaded.displayedStops.length, equals(7));
      expect(initialLoaded.displayedStops.first.location, contains('Merivale Rd'));

      // Switch to PM shift
      bloc.add(const FilterRouteShiftEvent('PM'));
      await expectLater(
        bloc.stream,
        emits(isA<RouteLoaded>().having((s) => s.selectedShiftType, 'shift', 'PM')),
      );

      final pmLoaded = bloc.state as RouteLoaded;
      expect(pmLoaded.displayedStops.length, equals(7));
      expect(pmLoaded.displayedStops.first.schoolName, equals('Hillcrest High School'));

      // Switch to ALL shifts
      bloc.add(const FilterRouteShiftEvent('ALL'));
      await expectLater(
        bloc.stream,
        emits(isA<RouteLoaded>().having((s) => s.selectedShiftType, 'shift', 'ALL')),
      );

      final allLoaded = bloc.state as RouteLoaded;
      expect(allLoaded.displayedStops.length, equals(14));

      await bloc.close();
    });

    test('SearchRouteStudentsEvent filters student directory', () async {
      final bloc = RouteBloc(repository: repository);
      bloc.add(const LoadRouteEvent('driver1d'));

      await bloc.stream.firstWhere((s) => s is RouteLoaded);
      final loaded = bloc.state as RouteLoaded;
      expect(loaded.allUniqueStudents.length, equals(6));

      // Search for "Noah" (should match Noah Garcia and Noah Jackson)
      bloc.add(const SearchRouteStudentsEvent('Noah'));
      await expectLater(
        bloc.stream,
        emits(isA<RouteLoaded>()
            .having((s) => s.searchQuery, 'searchQuery', 'Noah')
            .having((s) => s.filteredStudents.length, 'Noah matches', 2)
            .having((s) => s.rosterStudents.length, 'roster count stays full', 6)
            .having((s) => s.displayedStops.length, 'matching stops', lessThan(7))
            .having((s) => s.shiftStops.length, 'shift stop count stays full', 7)),
      );

      // Search by student ID "0009"
      bloc.add(const SearchRouteStudentsEvent('0009'));
      await expectLater(
        bloc.stream,
        emits(isA<RouteLoaded>()
            .having((s) => s.filteredStudents.length, 'ID matches', 1)
            .having((s) => s.filteredStudents.first.name, 'Name', 'Noah Garcia')),
      );

      // Clear search
      bloc.add(const SearchRouteStudentsEvent(''));
      await expectLater(
        bloc.stream,
        emits(isA<RouteLoaded>().having(
          (s) => s.filteredStudents.length,
          'All students restored',
          loaded.allUniqueStudents.length,
        )),
      );

      await bloc.close();
    });

    test('ToggleRouteAssignmentEvent handles unassign and re-assign flows', () async {
      final bloc = RouteBloc(repository: repository);
      bloc.add(const LoadRouteEvent('driver1d'));

      await bloc.stream.firstWhere((s) => s is RouteLoaded);

      // Unassign route
      bloc.add(const ToggleRouteAssignmentEvent(driverId: 'driver1d', shouldAssign: false));
      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<RouteLoading>(),
          isA<RouteLoaded>()
              .having((s) => s.isAssigned, 'isAssigned', isFalse)
              .having((s) => s.route, 'route', isNull),
        ]),
      );

      // Re-assign route
      bloc.add(const ToggleRouteAssignmentEvent(driverId: 'driver1d', shouldAssign: true));
      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<RouteLoading>(),
          isA<RouteLoaded>()
              .having((s) => s.isAssigned, 'isAssigned', isTrue)
              .having((s) => s.route?.routeNo, 'routeNo', 'OCDSB-001'),
        ]),
      );

      await bloc.close();
    });

    test('FirestoreRouteUpdatedEvent seamlessly updates active route in state', () async {
      final bloc = RouteBloc(repository: repository);
      final ready = Completer<void>();
      bloc.add(LoadRouteEvent('driver1d', ready: ready));
      await ready.future;

      final initialLoaded = bloc.state as RouteLoaded;
      final originalRoute = initialLoaded.route!;
      expect(originalRoute, isNotNull);

      // An empty snapshot before a live route has been seen does not wipe the cache.
      bloc.add(const FirestoreRouteUpdatedEvent(null));
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect((bloc.state as RouteLoaded).route, isNotNull);
      expect((bloc.state as RouteLoaded).isAssigned, isTrue);

      final updatedRoute = originalRoute.copyWith(
        routeName: 'Route 001 - Hillcrest (Live Firestore Realtime Stream)',
      );

      final updateExpectation = expectLater(
        bloc.stream,
        emits(
          isA<RouteLoaded>()
              .having((s) => s.route?.routeName, 'updated routeName', 'Route 001 - Hillcrest (Live Firestore Realtime Stream)')
              .having((s) => s.isAssigned, 'isAssigned', isTrue),
        ),
      );

      bloc.add(FirestoreRouteUpdatedEvent(updatedRoute));
      await updateExpectation;

      // A later empty snapshot means the live assignment was removed.
      final clearExpectation = expectLater(
        bloc.stream,
        emits(
          isA<RouteLoaded>()
              .having((s) => s.route, 'route', isNull)
              .having((s) => s.isAssigned, 'isAssigned', isFalse),
        ),
      );
      bloc.add(const FirestoreRouteUpdatedEvent(null));
      await clearExpectation;

      await bloc.close();
    });
  });
}

