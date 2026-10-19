import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/expense_reimbursement/presentation/expense_reimbursement_form_page.dart';
import 'package:driver_app/features/expense_reimbursement/repository/expense_reimbursement_repository.dart';
import 'package:driver_app/core/widgets/attachment_picker_widget.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

void main() {
  testWidgets('ExpenseReimbursementFormPage builds without Firebase [core/no-app] exception', (tester) async {
    tester.view.physicalSize = const Size(360, 1200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    final repository = ExpenseReimbursementRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: RepositoryProvider<ExpenseReimbursementRepository>.value(
          value: repository,
          child: const ExpenseReimbursementFormPage(
            driverId: 'TEST-DRIVER',
            driverName: 'Test Driver',
            defaultRouteNo: '1021',
          ),
        ),
      ),
    );

    // Pump frames to let categories load or fallback
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    // Verify title and attachment picker rendered cleanly without overflow
    expect(find.text('Submit Expense Claim'), findsOneWidget);
    expect(find.text('Receipts & Attachments (0)'), findsOneWidget);
    expect(find.byType(AttachmentPickerWidget), findsOneWidget);
  });
}
