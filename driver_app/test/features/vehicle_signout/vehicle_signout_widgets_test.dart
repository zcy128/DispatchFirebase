import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/vehicle_signout/models/vehicle_signout_model.dart';
import 'package:driver_app/features/vehicle_signout/presentation/widgets/vehicle_signout_empty_state.dart';
import 'package:driver_app/features/vehicle_signout/presentation/widgets/vehicle_signout_filter_pills.dart';
import 'package:driver_app/features/vehicle_signout/presentation/widgets/vehicle_signout_record_card.dart';
import 'package:driver_app/features/vehicle_signout/presentation/vehicle_signout_detail_page.dart';

void main() {
  group('Vehicle Signout Component Tests', () {
    testWidgets('VehicleSignoutFilterPills renders filters and notifies selection', (tester) async {
      String selected = 'All';

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return VehicleSignoutFilterPills(
                  selectedFilter: selected,
                  onFilterSelected: (newVal) {
                    setState(() => selected = newVal);
                  },
                );
              },
            ),
          ),
        ),
      );

      expect(find.text('All'), findsOneWidget);
      expect(find.text('Signed Out'), findsOneWidget);
      expect(find.text('Signed In'), findsOneWidget);

      await tester.tap(find.text('Signed Out'));
      await tester.pumpAndSettle();

      expect(selected, 'Signed Out');
    });

    testWidgets('VehicleSignoutEmptyState renders properly without active filter', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: VehicleSignoutEmptyState(hasFilter: false),
          ),
        ),
      );

      expect(find.text('No handover records found'), findsOneWidget);
      expect(find.text('Completed vehicle handovers will appear here.'), findsOneWidget);
    });

    testWidgets('VehicleSignoutEmptyState renders properly with active filter', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: VehicleSignoutEmptyState(hasFilter: true),
          ),
        ),
      );

      expect(find.text('No matching handover records'), findsOneWidget);
      expect(find.text('Try adjusting your search keywords or filter pills.'), findsOneWidget);
    });

    testWidgets('VehicleSignoutRecordCard renders details safely without overflow', (tester) async {
      final item = VehicleSignoutModel(
        id: 'vs-101',
        isSignIn: false,
        signDate: '2026-11-06',
        employeeId: 'EMP-001',
        employeeName: 'Sarah Jenkins',
        unitNumber: 'Bus 104 - Regular Wheelchair Bus',
        routeId: 'Route #42B - Eastside Route',
        odometer: 45210.5,
        fuelLevelDescription: 'Full (1/1)',
        attachments: [
          VehicleSignoutAttachment(
            url: 'https://example.com/photo1.jpg',
            fileName: 'photo1.jpg',
            uploadedTime: '2026-11-06T09:00:00Z',
          ),
        ],
        createdAt: '2026-11-06T09:00:00Z',
        updatedAt: '2026-11-06T09:00:00Z',
      );

      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VehicleSignoutRecordCard(
              item: item,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('SIGN OUT'), findsOneWidget);
      expect(find.text('Unit #Bus 104 - Regular Wheelchair Bus'), findsOneWidget);
      expect(find.text('Sarah Jenkins'), findsOneWidget);
      expect(find.text('Route #42B - Eastside Route'), findsOneWidget);
      expect(find.text('45210.5 km · Full (1/1)'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);

      await tester.tap(find.byType(VehicleSignoutRecordCard));
      expect(tapped, isTrue);
    });

    testWidgets('VehicleSignoutDetailPage renders all sections safely', (tester) async {
      final item = VehicleSignoutModel(
        id: 'vs-102',
        isSignIn: true,
        signDate: '2026-11-06',
        employeeId: 'EMP-002',
        employeeName: 'Marcus Aurelius Driver',
        unitNumber: '105',
        licensePlate: 'ABC-1234',
        unitMaker: 'Blue Bird',
        unitModel: 'Vision Conventional Diesel',
        routeId: 'Route 88',
        driverLicenseClass: 'Class 2-S',
        driverLicenseCondition: 'Air Brakes (Q)',
        odometer: 89345.2,
        fuelLevelDescription: '3/4',
        fuelTypeDescription: 'Diesel',
        conditionComments: 'Pre-existing minor bumper scratch on rear driver side.',
        parkingAddress: 'Calgary South Fleet Yard, Stall #42',
        fireHallLocation: 'Calgary Fire Station #16',
        driverSignature: 'Marcus A.',
        driverSignDate: '2026-11-06 17:30',
        fleetDepartmentSignature: 'Supervisor Dave',
        fleetDepartmentSignDate: '2026-11-06 17:35',
        docRegistrationSignIn: true,
        docInsuranceSignIn: true,
        docSafetyFitnessSignIn: true,
        docCollisionReportSignIn: true,
        docScheduleMaintenanceSignIn: true,
        docSdsSignIn: true,
        checkFireExtinguisher: true,
        checkFirstAidKit: true,
        checkTriangles: true,
        checkQstraints: true,
        checkSeatBeltCutter: true,
        checkBroom: true,
        checkSnowbrush: true,
        checkCleankit: true,
        createdAt: '2026-11-06T17:30:00Z',
        updatedAt: '2026-11-06T17:35:00Z',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: VehicleSignoutDetailPage(record: item),
        ),
      );

      expect(find.text('Unit #105 Handover'), findsOneWidget);
      expect(find.text('SIGN IN / RETURN'), findsOneWidget);
      expect(find.text('Marcus Aurelius Driver'), findsOneWidget);
      expect(find.text('Blue Bird Vision Conventional Diesel'), findsOneWidget);
      expect(find.text('Verified Documents'), findsOneWidget);
      expect(find.text('Safety Equipment Checklist'), findsOneWidget);
      expect(find.text('Condition & Parking Notes'), findsOneWidget);
      expect(find.text('Digital Sign-Off'), findsOneWidget);
      expect(find.text('Supervisor Dave'), findsOneWidget);
    });
  });
}
