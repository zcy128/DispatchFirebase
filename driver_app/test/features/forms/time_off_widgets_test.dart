import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/forms/models/time_off_model.dart';
import 'package:driver_app/features/forms/presentation/widgets/time_off_header_card.dart';
import 'package:driver_app/features/forms/presentation/widgets/time_off_kpi_grid.dart';
import 'package:driver_app/features/forms/presentation/widgets/time_off_filter_chips.dart';
import 'package:driver_app/features/forms/presentation/widgets/time_off_request_card.dart';

void main() {
  group('Time Off Widget Tests', () {
    testWidgets('TimeOffHeaderCard renders title and LIVE badge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TimeOffHeaderCard(),
          ),
        ),
      );

      expect(find.text('Time-Off & Leave Forms'), findsOneWidget);
      expect(find.text('LIVE'), findsOneWidget);
    });

    testWidgets('TimeOffKpiGrid renders all 4 metric tiles correctly', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TimeOffKpiGrid(
              totalCount: 12,
              pendingCount: 3,
              approvedCount: 8,
              rejectedCount: 1,
            ),
          ),
        ),
      );

      expect(find.text('12'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('8'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);

      expect(find.text('Total'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('Approved'), findsOneWidget);
      expect(find.text('Rejected'), findsOneWidget);
    });

    testWidgets('TimeOffFilterChips calls onFilterSelected when chip is tapped', (tester) async {
      TimeOffStatus? selected;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TimeOffFilterChips(
              currentFilter: null,
              totalCount: 5,
              pendingCount: 2,
              approvedCount: 2,
              rejectedCount: 1,
              onFilterSelected: (status) => selected = status,
            ),
          ),
        ),
      );

      expect(find.text('All (5)'), findsOneWidget);
      expect(find.text('Pending (2)'), findsOneWidget);

      await tester.tap(find.text('Pending (2)'));
      await tester.pumpAndSettle();

      expect(selected, equals(TimeOffStatus.pending));
    });

    testWidgets('TimeOffRequestCard renders leave details and status without overflow', (tester) async {
      const model = TimeOffRequestModel(
        id: 'TOR-999',
        employeeId: 'EMP-001',
        employeeName: 'Driver 1',
        leaveType: TimeOffLeaveType.vacation,
        shiftType: TimeOffShiftType.all,
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        status: TimeOffStatus.pending,
        comments: 'Annual family holiday',
        createdAt: '2026-11-06T08:00:00Z',
        updatedAt: '2026-11-06T08:00:00Z',
      );

      bool cancelTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TimeOffRequestCard(
              item: model,
              onCancel: () => cancelTapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Vacation'), findsOneWidget);
      expect(find.text('All Shifts (Full Day)'), findsOneWidget);
      expect(find.text('2026-11-10  →  2026-11-12'), findsOneWidget);
      expect(find.text('Annual family holiday'), findsOneWidget);

      // Verify cancel action if available
      if (model.canCancelByDriver) {
        final cancelBtn = find.text('Cancel Request');
        expect(cancelBtn, findsOneWidget);
        await tester.tap(cancelBtn);
        expect(cancelTapped, isTrue);
      }
    });
  });
}
