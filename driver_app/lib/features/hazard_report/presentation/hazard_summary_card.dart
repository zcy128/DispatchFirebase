import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/hazard_report_bloc.dart';
import '../bloc/hazard_report_event.dart';
import '../bloc/hazard_report_state.dart';
import '../models/hazard_report_model.dart';
import '../repository/hazard_report_repository.dart';
import 'hazard_report_form_page.dart';
import 'hazard_report_history_page.dart';

class HazardSummaryCard extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultVehicleUnit;

  const HazardSummaryCard({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteNo = '',
    this.defaultVehicleUnit = '',
  });

  @override
  Widget build(BuildContext context) {
    HazardReportBloc? existingBloc;
    try {
      existingBloc = context.read<HazardReportBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final cardView = _HazardSummaryCardView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteNo: defaultRouteNo,
      defaultVehicleUnit: defaultVehicleUnit,
    );

    if (existingBloc != null) {
      return cardView;
    }

    return BlocProvider<HazardReportBloc>(
      create: (ctx) => HazardReportBloc(
        repository: ctx.read<HazardReportRepository>(),
      )..add(LoadHazardReports(employeeId: driverId)),
      child: cardView,
    );
  }
}

class _HazardSummaryCardView extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultVehicleUnit;

  const _HazardSummaryCardView({
    required this.driverId,
    required this.driverName,
    required this.defaultRouteNo,
    required this.defaultVehicleUnit,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary =
        isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;

    return BlocBuilder<HazardReportBloc, HazardReportState>(
      builder: (context, state) {
        int totalReports = 0;
        int openReports = 0;
        int resolvedReports = 0;
        HazardReportModel? latestReport;

        if (state is HazardReportLoaded) {
          totalReports = state.totalCount;
          openReports = state.openCount;
          resolvedReports = state.resolvedCount;
          if (state.reports.isNotEmpty) {
            latestReport = state.reports.first;
          }
        }

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD97706).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.warning_amber_rounded,
                      color: Color(0xFFD97706),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Hazard & Near-Miss Reports',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Report unsafe road conditions, equipment defects, and near-misses.',
                          style: TextStyle(
                            fontSize: 11,
                            color: textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // KPI Stats Row
              Row(
                children: [
                  _buildStatBadge(
                    label: 'Total Reports',
                    value: '$totalReports',
                    color: Colors.blue,
                    icon: Icons.list_alt_rounded,
                    isDark: isDark,
                  ),
                  const SizedBox(width: 8),
                  _buildStatBadge(
                    label: 'Open / Pending',
                    value: '$openReports',
                    color: openReports > 0 ? const Color(0xFFD97706) : AppColors.success,
                    icon: openReports > 0 ? Icons.access_time_rounded : Icons.check_circle_outline_rounded,
                    isDark: isDark,
                  ),
                  const SizedBox(width: 8),
                  _buildStatBadge(
                    label: 'Resolved',
                    value: '$resolvedReports',
                    color: AppColors.success,
                    icon: Icons.verified_rounded,
                    isDark: isDark,
                  ),
                ],
              ),

              // Latest Report Preview (if any)
              if (latestReport != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkBg.withValues(alpha: 0.6)
                        : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isDark
                          ? AppColors.darkCardBorder.withValues(alpha: 0.5)
                          : AppColors.lightCardBorder,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.history_rounded,
                        size: 16,
                        color: textSecondary,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Latest: ${latestReport.activeHazardLabels.isNotEmpty ? latestReport.activeHazardLabels.first : "General Hazard"} (${latestReport.eventTime?.substring(0, 10) ?? latestReport.createdAt.toIso8601String().substring(0, 10)})',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: latestReport.status.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: latestReport.status.color.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          latestReport.status.label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: latestReport.status.color,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),

              // Action Buttons Row
              Row(
                children: [
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFD97706),
                      side: const BorderSide(color: Color(0xFFD97706)),
                      minimumSize: const Size(0, 42),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    icon: const Icon(Icons.add_rounded, size: 16),
                    label: const Text(
                      'Report Hazard',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (ctx) => BlocProvider.value(
                            value: context.read<HazardReportBloc>(),
                            child: HazardReportFormPage(
                              driverId: driverId,
                              driverName: driverName,
                              defaultRouteNo: defaultRouteNo,
                              defaultVehicleUnit: defaultVehicleUnit,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  const Spacer(),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(0, 42),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                    label: const Text(
                      'View All Reports',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (ctx) => BlocProvider.value(
                            value: context.read<HazardReportBloc>(),
                            child: HazardReportHistoryPage(
                              driverId: driverId,
                              driverName: driverName,
                              defaultRouteNo: defaultRouteNo,
                              defaultVehicleUnit: defaultVehicleUnit,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatBadge({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
    required bool isDark,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 13, color: color),
                const SizedBox(width: 4),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
