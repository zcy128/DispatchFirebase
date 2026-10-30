import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/models.dart';
import 'package:parent_app/features/tracking/presentation/bus_map_widget.dart';
import 'package:parent_app/features/tracking/presentation/map_snapping_engine.dart';

void main() {
  testWidgets('BusMapWidget decodes polyline and renders RoadPolylineLayer', (tester) async {
    const mockPolyline = 'm{jtG~tdeL?@a@n@e@x@o@x@Wl@i@`AW`@_@j@W`@e@bAOj@_@v@[v@m@xAU`@e@bAOj@_@v@[v@m@xAU`@e@bAOj@_@v@[v@m@xAU`@e@bAOj@_@v@[v@m@xAU`@';

    final points = MapSnappingEngine.decodePolyline(mockPolyline);
    expect(points.length, greaterThan(2));

    final commute = ParentStudentCommute(
      studentId: 101,
      studentNo: 'STU-001',
      studentName: 'Emma Watson',
      grade: 'Grade 7',
      schoolName: 'Broadview Public School',
      avatarColor: '#2563EB',
      shiftType: 'MORNING_PICKUP',
      shiftId: 'shift_1',
      routeNo: 'Route 101 - Morning Commute',
      busUnitNumber: '1001',
      driverName: 'Robert Smith',
      stopLocation: '123 Richmond Rd, Ottawa',
      stopType: 'PICKUP',
      scheduledTime: '08:15 AM',
      estimatedTime: '08:18 AM',
      lateMinutes: 3,
      status: 'EN_ROUTE',
      stopLatitude: 45.3524,
      stopLongitude: -75.7558,
      schoolLatitude: 45.37896,
      schoolLongitude: -75.76102,
      routePolyline: mockPolyline,
      vehicleLocation: VehicleLiveLocation(
        unitNumber: '1001',
        routeNo: 'Route 101',
        shiftId: 'shift_1',
        latitude: 45.3512,
        longitude: -75.7601,
        heading: 90.0,
        speedKmh: 42.0,
        lastUpdated: DateTime.now(),
        currentStopSequence: 1,
        nextStopLocation: 'Richmond Rd',
        status: 'EN_ROUTE',
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            height: 600,
            child: BusMapWidget(commute: commute),
          ),
        ),
      ),
    );

    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    // Verify RoadPolylineLayer exists in the widget tree
    expect(find.byType(RoadPolylineLayer), findsOneWidget);

    // Route number chip was removed per user requirement (cleaner map, no route code)
    expect(find.textContaining('Route: Route 101'), findsNothing);
  });
}
