import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/defect_bloc.dart';
import '../bloc/defect_event.dart';
import '../bloc/defect_state.dart';
import '../models/defect_model.dart';
import '../repository/defect_repository.dart';
import 'create_defect_report_page.dart';

class DefectHistoryPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultVehicleUnit;
  final List<String> fleetVehicles;

  const DefectHistoryPage({
    super.key,
    required this.driverId,
    required this.driverName,
    required this.defaultVehicleUnit,
    this.fleetVehicles = const [],
  });

  @override
  Widget build(BuildContext context) {
    DefectBloc? existingBloc;
    try {
      existingBloc = context.read<DefectBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _DefectHistoryView(
      driverId: driverId,
      driverName: driverName,
      defaultVehicleUnit: defaultVehicleUnit,
      fleetVehicles: fleetVehicles,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<DefectBloc>(
      create: (ctx) => DefectBloc(
        repository: ctx.read<DefectRepository>(),
      )..add(WatchDefectsStarted(driverId: driverId)),
      child: view,
    );
  }
}

class _DefectHistoryView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String defaultVehicleUnit;
  final List<String> fleetVehicles;

  const _DefectHistoryView({
    required this.driverId,
    required this.driverName,
    required this.defaultVehicleUnit,
    this.fleetVehicles = const [],
  });

  @override
  State<_DefectHistoryView> createState() => _DefectHistoryViewState();
}

class _DefectHistoryViewState extends State<_DefectHistoryView> {
  DefectReportStatus? _filterStatus;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  void _refresh() {
    context.read<DefectBloc>().add(
          WatchDefectsStarted(
            driverId: widget.driverId,
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary =
        isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight;
    final textSecondary =
        isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;
    final cardBg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final cardBorder =
        isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Vehicle Defect History',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final defectBloc = context.read<DefectBloc>();
          final res = await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => BlocProvider.value(
                value: defectBloc,
                child: CreateDefectReportPage(
                  defaultVehicleUnit: widget.defaultVehicleUnit,
                  driverId: widget.driverId,
                  driverName: widget.driverName,
                  fleetVehicles: widget.fleetVehicles,
                ),
              ),
            ),
          );
          if (res == true && mounted) {
            _refresh();
          }
        },
        backgroundColor: AppColors.primary,
        foregroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.add_alert_rounded),
        label: const Text(
          'Report Defect',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                _buildFilterChip('All', null, isDark),
                const SizedBox(width: 8),
                _buildFilterChip('Submitted', DefectReportStatus.submitted, isDark),
                const SizedBox(width: 8),
                _buildFilterChip(
                    'Under Assessment', DefectReportStatus.underAssessment, isDark),
                const SizedBox(width: 8),
                _buildFilterChip(
                    'Under Repair', DefectReportStatus.underRepair, isDark),
                const SizedBox(width: 8),
                _buildFilterChip('Resolved', DefectReportStatus.resolved, isDark),
              ],
            ),
          ),

          // Reports List
          Expanded(
            child: BlocBuilder<DefectBloc, DefectState>(
              builder: (context, state) {
                if (state is DefectLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (state is DefectError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline,
                              size: 48, color: AppColors.error),
                          const SizedBox(height: 12),
                          Text(
                            state.message,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: textSecondary),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: _refresh,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                List<VehicleDefectReport> reports = [];
                if (state is DefectLoaded) {
                  reports = state.reports;
                }

                if (_filterStatus != null) {
                  reports =
                      reports.where((r) => r.status == _filterStatus).toList();
                }

                if (reports.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.assignment_turned_in_outlined,
                            size: 64,
                            color: textSecondary.withValues(alpha: 0.5),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'No defect reports found.',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: textPrimary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Any reported vehicle defects and fleet repairs will appear here.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: textSecondary),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return ListView.separated(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8)
                          .copyWith(bottom: 80),
                  itemCount: reports.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 10),
                  itemBuilder: (context, idx) {
                    final report = reports[idx];
                    return _buildReportCard(
                      report,
                      isDark,
                      cardBg,
                      cardBorder,
                      textPrimary,
                      textSecondary,
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(
      String label, DefectReportStatus? status, bool isDark) {
    final isSelected = _filterStatus == status;
    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) {
        setState(() => _filterStatus = status);
      },
      selectedColor: AppColors.primary.withValues(alpha: isDark ? 0.3 : 0.2),
      checkmarkColor: AppColors.primary,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
        color: isSelected
            ? AppColors.primary
            : (isDark
                ? AppColors.textSecondaryDark
                : AppColors.textSecondaryLight),
      ),
    );
  }

  Widget _buildReportCard(
    VehicleDefectReport report,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    final defectItems = report.items
        .where((i) => i.status == DefectItemStatus.defect)
        .toList();
    final hasDefects = defectItems.isNotEmpty;

    return Card(
      color: cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: hasDefects
              ? report.status.color.withValues(alpha: 0.4)
              : cardBorder,
        ),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: report.status.color.withValues(alpha: isDark ? 0.2 : 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            hasDefects ? Icons.build_rounded : Icons.check_circle_outline,
            color: report.status.color,
            size: 22,
          ),
        ),
        title: Row(
          children: [
            Text(
              'Unit #${report.vehicleUnitNumber}',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 15,
                color: textPrimary,
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: report.status.color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: report.status.color.withValues(alpha: 0.5),
                ),
              ),
              child: Text(
                report.status.label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: report.status.color,
                ),
              ),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4.0),
          child: Row(
            children: [
              Text(
                '${report.reportDate} ${report.reportTime}',
                style: TextStyle(fontSize: 12, color: textSecondary),
              ),
              const SizedBox(width: 8),
              Text('•', style: TextStyle(color: textSecondary)),
              const SizedBox(width: 8),
              Text(
                hasDefects
                    ? '${defectItems.length} Defect${defectItems.length > 1 ? 's' : ''}'
                    : 'Clean Pass',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: hasDefects ? AppColors.error : AppColors.success,
                ),
              ),
            ],
          ),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Divider(),
                // Basic info
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Odometer: ${report.odometer} km',
                        style: TextStyle(fontSize: 12, color: textSecondary)),
                    Text('Reported By: ${report.reportedByName}',
                        style: TextStyle(fontSize: 12, color: textSecondary)),
                  ],
                ),
                if (report.defectNotes.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Notes: ${report.defectNotes}',
                    style: TextStyle(
                      fontSize: 13,
                      fontStyle: FontStyle.italic,
                      color: textPrimary,
                    ),
                  ),
                ],

                // Flagged Defect Items
                if (defectItems.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    'FLAGGED DEFECT ITEMS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      color: AppColors.error,
                    ),
                  ),
                  const SizedBox(height: 6),
                  ...defectItems.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 4.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.circle,
                                size: 8, color: AppColors.error),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${item.name}${item.notes.isNotEmpty ? ' (${item.notes})' : ''}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )),
                ],

                // Fleet Assessment / Repair Info
                if (report.assessment != null &&
                    report.assessment!.assessedBy.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF1E293B)
                          : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isDark
                            ? const Color(0xFF334155)
                            : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.engineering_rounded,
                                size: 16, color: AppColors.primary),
                            const SizedBox(width: 6),
                            const Text(
                              'FLEET ASSESSMENT & REPAIR',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.8,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        if (report.assessment!.repairLocation.isNotEmpty)
                          Text(
                            'Repair Location: ${report.assessment!.repairLocation}',
                            style: TextStyle(fontSize: 12, color: textPrimary),
                          ),
                        if (report.assessment!.estimatedRepairDays > 0)
                          Text(
                            'Estimated Days: ${report.assessment!.estimatedRepairDays} (Est. Completion: ${report.assessment!.estimatedCompletionDate})',
                            style: TextStyle(fontSize: 12, color: textPrimary),
                          ),
                        if (report.assessment!.assessmentNotes.isNotEmpty)
                          Text(
                            'Assessment Notes: ${report.assessment!.assessmentNotes}',
                            style: TextStyle(fontSize: 12, color: textSecondary),
                          ),
                        if (report.assessment!.mechanicNotes.isNotEmpty)
                          Text(
                            'Mechanic Notes: ${report.assessment!.mechanicNotes}',
                            style: TextStyle(fontSize: 12, color: textSecondary),
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
