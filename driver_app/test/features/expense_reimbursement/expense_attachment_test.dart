import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/expense_reimbursement/models/expense_reimbursement_model.dart';

void main() {
  group('ExpenseReimbursementClaim Attachments Tests', () {
    test('serializes and deserializes attachmentUrls properly', () {
      final now = DateTime.now().toUtc();
      final claim = ExpenseReimbursementClaim(
        id: 'claim-att-1',
        employeeId: 'emp-101',
        employeeName: 'John Doe',
        claimDate: '2026-10-02',
        routeNo: '1021',
        totalAmount: 45.50,
        lines: const [
          ExpenseReimbursementLine(
            id: 'line-1',
            categoryCode: 'fuel',
            categoryDisplayName: 'Fuel / Gas',
            amount: 45.50,
            note: 'Shell Gas Station',
          ),
        ],
        attachmentUrls: const [
          'https://firebasestorage.googleapis.com/v0/b/bucket/o/receipt_1.jpg',
          'https://firebasestorage.googleapis.com/v0/b/bucket/o/receipt_2.jpg',
        ],
        status: ExpenseClaimStatus.pending,
        createdAt: now,
        updatedAt: now,
      );

      final json = claim.toJson();
      expect(json['attachmentUrls'], isA<List>());
      expect(json['attachmentUrls'].length, 2);
      expect(json['attachmentUrls'][0], contains('receipt_1.jpg'));

      final reconstructed = ExpenseReimbursementClaim.fromJson(json);
      expect(reconstructed.attachmentUrls.length, 2);
      expect(reconstructed.attachmentUrls[0], contains('receipt_1.jpg'));
      expect(reconstructed.attachmentUrls[1], contains('receipt_2.jpg'));
    });

    test('copyWith updates attachmentUrls properly', () {
      final now = DateTime.now().toUtc();
      final claim = ExpenseReimbursementClaim(
        id: 'claim-att-2',
        employeeId: 'emp-102',
        employeeName: 'Jane Smith',
        claimDate: '2026-10-02',
        routeNo: '2042',
        totalAmount: 18.00,
        lines: const [],
        attachmentUrls: const [],
        status: ExpenseClaimStatus.pending,
        createdAt: now,
        updatedAt: now,
      );

      expect(claim.attachmentUrls, isEmpty);

      final updated = claim.copyWith(
        attachmentUrls: ['https://firebasestorage.googleapis.com/v0/b/bucket/o/new_receipt.jpg'],
      );

      expect(updated.attachmentUrls.length, 1);
      expect(updated.attachmentUrls.first, contains('new_receipt.jpg'));
      expect(claim.attachmentUrls, isEmpty);
    });
  });
}
