import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/route/models/route_model.dart';
import 'package:driver_app/features/route/bloc/route_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Route Models & Student Calculations', () {
    const student1 = DriverRouteStudent(
      studentId: 101,
      studentNo: 'STU-001',
      name: 'Emma Watson',
      grade: 'Grade 10',
      schoolName: 'Hillcrest High School',
      address: '123 Elm St',
      guardianName: 'Chris Watson',
      guardianPhone: '613-555-0101',
    );

    const student2 = DriverRouteStudent(
      studentId: 102,
      studentNo: 'STU-002',
      name: 'Daniel Radcliffe',
      grade: 'Grade 9',
      schoolName: 'Hillcrest High School',
      address: '456 Oak Ave',
    );

    const student3 = DriverRouteStudent(
      studentId: 103,
      studentNo: 'STU-003',
      name: 'Rupert Grint',
      grade: 'Grade 11',
      schoolName: 'Hillcrest High School',
      address: '789 Maple Rd',
    );

    const stop1 = DriverRouteStop(
      stopId: 1,
      sequence: 1,
      location: '123 Elm St & Pine',
      pullawayTime: '07:30 AM',
      stopType: 'HomePickup',
      isSchoolStop: false,
      students: [student1, student2],
    );

    const stop2 = DriverRouteStop(
      stopId: 2,
      sequence: 2,
      location: '789 Maple Rd',
      pullawayTime: '07:45 AM',
      stopType: 'HomePickup',
      isSchoolStop: false,
      students: [student3],
    );

    const stopSchool = DriverRouteStop(
      stopId: 3,
      sequence: 3,
      location: 'Hillcrest High School',
      pullawayTime: '08:05 AM',
      stopType: 'SchoolDropoff',
      isSchoolStop: true,
      schoolName: 'Hillcrest High School',
      students: [],
    );

    const amShift = DriverRouteShift(
      shiftId: 'SHIFT-AM',
      shiftType: 'AM',
      shiftName: 'Morning Run',
      runDays: 'MTWRF',
      firstStopTime: '07:30 AM',
      lastStopTime: '08:05 AM',
      schoolsServiced: 'Hillcrest High School',
      stops: [stop1, stop2, stopSchool],
    );

    // PM shift carries student1 and student2 back home
    const pmShift = DriverRouteShift(
      shiftId: 'SHIFT-PM',
      shiftType: 'PM',
      shiftName: 'Afternoon Run',
      runDays: 'MTWRF',
      firstStopTime: '02:45 PM',
      lastStopTime: '03:30 PM',
      schoolsServiced: 'Hillcrest High School',
      stops: [
        DriverRouteStop(
          stopId: 4,
          sequence: 1,
          location: 'Hillcrest High School',
          pullawayTime: '02:45 PM',
          stopType: 'SchoolPickup',
          isSchoolStop: true,
          students: [student1, student2],
        ),
        DriverRouteStop(
          stopId: 5,
          sequence: 2,
          location: '123 Elm St & Pine',
          pullawayTime: '03:15 PM',
          stopType: 'HomeDropoff',
          isSchoolStop: false,
          students: [],
        ),
      ],
    );

    const routeInfo = DriverRouteInfo(
      id: 'RT-100',
      routeNo: 'OCDSB-100',
      routeName: 'Hillcrest Morning & Afternoon',
      schoolBoard: 'OCDSB',
      yardName: 'East Yard',
      driverId: 'EMP-2001',
      driverName: 'John Driver',
      vehicleUnit: 'BUS-12',
      plateNumber: 'PLATE-123',
      shifts: [amShift, pmShift],
    );

    test('DriverRouteShift.studentCount deduplicates students across stops in same shift', () {
      expect(amShift.studentCount, equals(3));
      expect(amShift.stopCount, equals(3));
    });

    test('DriverRouteInfo.totalStops sums stops across all shifts', () {
      expect(routeInfo.totalStops, equals(5)); // 3 AM stops + 2 PM stops
    });

    test('DriverRouteInfo.totalUniqueStudents deduplicates across AM and PM shifts', () {
      // student1 and student2 appear in both AM and PM, student3 only in AM.
      // Total unique students must be 3, not 5.
      expect(routeInfo.totalUniqueStudents, equals(3));
    });

    test('DriverRouteInfo fromMap and toMap preserve all shift and student details', () {
      final map = routeInfo.toMap();
      final revived = DriverRouteInfo.fromMap(map);

      expect(revived.id, equals(routeInfo.id));
      expect(revived.routeNo, equals(routeInfo.routeNo));
      expect(revived.shifts.length, equals(2));
      expect(revived.shifts.first.stops.first.students.first.name, equals('Emma Watson'));
    });

    test('RouteLoaded state filters stops according to selectedShiftType', () {
      const stateAm = RouteLoaded(
        route: routeInfo,
        isAssigned: true,
        selectedShiftType: 'AM',
      );
      expect(stateAm.displayedStops.length, equals(3));

      const statePm = RouteLoaded(
        route: routeInfo,
        isAssigned: true,
        selectedShiftType: 'PM',
      );
      expect(statePm.displayedStops.length, equals(2));

      const stateAll = RouteLoaded(
        route: routeInfo,
        isAssigned: true,
        selectedShiftType: 'ALL',
      );
      expect(stateAll.displayedStops.length, equals(5));
    });

    test('RouteLoaded student search query matches name, studentNo, school, and address', () {
      const baseState = RouteLoaded(
        route: routeInfo,
        isAssigned: true,
        selectedShiftType: 'AM',
      );

      // 1. Search by name
      final nameSearchResult = baseState.copyWith(searchQuery: 'watson').filteredStudents;
      expect(nameSearchResult.length, equals(1));
      expect(nameSearchResult.first.name, equals('Emma Watson'));

      // 2. Search by studentNo
      final noSearchResult = baseState.copyWith(searchQuery: 'STU-002').filteredStudents;
      expect(noSearchResult.length, equals(1));
      expect(noSearchResult.first.name, equals('Daniel Radcliffe'));

      // 3. Search by street address
      final addressSearchResult = baseState.copyWith(searchQuery: 'Maple Rd').filteredStudents;
      expect(addressSearchResult.length, equals(1));
      expect(addressSearchResult.first.name, equals('Rupert Grint'));

      // 4. Case-insensitive and trimmed search
      final caseSearchResult = baseState.copyWith(searchQuery: '  EMMA  ').filteredStudents;
      expect(caseSearchResult.length, equals(1));
      expect(caseSearchResult.first.name, equals('Emma Watson'));

      // 5. Non-matching query returns empty
      final emptySearchResult = baseState.copyWith(searchQuery: 'NonExistent').filteredStudents;
      expect(emptySearchResult, isEmpty);
    });
  });
}
