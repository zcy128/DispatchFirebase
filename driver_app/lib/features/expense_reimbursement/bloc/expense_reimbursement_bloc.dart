import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repository/expense_reimbursement_repository.dart';
import 'expense_reimbursement_event.dart';
import 'expense_reimbursement_state.dart';

class ExpenseReimbursementBloc
    extends Bloc<ExpenseReimbursementEvent, ExpenseReimbursementState> {
  final ExpenseReimbursementRepository repository;

  ExpenseReimbursementBloc({required this.repository})
      : super(const ExpenseReimbursementInitial()) {
    on<LoadExpenseClaims>(_onLoadExpenseClaims);
    on<ExpenseClaimsUpdated>(_onExpenseClaimsUpdated);
    on<SubmitExpenseClaimEvent>(_onSubmitExpenseClaim);
    on<CancelExpenseClaimEvent>(_onCancelExpenseClaim);
  }

  Future<void> _onLoadExpenseClaims(
    LoadExpenseClaims event,
    Emitter<ExpenseReimbursementState> emit,
  ) async {
    emit(const ExpenseReimbursementLoading());
    try {
      final claims = await repository.getClaims(
        employeeId: event.employeeId,
        status: event.status,
      );
      emit(ExpenseReimbursementLoaded(claims: claims));
    } catch (e) {
      emit(ExpenseReimbursementFailure(e.toString()));
    }
  }

  void _onExpenseClaimsUpdated(
    ExpenseClaimsUpdated event,
    Emitter<ExpenseReimbursementState> emit,
  ) {
    emit(ExpenseReimbursementLoaded(claims: event.claims));
  }

  Future<void> _onSubmitExpenseClaim(
    SubmitExpenseClaimEvent event,
    Emitter<ExpenseReimbursementState> emit,
  ) async {
    emit(const ExpenseReimbursementSubmitting());
    try {
      final saved = await repository.submitClaim(event.claim);
      emit(ExpenseReimbursementSubmitSuccess(saved));

      final updatedList = await repository.getClaims(
        employeeId: event.claim.employeeId,
      );
      emit(ExpenseReimbursementLoaded(claims: updatedList));
    } catch (e) {
      emit(ExpenseReimbursementSubmitFailure(e.toString()));
    }
  }

  Future<void> _onCancelExpenseClaim(
    CancelExpenseClaimEvent event,
    Emitter<ExpenseReimbursementState> emit,
  ) async {
    emit(const ExpenseReimbursementCancelling());
    try {
      final updated = await repository.cancelClaim(
        claimId: event.claimId,
        employeeId: event.employeeId,
      );
      emit(ExpenseReimbursementCancelSuccess(updated));

      final updatedList = await repository.getClaims(
        employeeId: event.employeeId,
      );
      emit(ExpenseReimbursementLoaded(claims: updatedList));
    } catch (e) {
      emit(ExpenseReimbursementCancelFailure(e.toString()));
    }
  }
}
