import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/route_assessment/models/route_assessment_model.dart';
import 'package:driver_app/features/route_assessment/presentation/widgets/route_assessment_card.dart';
import 'package:driver_app/features/route_assessment/presentation/widgets/route_assessment_empty_state.dart';
import 'package:driver_app/features/route_assessment/presentation/widgets/route_assessment_filter_pills.dart';

void main() {
  group('Route Assessment Component Tests', () {
    testWidgets('RouteAssessmentFilterPills renders choices and notifies selection', (tester) async {
      RouteAssessmentStatus? selected;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RouteAssessmentFilterPills(
              selectedStatus: null,
              onStatusSelected: (val) => selected = val,
            ),
          ),
        ),
      );

      expect(find.text('All'), findsOneWidget);
      expect(find.text('Working'), findsOneWidget);
      expect(find.text('Completed'), findsOneWidget);
      expect(find.text('Submitted'), findsOneWidget);

      await tester.tap(find.text('Completed'));
      await tester.pumpAndSettle();

      expect(selected, equals(RouteAssessmentStatus.completed));
    });

    testWidgets('RouteAssessmentEmptyState displays placeholder message', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: RouteAssessmentEmptyState(),
          ),
        ),
      );

      expect(find.text('No route assessments found'), findsOneWidget);
      expect(find.text('Tap "+ New Assessment" to conduct your route safety checklist.'), findsOneWidget);
    });

    testWidgets('RouteAssessmentCard renders assessment details safely without overflow', (tester) async {
      final assessment = RouteAssessmentModel(
        id: 'ra-501',
        conductedByDriver: 'Driver 1',
        conductedByEmployeeId: 'EMP-001',
        routeId: 'Route #42B - Eastside Express',
        school: 'St. Mary Catholic High School',
        schoolYear: '2026-2027',
        assessmentType: '0',
        statusInt: 3,
        summary: 'Road construction near north entrance causes visibility obstruction during drop-off.',
        visibilityProblemCheck: true,
        highwayStopConcernCheck: true,
        assessmentDate: DateTime.parse('2026-11-06T09:00:00Z'),
        createdAt: DateTime.parse('2026-11-06T09:00:00Z'),
        updatedAt: DateTime.parse('2026-11-06T09:00:00Z'),
        attachmentUrls: const ['https://storage.example.com/assessment.jpg'],
      );

      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RouteAssessmentCard(
              item: assessment,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Route #42B - Eastside Express'), findsOneWidget);
      expect(find.text('St. Mary Catholic High School • 2026-2027'), findsOneWidget);
      expect(find.text('Submitted'), findsOneWidget);
      expect(find.text('2026-11-06'), findsOneWidget);
      expect(find.text('2 Risks'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);

      await tester.tap(find.byType(RouteAssessmentCard));
      await tester.pumpAndSettle();

      expect(tapped, isTrue);
    });
  });
}
