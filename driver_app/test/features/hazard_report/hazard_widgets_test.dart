import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/hazard_report/models/hazard_report_model.dart';
import 'package:driver_app/features/hazard_report/presentation/widgets/hazard_empty_state.dart';
import 'package:driver_app/features/hazard_report/presentation/widgets/hazard_filter_pills.dart';
import 'package:driver_app/features/hazard_report/presentation/widgets/hazard_report_card.dart';

void main() {
  group('Hazard Report Component Tests', () {
    testWidgets('HazardFilterPills renders choices and notifies selection', (tester) async {
      int selected = -1;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HazardFilterPills(
              selectedFilter: -1,
              onFilterSelected: (val) => selected = val,
            ),
          ),
        ),
      );

      expect(find.text('All'), findsOneWidget);
      expect(find.text('Open'), findsOneWidget);
      expect(find.text('Investigating'), findsOneWidget);
      expect(find.text('Resolved'), findsOneWidget);

      await tester.tap(find.text('Investigating'));
      await tester.pumpAndSettle();

      expect(selected, equals(1));
    });

    testWidgets('HazardEmptyState displays appropriate message for filter', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: HazardEmptyState(selectedFilter: 0),
          ),
        ),
      );

      expect(find.text('No hazard reports found'), findsOneWidget);
      expect(find.text('No reports matching the selected status.'), findsOneWidget);
    });

    testWidgets('HazardReportCard renders report details without overflow', (tester) async {
      final report = HazardReportModel(
        id: 'hz-998877',
        reportedBy: 'Driver 1',
        reportedByEmployeeId: 'EMP-001',
        routeName: '12A',
        unitNumber: '1021',
        eventTime: '2026-11-06T08:15:00',
        eventLocation: 'Intersection of Main St & Maple Ave',
        eventDescription: 'Large pothole and exposed metal cover near the student bus stop.',
        trafficHazard: true,
        trippingHazard: true,
        attachmentUrls: const ['https://storage.example.com/photo1.jpg'],
        statusInt: 0,
        createdAt: DateTime.parse('2026-11-06T08:15:00Z'),
        updatedAt: DateTime.parse('2026-11-06T08:15:00Z'),
      );

      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HazardReportCard(
              item: report,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('#998877'), findsOneWidget);
      expect(find.text('2026-11-06'), findsOneWidget);
      expect(find.text('Intersection of Main St & Maple Ave'), findsOneWidget);
      expect(find.text('Tripping'), findsOneWidget);
      expect(find.text('+1 more'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);

      await tester.tap(find.byType(HazardReportCard));
      await tester.pumpAndSettle();

      expect(tapped, isTrue);
    });
  });
}
