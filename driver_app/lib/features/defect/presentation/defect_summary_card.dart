import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/defect_bloc.dart';
import '../bloc/defect_event.dart';
import '../bloc/defect_state.dart';
import '../models/defect_model.dart';
import 'create_defect_report_page.dart';
import 'defect_history_page.dart';

class DefectSummaryCard extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultVehicleUnit;

  const DefectSummaryCard({
    super.key,
    required this.driverId,
    required this.driverName,
    required this.defaultVehicleUnit,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary =
        isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;

    return BlocBuilder<DefectBloc, DefectState>(
      builder: (context, state) {
        int totalReports = 0;
        int openDefects = 0;
        int resolvedCount = 0;
        VehicleDefectReport? latestReport;
        List<String> fleetVehicles = [];

        if (state is DefectLoaded) {
          totalReports = state.reports.length;
          openDefects = state.openDefectsCount;
          resolvedCount = state.reports
              .where((r) => r.status == DefectReportStatus.resolved)
              .length;
          if (state.reports.isNotEmpty) {
            latestReport = state.reports.first;
          }
          fleetVehicles = state.fleetVehicles;
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
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.car_repair_rounded,
                      color: AppColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Vehicle Defects & Maintenance',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Report vehicle defects and track Fleet Department repairs.',
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
                  Expanded(
                    child: _buildMetricTile(
                      'TOTAL',
                      totalReports.toString(),
                      isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
                      isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      'OPEN',
                      openDefects.toString(),
                      openDefects > 0
                          ? AppColors.error.withValues(alpha: 0.15)
                          : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                      openDefects > 0
                          ? AppColors.error
                          : (isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      'RESOLVED',
                      resolvedCount.toString(),
                      resolvedCount > 0
                          ? AppColors.success.withValues(alpha: 0.15)
                          : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                      resolvedCount > 0
                          ? AppColors.success
                          : (isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight),
                    ),
                  ),
                ],
              ),

              // Latest Report Status Preview
              if (latestReport != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF0F172A)
                        : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isDark
                          ? AppColors.darkCardBorder
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
                      const SizedBox(width: 6),
                      Text(
                        'Latest: Unit #${latestReport.vehicleUnitNumber}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark
                              ? AppColors.textPrimaryDark
                              : AppColors.textPrimaryLight,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: latestReport.status.color
                              .withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
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

              const SizedBox(height: 14),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        final defectBloc = context.read<DefectBloc>();
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => BlocProvider.value(
                              value: defectBloc,
                              child: DefectHistoryPage(
                                driverId: driverId,
                                driverName: driverName,
                                defaultVehicleUnit: defaultVehicleUnit,
                                fleetVehicles: fleetVehicles,
                              ),
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.history, size: 16),
                      label: const Text(
                        'History',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 42),
                        side: BorderSide(
                          color: isDark
                              ? AppColors.darkCardBorder
                              : AppColors.lightCardBorder,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        final defectBloc = context.read<DefectBloc>();
                        final res = await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => BlocProvider.value(
                              value: defectBloc,
                              child: CreateDefectReportPage(
                                defaultVehicleUnit: defaultVehicleUnit,
                                driverId: driverId,
                                driverName: driverName,
                                fleetVehicles: fleetVehicles,
                              ),
                            ),
                          ),
                        );
                        if (res == true && context.mounted) {
                          context.read<DefectBloc>().add(
                                LoadDefects(driverId: driverId),
                              );
                        }
                      },
                      icon: const Icon(Icons.warning_amber_rounded, size: 16),
                      label: const Text(
                        'Report Defect',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: const Color(0xFF0F172A),
                        minimumSize: const Size(0, 42),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
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

  Widget _buildMetricTile(
    String label,
    String value,
    Color bgColor,
    Color textColor,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: textColor.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}
