import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/expense_reimbursement/models/expense_reimbursement_model.dart';
import 'package:driver_app/features/expense_reimbursement/bloc/expense_reimbursement_bloc.dart';
import 'package:driver_app/features/expense_reimbursement/bloc/expense_reimbursement_event.dart';
import 'package:driver_app/features/expense_reimbursement/bloc/expense_reimbursement_state.dart';
import 'package:driver_app/features/expense_reimbursement/repository/expense_reimbursement_repository.dart';

class MockExpenseReimbursementRepository extends ExpenseReimbursementRepository {
  List<ExpenseReimbursementClaim> claims = [];
  bool shouldThrow = false;

  MockExpenseReimbursementRepository() : super();

  @override
  Future<List<ExpenseCategory>> getCategories() async {
    if (shouldThrow) throw Exception('Failed to load categories');
    return ExpenseCategory.defaultCategories();
  }

  @override
  Future<List<ExpenseReimbursementClaim>> getClaims({
    String? employeeId,
    String? status,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    return claims;
  }

  @override
  Future<ExpenseReimbursementClaim> submitClaim(ExpenseReimbursementClaim claim) async {
    if (shouldThrow) throw Exception('Submission failed');
    final created = claim.copyWith(
      id: 'mock-claim-1',
      status: ExpenseClaimStatus.pending,
    );
    claims.add(created);
    return created;
  }

  @override
  Future<ExpenseReimbursementClaim> cancelClaim({
    required String claimId,
    required String employeeId,
  }) async {
    if (shouldThrow) throw Exception('Cancellation failed');
    final idx = claims.indexWhere((c) => c.id == claimId);
    if (idx != -1) {
      final updated = claims[idx].copyWith(status: ExpenseClaimStatus.cancelled);
      claims[idx] = updated;
      return updated;
    }
    throw Exception('Claim not found');
  }
}

void main() {
  group('ExpenseClaimStatus enum tests', () {
    test('maps correctly to API values', () {
      expect(ExpenseClaimStatus.pending.apiValue, 'pending');
      expect(ExpenseClaimStatus.approved.apiValue, 'approved');
      expect(ExpenseClaimStatus.rejected.apiValue, 'rejected');
      expect(ExpenseClaimStatus.cancelled.apiValue, 'cancelled');
    });

    test('parses correctly from strings', () {
      expect(ExpenseClaimStatus.fromApiValue('approved'), ExpenseClaimStatus.approved);
      expect(ExpenseClaimStatus.fromApiValue('rejected'), ExpenseClaimStatus.rejected);
      expect(ExpenseClaimStatus.fromApiValue('cancelled'), ExpenseClaimStatus.cancelled);
      expect(ExpenseClaimStatus.fromApiValue('canceled'), ExpenseClaimStatus.cancelled);
      expect(ExpenseClaimStatus.fromApiValue('pending'), ExpenseClaimStatus.pending);
      expect(ExpenseClaimStatus.fromApiValue('unknown'), ExpenseClaimStatus.pending);
    });
  });

  group('ExpenseCategory tests', () {
    test('default categories list contains expected options', () {
      final defaults = ExpenseCategory.defaultCategories();
      expect(defaults.length, 6);
      expect(defaults.map((c) => c.code), containsAll(['fuel', 'parking', 'maintenance', 'cleaning', 'meals', 'other']));
    });

    test('JSON serialization round-trip', () {
      const cat = ExpenseCategory(
        id: 'cat-fuel',
        code: 'fuel',
        displayName: 'Fuel / Gas',
        sortOrder: 1,
        active: true,
      );
      final json = cat.toJson();
      final parsed = ExpenseCategory.fromJson(json);
      expect(parsed, cat);
    });
  });

  group('ExpenseReimbursementLine tests', () {
    test('formattedAmount displays two decimals with dollar sign', () {
      const line = ExpenseReimbursementLine(
        id: 'l1',
        categoryCode: 'fuel',
        categoryDisplayName: 'Fuel / Gas',
        amount: 54.2,
      );
      expect(line.formattedAmount, '\$54.20');
    });

    test('JSON serialization round-trip', () {
      const line = ExpenseReimbursementLine(
        id: 'l1',
        categoryCode: 'parking',
        categoryDisplayName: 'Parking & Tolls',
        amount: 15.0,
        note: 'Lot #4 near school',
        sortOrder: 1,
      );
      final json = line.toJson();
      final parsed = ExpenseReimbursementLine.fromJson(json);
      expect(parsed, line);
    });
  });

  group('ExpenseReimbursementClaim tests', () {
    test('canCancel is true only for pending claims', () {
      final now = DateTime.now();
      final claimPending = ExpenseReimbursementClaim(
        id: 'c1',
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        claimDate: '2026-10-01',
        routeNo: '1021',
        totalAmount: 45.0,
        lines: const [],
        status: ExpenseClaimStatus.pending,
        createdAt: now,
        updatedAt: now,
      );
      expect(claimPending.canCancel, isTrue);

      final claimApproved = claimPending.copyWith(status: ExpenseClaimStatus.approved);
      expect(claimApproved.canCancel, isFalse);

      final claimCancelled = claimPending.copyWith(status: ExpenseClaimStatus.cancelled);
      expect(claimCancelled.canCancel, isFalse);
    });

    test('formattedTotalAmount formats correctly', () {
      final now = DateTime.now();
      final claim = ExpenseReimbursementClaim(
        id: 'c1',
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        claimDate: '2026-10-01',
        routeNo: '1021',
        totalAmount: 125.75,
        lines: const [],
        createdAt: now,
        updatedAt: now,
      );
      expect(claim.formattedTotalAmount, '\$125.75');
    });

    test('JSON serialization round-trip', () {
      final now = DateTime.now();
      final claim = ExpenseReimbursementClaim(
        id: 'c10',
        employeeId: 'EMP100',
        employeeName: 'Jane Smith',
        claimDate: '2026-09-30',
        routeNo: '302',
        totalAmount: 35.50,
        lines: const [
          ExpenseReimbursementLine(
            id: 'l1',
            categoryCode: 'meals',
            categoryDisplayName: 'Meal Allowance',
            amount: 35.50,
            note: 'Overtime meal subsidy',
            sortOrder: 1,
          ),
        ],
        status: ExpenseClaimStatus.approved,
        approvalNotes: 'Approved as per policy',
        approvedByName: 'Dispatcher Alice',
        createdAt: now,
        updatedAt: now,
      );

      final json = claim.toJson();
      final parsed = ExpenseReimbursementClaim.fromJson(json);
      expect(parsed.id, claim.id);
      expect(parsed.employeeId, claim.employeeId);
      expect(parsed.totalAmount, claim.totalAmount);
      expect(parsed.lines.length, 1);
      expect(parsed.status, ExpenseClaimStatus.approved);
      expect(parsed.approvalNotes, 'Approved as per policy');
    });
  });

  group('ExpenseReimbursementBloc tests', () {
    late MockExpenseReimbursementRepository repo;

    setUp(() {
      repo = MockExpenseReimbursementRepository();
    });

    test('LoadExpenseClaims emits loaded state with claims', () async {
      final now = DateTime.now();
      repo.claims = [
        ExpenseReimbursementClaim(
          id: 'claim-1',
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          claimDate: '2026-10-01',
          routeNo: '1021',
          totalAmount: 50.0,
          lines: const [],
          status: ExpenseClaimStatus.pending,
          createdAt: now,
          updatedAt: now,
        ),
      ];

      final bloc = ExpenseReimbursementBloc(repository: repo);
      final states = <ExpenseReimbursementState>[];
      bloc.stream.listen(states.add);

      bloc.add(const LoadExpenseClaims(employeeId: 'EMP001'));
      await Future.delayed(const Duration(milliseconds: 50));

      expect(states.length, 2);
      expect(states[0], isA<ExpenseReimbursementLoading>());
      expect(states[1], isA<ExpenseReimbursementLoaded>());

      final loaded = states[1] as ExpenseReimbursementLoaded;
      expect(loaded.claims.length, 1);
      expect(loaded.pendingCount, 1);
      expect(loaded.approvedCount, 0);

      await bloc.close();
    });

    test('SubmitExpenseClaimEvent emits success and reloads claims', () async {
      final now = DateTime.now();
      final bloc = ExpenseReimbursementBloc(repository: repo);
      final states = <ExpenseReimbursementState>[];
      bloc.stream.listen(states.add);

      final newClaim = ExpenseReimbursementClaim(
        id: '',
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        claimDate: '2026-10-01',
        routeNo: '1021',
        totalAmount: 25.0,
        lines: const [],
        status: ExpenseClaimStatus.pending,
        createdAt: now,
        updatedAt: now,
      );

      bloc.add(SubmitExpenseClaimEvent(newClaim));
      await Future.delayed(const Duration(milliseconds: 50));

      expect(states.any((s) => s is ExpenseReimbursementSubmitting), isTrue);
      expect(states.any((s) => s is ExpenseReimbursementSubmitSuccess), isTrue);
      expect(states.last, isA<ExpenseReimbursementLoaded>());

      await bloc.close();
    });

    test('CancelExpenseClaimEvent emits cancel success and reloads claims', () async {
      final now = DateTime.now();
      repo.claims = [
        ExpenseReimbursementClaim(
          id: 'claim-1',
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          claimDate: '2026-10-01',
          routeNo: '1021',
          totalAmount: 50.0,
          lines: const [],
          status: ExpenseClaimStatus.pending,
          createdAt: now,
          updatedAt: now,
        ),
      ];

      final bloc = ExpenseReimbursementBloc(repository: repo);
      final states = <ExpenseReimbursementState>[];
      bloc.stream.listen(states.add);

      bloc.add(const CancelExpenseClaimEvent(
        claimId: 'claim-1',
        employeeId: 'EMP001',
      ));
      await Future.delayed(const Duration(milliseconds: 50));

      expect(states.any((s) => s is ExpenseReimbursementCancelling), isTrue);
      expect(states.any((s) => s is ExpenseReimbursementCancelSuccess), isTrue);

      final loaded = states.last as ExpenseReimbursementLoaded;
      expect(loaded.claims.first.status, ExpenseClaimStatus.cancelled);

      await bloc.close();
    });
  });
}
