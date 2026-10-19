import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../../../core/widgets/attachment_picker_widget.dart';
import '../bloc/expense_reimbursement_bloc.dart';
import '../bloc/expense_reimbursement_event.dart';
import '../bloc/expense_reimbursement_state.dart';
import '../models/expense_reimbursement_model.dart';
import '../repository/expense_reimbursement_repository.dart';

class ExpenseReimbursementDetailPage extends StatelessWidget {
  final ExpenseReimbursementClaim initialClaim;

  const ExpenseReimbursementDetailPage({
    super.key,
    required this.initialClaim,
  });

  @override
  Widget build(BuildContext context) {
    ExpenseReimbursementBloc? existingBloc;
    try {
      existingBloc = context.read<ExpenseReimbursementBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _ExpenseReimbursementDetailView(initialClaim: initialClaim);

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<ExpenseReimbursementBloc>(
      create: (ctx) => ExpenseReimbursementBloc(
        repository: ctx.read<ExpenseReimbursementRepository>(),
      ),
      child: view,
    );
  }
}

class _ExpenseReimbursementDetailView extends StatefulWidget {
  final ExpenseReimbursementClaim initialClaim;

  const _ExpenseReimbursementDetailView({
    required this.initialClaim,
  });

  @override
  State<_ExpenseReimbursementDetailView> createState() =>
      _ExpenseReimbursementDetailViewState();
}

class _ExpenseReimbursementDetailViewState
    extends State<_ExpenseReimbursementDetailView> {
  static const Color _brandColor = Color(0xFF0D9488); // Teal
  late ExpenseReimbursementClaim _claim;

  @override
  void initState() {
    super.initState();
    _claim = widget.initialClaim;
  }

  Future<void> _confirmCancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Expense Claim'),
        content: Text(
          'Are you sure you want to cancel this expense claim of ${_claim.formattedTotalAmount}?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('No, Keep It'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Yes, Cancel Claim'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      context.read<ExpenseReimbursementBloc>().add(
            CancelExpenseClaimEvent(
              claimId: _claim.id,
              employeeId: _claim.employeeId,
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<ExpenseReimbursementBloc, ExpenseReimbursementState>(
      listener: (context, state) {
        if (state is ExpenseReimbursementCancelSuccess) {
          setState(() {
            _claim = state.claim;
          });
          AppFeedback.showSuccess(
            context,
            message: 'Expense claim cancelled successfully.',
          );
        } else if (state is ExpenseReimbursementCancelFailure) {
          AppFeedback.showError(
            context,
            title: 'Cancellation Failed',
            message: state.error,
          );
        }
      },
      child: Scaffold(
        backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
        appBar: AppBar(
          title: const Text('Claim Details'),
          elevation: 0,
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildStatusCard(isDark),
            const SizedBox(height: 16),
            _buildOverviewCard(isDark),
            const SizedBox(height: 16),
            _buildLineItemsCard(isDark),
            if (_claim.attachmentUrls.isNotEmpty) ...[
              const SizedBox(height: 16),
              AttachmentPickerWidget(
                title: 'Attached Receipts & Documents',
                initialUrls: _claim.attachmentUrls,
                readOnly: true,
                onAttachmentsChanged: (_) {},
              ),
            ],
            if (_claim.approvalNotes != null && _claim.approvalNotes!.isNotEmpty ||
                _claim.approvedByName != null && _claim.approvedByName!.isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildOfficeReviewCard(isDark),
            ],
            const SizedBox(height: 24),
            if (_claim.canCancel) _buildCancelButton(),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard(bool isDark) {
    final status = _claim.status;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: status.color.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: status.color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: status.color.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(status.icon, color: status.color, size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  status.label,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: status.color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _getStatusExplanation(status),
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _getStatusExplanation(ExpenseClaimStatus status) {
    switch (status) {
      case ExpenseClaimStatus.pending:
        return 'Submitted to dispatch office for review and approval.';
      case ExpenseClaimStatus.approved:
        return 'Approved by office administration for payroll reimbursement.';
      case ExpenseClaimStatus.rejected:
        return 'Rejected by office administration. See notes below.';
      case ExpenseClaimStatus.cancelled:
        return 'This claim has been cancelled.';
    }
  }

  Widget _buildOverviewCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Claim Information',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 12),
          _buildDetailRow('Claim Date', _claim.claimDate, isDark),
          if (_claim.routeNo.isNotEmpty)
            _buildDetailRow('Route #', _claim.routeNo, isDark),
          _buildDetailRow('Driver', _claim.employeeName, isDark),
          _buildDetailRow(
            'Submitted',
            DateFormat('MMM d, yyyy h:mm a').format(_claim.createdAt.toLocal()),
            isDark,
          ),
          Divider(
            height: 20,
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total Claim Amount',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                ),
              ),
              Text(
                _claim.formattedTotalAmount,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: _brandColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLineItemsCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Expense Items (${_claim.lines.length})',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 12),
          ..._claim.lines.asMap().entries.map((entry) {
            final idx = entry.key;
            final line = entry.value;
            final isLast = idx == _claim.lines.length - 1;

            return Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: _brandColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        _getCategoryIcon(line.categoryCode),
                        size: 20,
                        color: _brandColor,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            line.categoryDisplayName.isNotEmpty
                                ? line.categoryDisplayName
                                : line.categoryCode,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                            ),
                          ),
                          if (line.note.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(
                              line.note,
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Text(
                      line.formattedAmount,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                      ),
                    ),
                  ],
                ),
                if (!isLast)
                  Divider(
                    height: 20,
                    color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                  ),
              ],
            );
          }),
        ],
      ),
    );
  }

  IconData _getCategoryIcon(String code) {
    switch (code.toLowerCase()) {
      case 'fuel':
        return Icons.local_gas_station_outlined;
      case 'parking':
        return Icons.local_parking_outlined;
      case 'maintenance':
        return Icons.build_outlined;
      case 'cleaning':
        return Icons.cleaning_services_outlined;
      case 'meals':
        return Icons.restaurant_outlined;
      default:
        return Icons.receipt_long_outlined;
    }
  }

  Widget _buildOfficeReviewCard(bool isDark) {
    final isApproved = _claim.status == ExpenseClaimStatus.approved;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isApproved
              ? AppColors.success.withValues(alpha: 0.4)
              : AppColors.error.withValues(alpha: 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isApproved ? Icons.verified_user_outlined : Icons.feedback_outlined,
                size: 20,
                color: isApproved ? AppColors.success : AppColors.error,
              ),
              const SizedBox(width: 8),
              Text(
                'Office Review Feedback',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_claim.approvedByName != null && _claim.approvedByName!.isNotEmpty)
            _buildDetailRow('Reviewed By', _claim.approvedByName!, isDark),
          if (_claim.approvedAt != null)
            _buildDetailRow(
              'Review Date',
              DateFormat('MMM d, yyyy h:mm a').format(_claim.approvedAt!.toLocal()),
              isDark,
            ),
          if (_claim.approvalNotes != null && _claim.approvalNotes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[850] : Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                ),
              ),
              child: Text(
                _claim.approvalNotes!,
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCancelButton() {
    return BlocBuilder<ExpenseReimbursementBloc, ExpenseReimbursementState>(
      builder: (context, state) {
        final isCancelling = state is ExpenseReimbursementCancelling;

        return OutlinedButton.icon(
          onPressed: isCancelling ? null : _confirmCancel,
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.error,
            side: const BorderSide(color: AppColors.error),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          icon: isCancelling
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.cancel_outlined, size: 20),
          label: Text(
            isCancelling ? 'Cancelling Claim...' : 'Cancel This Claim',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
        );
      },
    );
  }
}
