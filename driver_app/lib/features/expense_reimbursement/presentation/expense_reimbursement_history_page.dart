import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../bloc/expense_reimbursement_bloc.dart';
import '../bloc/expense_reimbursement_event.dart';
import '../bloc/expense_reimbursement_state.dart';
import '../models/expense_reimbursement_model.dart';
import '../repository/expense_reimbursement_repository.dart';
import 'expense_reimbursement_detail_page.dart';
import 'expense_reimbursement_form_page.dart';

class ExpenseReimbursementHistoryPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;

  const ExpenseReimbursementHistoryPage({
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

    final view = _ExpenseReimbursementHistoryView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteNo: defaultRouteNo,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<ExpenseReimbursementBloc>(
      create: (ctx) => ExpenseReimbursementBloc(
        repository: ctx.read<ExpenseReimbursementRepository>(),
      )..add(LoadExpenseClaims(employeeId: driverId)),
      child: view,
    );
  }
}

class _ExpenseReimbursementHistoryView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;

  const _ExpenseReimbursementHistoryView({
    required this.driverId,
    required this.driverName,
    required this.defaultRouteNo,
  });

  @override
  State<_ExpenseReimbursementHistoryView> createState() =>
      _ExpenseReimbursementHistoryViewState();
}

class _ExpenseReimbursementHistoryViewState
    extends State<_ExpenseReimbursementHistoryView> {
  static const Color _brandColor = Color(0xFF0D9488); // Teal
  String _selectedFilter = 'all'; // 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context
          .read<ExpenseReimbursementBloc>()
          .add(LoadExpenseClaims(employeeId: widget.driverId));
    });
  }

  void _openCreatePage() {
    ExpenseReimbursementBloc? expenseBloc;
    try {
      expenseBloc = context.read<ExpenseReimbursementBloc>();
    } catch (_) {
      expenseBloc = null;
    }

    Navigator.of(context)
        .push<bool>(
      MaterialPageRoute(
        builder: (ctx) {
          if (expenseBloc != null) {
            return BlocProvider<ExpenseReimbursementBloc>.value(
              value: expenseBloc,
              child: ExpenseReimbursementFormPage(
                driverId: widget.driverId,
                driverName: widget.driverName,
                defaultRouteNo: widget.defaultRouteNo,
              ),
            );
          }
          return ExpenseReimbursementFormPage(
            driverId: widget.driverId,
            driverName: widget.driverName,
            defaultRouteNo: widget.defaultRouteNo,
          );
        },
      ),
    )
        .then((created) {
      if (created == true && mounted) {
        context
            .read<ExpenseReimbursementBloc>()
            .add(LoadExpenseClaims(employeeId: widget.driverId));
      }
    });
  }

  void _openDetailPage(ExpenseReimbursementClaim claim) {
    ExpenseReimbursementBloc? expenseBloc;
    try {
      expenseBloc = context.read<ExpenseReimbursementBloc>();
    } catch (_) {
      expenseBloc = null;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) {
          if (expenseBloc != null) {
            return BlocProvider<ExpenseReimbursementBloc>.value(
              value: expenseBloc,
              child: ExpenseReimbursementDetailPage(initialClaim: claim),
            );
          }
          return ExpenseReimbursementDetailPage(initialClaim: claim);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        title: const Text('Expense Claims'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              context
                  .read<ExpenseReimbursementBloc>()
                  .add(LoadExpenseClaims(employeeId: widget.driverId));
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreatePage,
        backgroundColor: _brandColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Claim', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: BlocBuilder<ExpenseReimbursementBloc, ExpenseReimbursementState>(
        builder: (context, state) {
          if (state is ExpenseReimbursementLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ExpenseReimbursementFailure) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                    const SizedBox(height: 12),
                    Text(
                      'Failed to load expense claims',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      state.error,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        context
                            .read<ExpenseReimbursementBloc>()
                            .add(LoadExpenseClaims(employeeId: widget.driverId));
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          List<ExpenseReimbursementClaim> claims = [];
          if (state is ExpenseReimbursementLoaded) {
            claims = state.claims;
          }

          final pendingCount =
              claims.where((c) => c.status == ExpenseClaimStatus.pending).length;
          final approvedCount =
              claims.where((c) => c.status == ExpenseClaimStatus.approved).length;
          final approvedTotal = claims
              .where((c) => c.status == ExpenseClaimStatus.approved)
              .fold(0.0, (sum, c) => sum + c.totalAmount);

          // Apply filter
          final filteredClaims = claims.where((c) {
            if (_selectedFilter == 'all') return true;
            return c.status.apiValue == _selectedFilter;
          }).toList();

          return RefreshIndicator(
            onRefresh: () async {
              context
                  .read<ExpenseReimbursementBloc>()
                  .add(LoadExpenseClaims(employeeId: widget.driverId));
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
              children: [
                _buildSummaryHeader(
                  totalClaims: claims.length,
                  pendingCount: pendingCount,
                  approvedCount: approvedCount,
                  approvedTotal: approvedTotal,
                  isDark: isDark,
                ),
                const SizedBox(height: 16),
                _buildFilterChips(isDark),
                const SizedBox(height: 14),
                if (filteredClaims.isEmpty)
                  _buildEmptyState(isDark)
                else
                  ...filteredClaims.map((claim) => _buildClaimCard(claim, isDark)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryHeader({
    required int totalClaims,
    required int pendingCount,
    required int approvedCount,
    required double approvedTotal,
    required bool isDark,
  }) {
    return Row(
      children: [
        Expanded(
          child: _buildMetricTile(
            label: 'Pending',
            value: pendingCount.toString(),
            color: const Color(0xFFD97706),
            icon: Icons.hourglass_top_rounded,
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricTile(
            label: 'Approved',
            value: approvedCount.toString(),
            color: AppColors.success,
            icon: Icons.check_circle_outline_rounded,
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricTile(
            label: 'Reimbursed',
            value: '\$${approvedTotal.toStringAsFixed(0)}',
            color: _brandColor,
            icon: Icons.payments_outlined,
            isDark: isDark,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips(bool isDark) {
    final filters = [
      {'key': 'all', 'label': 'All'},
      {'key': 'pending', 'label': 'Pending'},
      {'key': 'approved', 'label': 'Approved'},
      {'key': 'rejected', 'label': 'Rejected'},
      {'key': 'cancelled', 'label': 'Cancelled'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((f) {
          final isSelected = _selectedFilter == f['key'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(f['label']!),
              selected: isSelected,
              showCheckmark: false,
              selectedColor: _brandColor,
              labelStyle: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? Colors.white : (isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight),
              ),
              backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? _brandColor : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
                ),
              ),
              onSelected: (_) {
                setState(() {
                  _selectedFilter = f['key']!;
                });
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildClaimCard(ExpenseReimbursementClaim claim, bool isDark) {
    final status = claim.status;
    final categorySummary = claim.lines.map((l) {
      return l.categoryDisplayName.isNotEmpty ? l.categoryDisplayName : l.categoryCode;
    }).toSet().join(', ');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: InkWell(
        onTap: () => _openDetailPage(claim),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: 15,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        claim.claimDate,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                        ),
                      ),
                      if (claim.routeNo.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _brandColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'Route ${claim.routeNo}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: _brandColor,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: status.color.withValues(alpha: isDark ? 0.2 : 0.1),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: status.color.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(status.icon, size: 13, color: status.color),
                        const SizedBox(width: 4),
                        Text(
                          status.label,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: status.color,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (categorySummary.isNotEmpty)
                Text(
                  '${claim.lines.length} item${claim.lines.length == 1 ? '' : 's'}: $categorySummary',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Submitted ${DateFormat('MMM d, yyyy').format(claim.createdAt.toLocal())}',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                  Text(
                    claim.formattedTotalAmount,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: _brandColor,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
        child: Column(
          children: [
            Icon(
              Icons.receipt_long_outlined,
              size: 64,
              color: (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight).withValues(alpha: 0.4),
            ),
            const SizedBox(height: 16),
            Text(
              _selectedFilter == 'all'
                  ? 'No expense claims submitted yet'
                  : 'No $_selectedFilter expense claims',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Tap "New Claim" to submit gas, tolls, maintenance, or other work expenses.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
