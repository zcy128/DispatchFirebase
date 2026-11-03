import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/charter/models/charter_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('CharterStopModel Time & Formatting Tests', () {
    test('extractTimeOnly handles ISO 8601 strings and raw times', () {
      expect(CharterStopModel.extractTimeOnly('08:30'), equals('08:30'));
      expect(CharterStopModel.extractTimeOnly('2026-11-02T14:45:00'), equals('14:45'));
      expect(CharterStopModel.extractTimeOnly('2026-11-02 09:15:00'), equals('09:15'));
      expect(CharterStopModel.extractTimeOnly(''), equals(''));
      expect(CharterStopModel.extractTimeOnly(null), equals(''));
    });

    test('addMinutesToTime rolls forward correctly and handles midnight rollover', () {
      expect(CharterStopModel.addMinutesToTime('08:00', 30), equals('08:30'));
      expect(CharterStopModel.addMinutesToTime('08:45', 30), equals('09:15'));
      expect(CharterStopModel.addMinutesToTime('23:45', 30), equals('00:15'));
      expect(CharterStopModel.addMinutesToTime('00:10', 50), equals('01:00'));
    });

    test('stopTypeLabel maps integer types to proper descriptions', () {
      const stop0 = CharterStopModel(
        id: 's0',
        charterTripId: 'trip-1',
        sequenceOrder: 1,
        stopType: 0,
        locationName: 'Origin School',
        address: '123 School Rd',
      );
      expect(stop0.stopTypeLabel, equals('Pickup'));

      const stop1 = CharterStopModel(
        id: 's1',
        charterTripId: 'trip-1',
        sequenceOrder: 2,
        stopType: 1,
        locationName: 'Museum',
        address: '456 Museum Way',
      );
      expect(stop1.stopTypeLabel, equals('Dropoff'));

      const stop2 = CharterStopModel(
        id: 's2',
        charterTripId: 'trip-1',
        sequenceOrder: 3,
        stopType: 2,
        locationName: 'School Return',
        address: '123 School Rd',
      );
      expect(stop2.stopTypeLabel, equals('Return Dropoff'));

      const stop3 = CharterStopModel(
        id: 's3',
        charterTripId: 'trip-1',
        sequenceOrder: 4,
        stopType: 3,
        locationName: 'Museum Return Pickup',
        address: '456 Museum Way',
      );
      expect(stop3.stopTypeLabel, equals('Return Pickup'));

      const stopOther = CharterStopModel(
        id: 's99',
        charterTripId: 'trip-1',
        sequenceOrder: 5,
        stopType: 99,
        locationName: 'Pit Stop',
        address: 'Highway Rest',
      );
      expect(stopOther.stopTypeLabel, equals('Stop'));
    });

    test('normalizeRoundTripStops converts 3 stops into 4 for complete round-trip flow', () {
      final inputStops = [
        const CharterStopModel(
          id: 's-orig',
          charterTripId: 't-1',
          sequenceOrder: 1,
          stopType: 0,
          locationName: 'Lisgar CI',
          address: '29 Lisgar St',
          scheduledAt: '08:30',
        ),
        const CharterStopModel(
          id: 's-dest',
          charterTripId: 't-1',
          sequenceOrder: 2,
          stopType: 1,
          locationName: 'Science Museum',
          address: '1867 St Laurent Blvd',
          scheduledAt: '09:00',
        ),
        const CharterStopModel(
          id: 's-ret',
          charterTripId: 't-1',
          sequenceOrder: 3,
          stopType: 2,
          locationName: 'Lisgar CI Dropoff',
          address: '29 Lisgar St',
          scheduledAt: '14:30',
        ),
      ];

      final normalized = CharterStopModel.normalizeRoundTripStops(
        inputStops,
        tripId: 't-1',
        departsAt: '08:30',
        returnsAt: '14:30',
        roundTrip: true,
      );

      expect(normalized.length, equals(4));
      expect(normalized[0].stopType, equals(0)); // Pickup
      expect(normalized[1].stopType, equals(1)); // Dropoff
      expect(normalized[2].stopType, equals(3)); // Return Pickup
      expect(normalized[3].stopType, equals(2)); // Return Dropoff
    });

    test('CharterStopModel serialization round-trip', () {
      final stop = const CharterStopModel(
        id: 'stop-abc',
        charterTripId: 'trip-xyz',
        sequenceOrder: 2,
        stopType: 1,
        locationName: 'Science Museum',
        address: '1867 St Laurent Blvd',
        latitude: 45.403,
        longitude: -75.619,
        scheduledAt: '09:00',
        arrivedAt: '08:58',
        departedAt: '09:05',
        notes: 'Arrive early at bus bay',
      );

      final map = stop.toMap();
      final revived = CharterStopModel.fromMap(map);

      expect(revived.id, equals(stop.id));
      expect(revived.locationName, equals(stop.locationName));
      expect(revived.latitude, equals(stop.latitude));
      expect(revived.arrivedAt, equals(stop.arrivedAt));
      expect(revived.isArrived, isTrue);
      expect(revived.isDeparted, isTrue);
    });
  });

  group('CharterAssignmentModel Tests', () {
    test('matchesUser correctly identifies assignment by employeeId and username', () {
      const assignment = CharterAssignmentModel(
        id: 'asg-1',
        charterTripId: 'trip-1',
        vehicleId: 'v-101',
        vehicleUnitNumber: 'BUS-42',
        plateNumber: 'ABC 123',
        driverId: 'EMP-2001',
        driverName: 'driver1',
      );

      expect(assignment.matchesUser('EMP-2001', 'other'), isTrue);
      expect(assignment.matchesUser('EMP-9999', 'driver1'), isTrue);
      expect(assignment.matchesUser('OTHER', 'nobody'), isFalse);
    });
  });

  group('CharterTripModel Tests', () {
    test('extractAssignedEmployeeIds strips placeholder values', () {
      final assignments = [
        const CharterAssignmentModel(
          id: 'asg-1',
          charterTripId: 'trip-1',
          vehicleId: 'v-1',
          vehicleUnitNumber: 'BUS-1',
          plateNumber: 'P1',
          driverId: 'EMP-100',
          driverName: 'Alice Smith',
          attendantId: '0',
          attendantName: 'TBD',
        ),
        const CharterAssignmentModel(
          id: 'asg-2',
          charterTripId: 'trip-1',
          vehicleId: 'v-2',
          vehicleUnitNumber: 'BUS-2',
          plateNumber: 'P2',
          driverId: 'unassigned',
          driverName: 'Unassigned',
          attendantId: 'ATT-200',
          attendantName: 'Bob Lee',
        ),
      ];

      final ids = CharterTripModel.extractAssignedEmployeeIds(assignments);

      expect(ids, contains('EMP-100'));
      expect(ids, contains('Alice Smith'));
      expect(ids, contains('ATT-200'));
      expect(ids, contains('Bob Lee'));
      expect(ids, isNot(contains('0')));
      expect(ids, isNot(contains('TBD')));
      expect(ids, isNot(contains('unassigned')));
    });

    test('tripTypeLabel and statusLabel provide accurate human readable strings', () {
      const trip = CharterTripModel(
        id: 't-1',
        tripNumber: 'TRIP-1001',
        charterClientId: 'c-1',
        clientName: 'Glebe CI',
        title: 'Ski Club',
        tripType: 1, // Athletic
        status: 3, // In Progress
        dispatchDate: '2026-11-02',
        departsAt: '07:30',
        returnsAt: '16:00',
      );

      expect(trip.tripTypeLabel, equals('Athletic'));
      expect(trip.statusLabel, equals('In Progress'));
    });

    test('CharterTripModel fromMap and toMap serialize effectively', () {
      final jsonMap = {
        'id': 'trip-555',
        'tripNumber': 'TRIP-555',
        'charterClientId': 'c-55',
        'clientName': 'Nepean HS',
        'title': 'Band Camp',
        'tripType': 0,
        'status': 2,
        'dispatchDate': '2026-11-03',
        'departsAt': '08:00',
        'returnsAt': '17:00',
        'passengerCount': 45,
        'vehiclesNeeded': 1,
        'needsAttendant': false,
        'billableHours': 8.5,
        'driverPayRate': 210.0,
        'attendantPayRate': 0.0,
        'roundTrip': true,
        'stops': [
          {
            'id': 's-1',
            'sequenceOrder': 1,
            'stopType': 0,
            'locationName': 'Nepean HS',
            'address': '574 West Hunt Club',
          },
          {
            'id': 's-2',
            'sequenceOrder': 2,
            'stopType': 1,
            'locationName': 'Camp Pontiac',
            'address': 'Camp Rd',
          },
          {
            'id': 's-3',
            'sequenceOrder': 3,
            'stopType': 2,
            'locationName': 'Nepean HS',
            'address': '574 West Hunt Club',
          },
        ],
        'assignments': [
          {
            'id': 'asg-55',
            'vehicleId': 'BUS-05',
            'vehicleUnitNumber': '05',
            'plateNumber': 'PLATE-05',
            'driverId': 'EMP-550',
            'driverName': 'Dave Miller',
          }
        ],
      };

      final trip = CharterTripModel.fromMap(jsonMap, 'trip-555');
      expect(trip.tripNumber, equals('TRIP-555'));
      expect(trip.clientName, equals('Nepean HS'));
      expect(trip.stops.length, equals(4)); // normalized round trip
      expect(trip.assignments.length, equals(1));
      expect(trip.assignments.first.driverName, equals('Dave Miller'));

      final assigned = trip.getAssignmentForUser('EMP-550', 'dave');
      expect(assigned, isNotNull);
      expect(assigned!.driverId, equals('EMP-550'));
    });
  });
}
