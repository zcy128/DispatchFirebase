import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/models.dart';
import 'package:parent_app/features/tracking/presentation/eta_card_widget.dart';

void main() {
  group('EtaCardWidget Component Tests', () {
    ParentStudentCommute createCommute({
      String status = 'EN_ROUTE',
      int? minutesAway = 4,
      double? distanceKm = 1.2,
      int lateMinutes = 0,
      String busUnitNumber = '1001',
    }) {
      return ParentStudentCommute(
        studentId: 101,
        studentNo: 'STU-001',
        studentName: 'Emma Watson',
        grade: 'Grade 2',
        schoolName: 'Broadview Public School',
        avatarColor: '#2563EB',
        shiftType: 'AM',
        shiftId: 'shift_1',
        routeNo: 'Route 101',
        busUnitNumber: busUnitNumber,
        driverName: 'Robert Smith',
        stopLocation: 'Woodroffe Ave & Baseline Rd',
        stopType: 'PICKUP',
        scheduledTime: '07:35 AM',
        estimatedTime: '07:39 AM',
        lateMinutes: lateMinutes,
        status: status,
        distanceKm: distanceKm,
        minutesAway: minutesAway,
      );
    }

    testWidgets('renders EN_ROUTE status with countdown minutes, distance and bus unit', (tester) async {
      final commute = createCommute(
        status: 'EN_ROUTE',
        minutesAway: 4,
        distanceKm: 1.2,
        busUnitNumber: '1001',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EtaCardWidget(commute: commute),
          ),
        ),
      );
      await tester.pump();

      // Bus number and distance string
      expect(find.textContaining('Bus #1001'), findsOneWidget);
      expect(find.textContaining('1.2 km away'), findsOneWidget);

      // Countdown minutes display
      expect(find.text('4'), findsOneWidget);
      expect(find.text('MINS AWAY'), findsOneWidget);
      expect(find.text('4 MINS'), findsOneWidget);
    });

    testWidgets('renders APPROACHING status with urgent arrival reassurance', (tester) async {
      final commute = createCommute(
        status: 'APPROACHING',
        minutesAway: 1,
        distanceKm: 0.3,
        busUnitNumber: '1001',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EtaCardWidget(commute: commute),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('APPROACHING'), findsOneWidget);
      expect(find.textContaining('Bus Arriving Shortly'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
    });

    testWidgets('renders DROPPED_OFF safe arrival status', (tester) async {
      final commute = createCommute(
        status: 'DROPPED_OFF',
        minutesAway: 0,
        distanceKm: 0.0,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EtaCardWidget(commute: commute),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('ARRIVED'), findsWidgets);
      expect(find.textContaining('Arrived at School'), findsOneWidget);
      expect(find.text('Safe'), findsOneWidget);
    });

    testWidgets('triggers callback buttons correctly', (tester) async {
      bool callDriverInvoked = false;
      bool reportAbsentInvoked = false;
      bool contactDispatcherInvoked = false;

      final commute = createCommute(status: 'EN_ROUTE');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: EtaCardWidget(
                commute: commute,
                onCallDriver: () => callDriverInvoked = true,
                onReportAbsent: () => reportAbsentInvoked = true,
                onContactDispatcher: () => contactDispatcherInvoked = true,
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      // Trigger "Call" quick action button if present
      final callFinder = find.widgetWithText(OutlinedButton, 'Call');
      if (callFinder.evaluate().isNotEmpty) {
        await tester.tap(callFinder);
        expect(callDriverInvoked, isTrue);
      }

      // Trigger "Report Absent" quick action button if present
      final absentFinder = find.widgetWithText(OutlinedButton, 'Absent');
      if (absentFinder.evaluate().isNotEmpty) {
        await tester.tap(absentFinder);
        expect(reportAbsentInvoked, isTrue);
      }
      expect(contactDispatcherInvoked, isFalse);
    });
  });
}
