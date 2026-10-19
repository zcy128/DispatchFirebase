import 'package:equatable/equatable.dart';
import '../models/expense_reimbursement_model.dart';

abstract class ExpenseReimbursementState extends Equatable {
  const ExpenseReimbursementState();

  @override
  List<Object?> get props => [];
}

class ExpenseReimbursementInitial extends ExpenseReimbursementState {
  const ExpenseReimbursementInitial();
}

class ExpenseReimbursementLoading extends ExpenseReimbursementState {
  const ExpenseReimbursementLoading();
}

class ExpenseReimbursementLoaded extends ExpenseReimbursementState {
  final List<ExpenseReimbursementClaim> claims;

  const ExpenseReimbursementLoaded({
    required this.claims,
  });

  int get pendingCount =>
      claims.where((c) => c.status == ExpenseClaimStatus.pending).length;

  int get approvedCount =>
      claims.where((c) => c.status == ExpenseClaimStatus.approved).length;

  double get approvedTotalAmount => claims
      .where((c) => c.status == ExpenseClaimStatus.approved)
      .fold(0.0, (sum, c) => sum + c.totalAmount);

  double get pendingTotalAmount => claims
      .where((c) => c.status == ExpenseClaimStatus.pending)
      .fold(0.0, (sum, c) => sum + c.totalAmount);

  ExpenseReimbursementLoaded copyWith({
    List<ExpenseReimbursementClaim>? claims,
  }) {
    return ExpenseReimbursementLoaded(
      claims: claims ?? this.claims,
    );
  }

  @override
  List<Object?> get props => [claims];
}

class ExpenseReimbursementSubmitting extends ExpenseReimbursementState {
  const ExpenseReimbursementSubmitting();
}

class ExpenseReimbursementSubmitSuccess extends ExpenseReimbursementState {
  final ExpenseReimbursementClaim claim;

  const ExpenseReimbursementSubmitSuccess(this.claim);

  @override
  List<Object?> get props => [claim];
}

class ExpenseReimbursementSubmitFailure extends ExpenseReimbursementState {
  final String error;

  const ExpenseReimbursementSubmitFailure(this.error);

  @override
  List<Object?> get props => [error];
}

class ExpenseReimbursementCancelling extends ExpenseReimbursementState {
  const ExpenseReimbursementCancelling();
}

class ExpenseReimbursementCancelSuccess extends ExpenseReimbursementState {
  final ExpenseReimbursementClaim claim;

  const ExpenseReimbursementCancelSuccess(this.claim);

  @override
  List<Object?> get props => [claim];
}

class ExpenseReimbursementCancelFailure extends ExpenseReimbursementState {
  final String error;

  const ExpenseReimbursementCancelFailure(this.error);

  @override
  List<Object?> get props => [error];
}

class ExpenseReimbursementFailure extends ExpenseReimbursementState {
  final String error;

  const ExpenseReimbursementFailure(this.error);

  @override
  List<Object?> get props => [error];
}
