import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/hazard_report_bloc.dart';
import '../bloc/hazard_report_event.dart';
import '../bloc/hazard_report_state.dart';
import '../models/hazard_report_model.dart';
import '../repository/hazard_report_repository.dart';
import 'hazard_report_detail_page.dart';
import 'hazard_report_form_page.dart';

class HazardReportHistoryPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultVehicleUnit;

  const HazardReportHistoryPage({
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

    final view = _HazardReportHistoryView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteNo: defaultRouteNo,
      defaultVehicleUnit: defaultVehicleUnit,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<HazardReportBloc>(
      create: (ctx) => HazardReportBloc(
        repository: ctx.read<HazardReportRepository>(),
      )..add(LoadHazardReports(employeeId: driverId)),
      child: view,
    );
  }
}

class _HazardReportHistoryView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultVehicleUnit;

  const _HazardReportHistoryView({
    required this.driverId,
    required this.driverName,
    required this.defaultRouteNo,
    required this.defaultVehicleUnit,
  });

  @override
  State<_HazardReportHistoryView> createState() =>
      _HazardReportHistoryViewState();
}

class _HazardReportHistoryViewState extends State<_HazardReportHistoryView> {
  int _selectedFilter = -1; // -1: All, 0: Open, 1: Investigating, 2: Resolved

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Hazard & Safety Reports',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.sync_rounded),
            onPressed: () {
              context
                  .read<HazardReportBloc>()
                  .add(LoadHazardReports(employeeId: widget.driverId));
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFD97706),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text(
          'Report Hazard',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (ctx) => BlocProvider.value(
                value: context.read<HazardReportBloc>(),
                child: HazardReportFormPage(
                  driverId: widget.driverId,
                  driverName: widget.driverName,
                  defaultRouteNo: widget.defaultRouteNo,
                  defaultVehicleUnit: widget.defaultVehicleUnit,
                ),
              ),
            ),
          );
        },
      ),
      body: Column(
        children: [
          // ─── Filter Pills Bar ───────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: isDark ? AppColors.darkCard : Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('All', -1),
                  const SizedBox(width: 8),
                  _buildFilterChip('Open', 0),
                  const SizedBox(width: 8),
                  _buildFilterChip('Investigating', 1),
                  const SizedBox(width: 8),
                  _buildFilterChip('Resolved', 2),
                ],
              ),
            ),
          ),
          const Divider(height: 1),

          // ─── Reports List ───────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<HazardReportBloc, HazardReportState>(
              builder: (context, state) {
                if (state is HazardReportLoading &&
                    (state is! HazardReportLoaded)) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (state is HazardReportFailure) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline_rounded,
                              size: 48, color: AppColors.error),
                          const SizedBox(height: 12),
                          Text(
                            state.error,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 13),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () {
                              context.read<HazardReportBloc>().add(
                                  LoadHazardReports(employeeId: widget.driverId));
                            },
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                final reports = state is HazardReportLoaded
                    ? state.reports
                    : <HazardReportModel>[];

                final filtered = reports.where((r) {
                  if (_selectedFilter == -1) return true;
                  return r.statusInt == _selectedFilter;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.check_circle_outline_rounded,
                            size: 56,
                            color: Colors.grey.shade400,
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'No hazard reports found',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _selectedFilter == -1
                                ? 'Tap the button below to report a safety hazard or close call.'
                                : 'No reports matching the selected status.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppColors.textSecondaryDark
                                  : AppColors.textSecondaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    context
                        .read<HazardReportBloc>()
                        .add(LoadHazardReports(employeeId: widget.driverId));
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                    itemCount: filtered.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 12),
                    itemBuilder: (context, idx) {
                      final item = filtered[idx];
                      return _buildReportCard(item, isDark);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, int filterValue) {
    final selected = _selectedFilter == filterValue;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) {
        setState(() {
          _selectedFilter = filterValue;
        });
      },
      selectedColor: const Color(0xFFD97706).withValues(alpha: 0.18),
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: selected ? FontWeight.bold : FontWeight.normal,
        color: selected ? const Color(0xFFD97706) : null,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
      ),
    );
  }

  Widget _buildReportCard(HazardReportModel item, bool isDark) {
    final status = item.status;
    final idSnippet =
        item.id.length > 6 ? item.id.substring(item.id.length - 6) : item.id;

    return InkWell(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => HazardReportDetailPage(report: item),
          ),
        );
      },
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCard : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: ID / Date & Status Pill
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD97706).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.warning_amber_rounded,
                          size: 16,
                          color: Color(0xFFD97706),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '#$idSnippet',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        item.eventTime != null && item.eventTime!.length >= 10
                            ? item.eventTime!.substring(0, 10)
                            : item.createdAt.toIso8601String().substring(0, 10),
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark
                              ? AppColors.textSecondaryDark
                              : AppColors.textSecondaryLight,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: status.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: status.color.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(status.icon, size: 12, color: status.color),
                      const SizedBox(width: 4),
                      Text(
                        status.label,
                        style: TextStyle(
                          fontSize: 10,
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

            // Row 2: Location
            if (item.eventLocation != null && item.eventLocation!.isNotEmpty) ...[
              Row(
                children: [
                  const Icon(Icons.pin_drop_rounded, size: 14, color: Colors.red),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      item.eventLocation!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
            ],

            // Row 3: Description snippet
            Text(
              item.eventDescription,
              style: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),

            // Row 4: Chips & Photo count
            Row(
              children: [
                if (item.activeHazardLabels.isNotEmpty)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      item.activeHazardLabels.first,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                if (item.activeHazardLabels.length > 1) ...[
                  const SizedBox(width: 4),
                  Text(
                    '+${item.activeHazardLabels.length - 1} more',
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ],
                const Spacer(),
                if (item.attachmentUrls.isNotEmpty) ...[
                  const Icon(Icons.attach_file_rounded, size: 14, color: Colors.grey),
                  const SizedBox(width: 2),
                  Text(
                    '${item.attachmentUrls.length}',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  const SizedBox(width: 8),
                ],
                const Icon(Icons.arrow_forward_ios_rounded,
                    size: 12, color: Colors.grey),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
