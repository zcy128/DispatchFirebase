import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/time_off_bloc.dart';
import '../bloc/time_off_event.dart';
import '../bloc/time_off_state.dart';
import '../repository/time_off_repository.dart';
import 'create_leave_request_dialog.dart';
import 'widgets/time_off_empty_state.dart';
import 'widgets/time_off_filter_chips.dart';
import 'widgets/time_off_header_card.dart';
import 'widgets/time_off_kpi_grid.dart';
import 'widgets/time_off_request_card.dart';

/// Dedicated full page for viewing and managing driver time-off requests.
class TimeOffPage extends StatelessWidget {
  final String driverId;
  final String driverName;

  const TimeOffPage({
    super.key,
    required this.driverId,
    this.driverName = 'Driver',
  });

  static Route<void> route({
    required String driverId,
    required String driverName,
    TimeOffBloc? bloc,
  }) {
    return MaterialPageRoute(
      builder: (context) {
        final page = TimeOffPage(
          driverId: driverId,
          driverName: driverName,
        );
        if (bloc != null) {
          return BlocProvider<TimeOffBloc>.value(
            value: bloc,
            child: page,
          );
        }
        return BlocProvider<TimeOffBloc>(
          create: (ctx) => TimeOffBloc(
            repository: ctx.read<TimeOffRepository>(),
          )..add(LoadTimeOffRequestsEvent(driverId)),
          child: page,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    try {
      context.read<TimeOffBloc>();
      return _buildContent(context);
    } catch (_) {
      return BlocProvider<TimeOffBloc>(
        create: (ctx) => TimeOffBloc(
          repository: ctx.read<TimeOffRepository>(),
        )..add(LoadTimeOffRequestsEvent(driverId)),
        child: Builder(
          builder: (innerContext) => _buildContent(innerContext),
        ),
      );
    }
  }

  Widget _buildContent(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<TimeOffBloc, TimeOffState>(
      listener: (context, state) {
        if (state is TimeOffLoaded && state.successMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.successMessage!),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        if (state is TimeOffLoaded && state.errorMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.errorMessage!),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: isDark ? AppColors.darkCard : Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            tooltip: 'Back',
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Leave Requests',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
              Text(
                'Time-Off & Absence Applications',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'Refresh Requests',
              icon: const Icon(Icons.sync_rounded, color: AppColors.primary),
              onPressed: () {
                context
                    .read<TimeOffBloc>()
                    .add(LoadTimeOffRequestsEvent(driverId));
              },
            ),
          ],
        ),
        body: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            context.read<TimeOffBloc>().add(LoadTimeOffRequestsEvent(driverId));
          },
          child: BlocBuilder<TimeOffBloc, TimeOffState>(
            builder: (context, state) {
              return CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  // Top Header Card
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                      child: TimeOffHeaderCard(),
                    ),
                  ),

                  // KPI Metric Summary Bar
                  if (state is TimeOffLoaded)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        child: TimeOffKpiGrid(
                          totalCount: state.totalCount,
                          pendingCount: state.pendingCount,
                          approvedCount: state.approvedCount,
                          rejectedCount: state.rejectedCount,
                        ),
                      ),
                    ),

                  // Filter Chips
                  if (state is TimeOffLoaded)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        child: TimeOffFilterChips(
                          currentFilter: state.statusFilter,
                          totalCount: state.totalCount,
                          pendingCount: state.pendingCount,
                          approvedCount: state.approvedCount,
                          rejectedCount: state.rejectedCount,
                          onFilterSelected: (status) {
                            context
                                .read<TimeOffBloc>()
                                .add(FilterTimeOffStatusEvent(status));
                          },
                        ),
                      ),
                    ),

                  // Content List, Loading, or Empty View
                  if (state is TimeOffLoading)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child:
                            CircularProgressIndicator(color: AppColors.primary),
                      ),
                    )
                  else if (state is TimeOffLoaded && state.requests.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: TimeOffEmptyState(
                        onSubmitNew: () => _openCreateDialog(context),
                      ),
                    )
                  else if (state is TimeOffLoaded)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final item = state.requests[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: TimeOffRequestCard(
                                item: item,
                                onCancel: () => _confirmCancel(context, item.id),
                              ),
                            );
                          },
                          childCount: state.requests.length,
                        ),
                      ),
                    )
                  else
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Text(
                          'Initialize forms by refreshing...',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
        floatingActionButton: FloatingActionButton.extended(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.black,
          icon: const Icon(Icons.add_rounded),
          label: const Text(
            'New Request',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          onPressed: () => _openCreateDialog(context),
        ),
      ),
    );
  }

  void _openCreateDialog(BuildContext context) {
    CreateLeaveRequestDialog.show(
      context,
      employeeId: driverId,
      employeeName: driverName,
    );
  }

  void _confirmCancel(BuildContext context, String requestId) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Cancel Request?'),
        content: const Text(
          'Are you sure you want to withdraw this leave request? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Keep'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              minimumSize: const Size(0, 40),
            ),
            onPressed: () {
              Navigator.of(dialogCtx).pop();
              context
                  .read<TimeOffBloc>()
                  .add(CancelTimeOffRequestEvent(requestId));
            },
            child: const Text('Cancel Request'),
          ),
        ],
      ),
    );
  }
}
