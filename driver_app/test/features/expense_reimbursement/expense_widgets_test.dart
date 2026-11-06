import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/expense_reimbursement/models/expense_reimbursement_model.dart';
import 'package:driver_app/features/expense_reimbursement/presentation/widgets/expense_claim_card.dart';
import 'package:driver_app/features/expense_reimbursement/presentation/widgets/expense_empty_state.dart';
import 'package:driver_app/features/expense_reimbursement/presentation/widgets/expense_filter_chips.dart';
import 'package:driver_app/features/expense_reimbursement/presentation/widgets/expense_kpi_header.dart';

void main() {
  group('Expense Reimbursement Component Tests', () {
    testWidgets('ExpenseKpiHeader renders metric tiles accurately', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ExpenseKpiHeader(
              pendingCount: 2,
              approvedCount: 5,
              approvedTotal: 450.75,
            ),
          ),
        ),
      );

      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);

      expect(find.text('Approved'), findsOneWidget);
      expect(find.text('5'), findsOneWidget);

      expect(find.text('Reimbursed'), findsOneWidget);
      expect(find.text('\$451'), findsOneWidget);
    });

    testWidgets('ExpenseFilterChips fires onFilterSelected when chip is tapped', (tester) async {
      String selected = 'all';

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ExpenseFilterChips(
              selectedFilter: 'all',
              onFilterSelected: (val) => selected = val,
            ),
          ),
        ),
      );

      expect(find.text('All'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('Approved'), findsOneWidget);

      await tester.tap(find.text('Approved'));
      await tester.pumpAndSettle();

      expect(selected, equals('approved'));
    });

    testWidgets('ExpenseEmptyState displays contextual message based on filter', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ExpenseEmptyState(selectedFilter: 'pending'),
          ),
        ),
      );

      expect(find.text('No pending expense claims'), findsOneWidget);
    });

    testWidgets('ExpenseClaimCard renders claim details safely without overflow', (tester) async {
      final claim = ExpenseReimbursementClaim(
        id: 'claim-101',
        employeeId: 'EMP-001',
        employeeName: 'Driver 1',
        claimDate: '2026-11-05',
        routeNo: '14B',
        totalAmount: 85.50,
        lines: const [
          ExpenseReimbursementLine(
            id: 'line-1',
            categoryCode: 'fuel',
            categoryDisplayName: 'Fuel / Gas',
            amount: 85.50,
          ),
        ],
        attachmentUrls: const [],
        status: ExpenseClaimStatus.pending,
        createdAt: DateTime.parse('2026-11-05T14:30:00Z'),
        updatedAt: DateTime.parse('2026-11-05T14:30:00Z'),
      );

      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ExpenseClaimCard(
              claim: claim,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('2026-11-05'), findsOneWidget);
      expect(find.text('Route 14B'), findsOneWidget);
      expect(find.text('1 item: Fuel / Gas'), findsOneWidget);
      expect(find.text('\$85.50'), findsOneWidget);

      await tester.tap(find.byType(ExpenseClaimCard));
      await tester.pumpAndSettle();

      expect(tapped, isTrue);
    });
  });
}
