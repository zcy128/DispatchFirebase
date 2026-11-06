import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/expense_reimbursement_bloc.dart';
import '../bloc/expense_reimbursement_event.dart';
import '../bloc/expense_reimbursement_state.dart';
import '../models/expense_reimbursement_model.dart';
import '../repository/expense_reimbursement_repository.dart';
import 'expense_reimbursement_detail_page.dart';
import 'expense_reimbursement_form_page.dart';
import 'widgets/expense_claim_card.dart';
import 'widgets/expense_empty_state.dart';
import 'widgets/expense_filter_chips.dart';
import 'widgets/expense_kpi_header.dart';

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
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ExpenseKpiHeader(
                          pendingCount: pendingCount,
                          approvedCount: approvedCount,
                          approvedTotal: approvedTotal,
                          brandColor: _brandColor,
                        ),
                        const SizedBox(height: 16),
                        ExpenseFilterChips(
                          selectedFilter: _selectedFilter,
                          brandColor: _brandColor,
                          onFilterSelected: (newFilter) {
                            setState(() {
                              _selectedFilter = newFilter;
                            });
                          },
                        ),
                      ],
                    ),
                  ),
                ),
                if (filteredClaims.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: ExpenseEmptyState(selectedFilter: _selectedFilter),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 88),
                    sliver: SliverList.builder(
                      itemCount: filteredClaims.length,
                      itemBuilder: (context, index) {
                        final claim = filteredClaims[index];
                        return ExpenseClaimCard(
                          claim: claim,
                          brandColor: _brandColor,
                          onTap: () => _openDetailPage(claim),
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
