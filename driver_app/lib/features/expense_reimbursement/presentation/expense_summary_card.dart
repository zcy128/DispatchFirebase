import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/expense_reimbursement_bloc.dart';
import '../bloc/expense_reimbursement_event.dart';
import '../bloc/expense_reimbursement_state.dart';
import '../models/expense_reimbursement_model.dart';
import '../repository/expense_reimbursement_repository.dart';
import 'expense_reimbursement_form_page.dart';
import 'expense_reimbursement_history_page.dart';

class ExpenseSummaryCard extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;

  const ExpenseSummaryCard({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteNo = '',
  });

  @override
  Widget build(BuildContext context) {
    ExpenseReimbursementBloc? existingBloc;
    try {
      existingBloc = context.read<ExpenseReimbursementBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final cardView = _ExpenseSummaryCardView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteNo: defaultRouteNo,
    );

    if (existingBloc != null) {
      return cardView;
    }

    return BlocProvider<ExpenseReimbursementBloc>(
      create: (ctx) => ExpenseReimbursementBloc(
        repository: ctx.read<ExpenseReimbursementRepository>(),
      )..add(LoadExpenseClaims(employeeId: driverId)),
      child: cardView,
    );
  }
}

class _ExpenseSummaryCardView extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;

  const _ExpenseSummaryCardView({
    required this.driverId,
    required this.driverName,
    required this.defaultRouteNo,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary =
        isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;

    return BlocBuilder<ExpenseReimbursementBloc, ExpenseReimbursementState>(
      builder: (context, state) {
        int totalClaims = 0;
        int pendingReview = 0;
        double approvedTotal = 0.0;
        ExpenseReimbursementClaim? latestClaim;

        if (state is ExpenseReimbursementLoaded) {
          totalClaims = state.claims.length;
          pendingReview = state.pendingCount;
          approvedTotal = state.approvedTotalAmount;
          if (state.claims.isNotEmpty) {
            latestClaim = state.claims.first;
          }
        }

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark
                  ? AppColors.darkCardBorder
                  : AppColors.lightCardBorder,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D9488).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.receipt_long_rounded,
                      color: Color(0xFF0D9488),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Expense Reimbursements',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Fuel, parking, maintenance & driver claims',
                          style: TextStyle(
                            fontSize: 12,
                            color: textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (pendingReview > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.amber.shade700.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Text(
                        '$pendingReview Pending',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade800,
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 14),

              // KPI Metric Tiles
              Row(
                children: [
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Total Claims',
                      value: '$totalClaims',
                      color: Colors.blueGrey,
                      isDark: isDark,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Pending Review',
                      value: '$pendingReview',
                      color: pendingReview > 0
                          ? const Color(0xFFD97706)
                          : const Color(0xFF059669),
                      isDark: isDark,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Reimbursed',
                      value: '\$${approvedTotal.toStringAsFixed(0)}',
                      color: const Color(0xFF059669),
                      isDark: isDark,
                    ),
                  ),
                ],
              ),

              // Latest Claim Snippet
              if (latestClaim != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[850] : Colors.grey[100],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        latestClaim.status.icon,
                        size: 16,
                        color: latestClaim.status.color,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Latest: ${latestClaim.formattedTotalAmount} (${latestClaim.claimDate}) - ${latestClaim.status.label}',
                          style: const TextStyle(fontSize: 12),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 14),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        ExpenseReimbursementBloc? bloc;
                        try {
                          bloc = context.read<ExpenseReimbursementBloc>();
                        } catch (_) {
                          bloc = null;
                        }

                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (ctx) {
                              if (bloc != null) {
                                return BlocProvider<ExpenseReimbursementBloc>.value(
                                  value: bloc,
                                  child: ExpenseReimbursementHistoryPage(
                                    driverId: driverId,
                                    driverName: driverName,
                                    defaultRouteNo: defaultRouteNo,
                                  ),
                                );
                              }
                              return ExpenseReimbursementHistoryPage(
                                driverId: driverId,
                                driverName: driverName,
                                defaultRouteNo: defaultRouteNo,
                              );
                            },
                          ),
                        );
                      },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        side: BorderSide(
                          color: isDark
                              ? AppColors.darkCardBorder
                              : AppColors.lightCardBorder,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      icon: const Icon(Icons.history, size: 18),
                      label: const Text(
                        'History',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        ExpenseReimbursementBloc? bloc;
                        try {
                          bloc = context.read<ExpenseReimbursementBloc>();
                        } catch (_) {
                          bloc = null;
                        }

                        Navigator.of(context)
                            .push<bool>(
                          MaterialPageRoute(
                            builder: (ctx) {
                              if (bloc != null) {
                                return BlocProvider<ExpenseReimbursementBloc>.value(
                                  value: bloc,
                                  child: ExpenseReimbursementFormPage(
                                    driverId: driverId,
                                    driverName: driverName,
                                    defaultRouteNo: defaultRouteNo,
                                  ),
                                );
                              }
                              return ExpenseReimbursementFormPage(
                                driverId: driverId,
                                driverName: driverName,
                                defaultRouteNo: defaultRouteNo,
                              );
                            },
                          ),
                        )
                            .then((created) {
                          if (created == true && context.mounted) {
                            try {
                              context
                                  .read<ExpenseReimbursementBloc>()
                                  .add(LoadExpenseClaims(employeeId: driverId));
                            } catch (_) {}
                          }
                        });
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0D9488),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        elevation: 0,
                      ),
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text(
                        'Submit Claim',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required Color color,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[850] : Colors.grey[50],
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: isDark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
