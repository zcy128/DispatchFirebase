import 'package:equatable/equatable.dart';
import '../models/expense_reimbursement_model.dart';

abstract class ExpenseReimbursementEvent extends Equatable {
  const ExpenseReimbursementEvent();

  @override
  List<Object?> get props => [];
}

class LoadExpenseClaims extends ExpenseReimbursementEvent {
  final String? employeeId;
  final String? status;

  const LoadExpenseClaims({this.employeeId, this.status});

  @override
  List<Object?> get props => [employeeId, status];
}

class ExpenseClaimsUpdated extends ExpenseReimbursementEvent {
  final List<ExpenseReimbursementClaim> claims;

  const ExpenseClaimsUpdated(this.claims);

  @override
  List<Object?> get props => [claims];
}

class SubmitExpenseClaimEvent extends ExpenseReimbursementEvent {
  final ExpenseReimbursementClaim claim;

  const SubmitExpenseClaimEvent(this.claim);

  @override
  List<Object?> get props => [claim];
}

class CancelExpenseClaimEvent extends ExpenseReimbursementEvent {
  final String claimId;
  final String employeeId;

  const CancelExpenseClaimEvent({
    required this.claimId,
    required this.employeeId,
  });

  @override
  List<Object?> get props => [claimId, employeeId];
}
