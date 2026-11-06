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
import 'widgets/hazard_empty_state.dart';
import 'widgets/hazard_filter_pills.dart';
import 'widgets/hazard_report_card.dart';

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

  void _openCreatePage() {
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
  }

  void _openDetailPage(HazardReportModel item) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => HazardReportDetailPage(report: item),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
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
        onPressed: _openCreatePage,
      ),
      body: Column(
        children: [
          // Filter Pills Bar
          HazardFilterPills(
            selectedFilter: _selectedFilter,
            onFilterSelected: (newFilter) {
              setState(() {
                _selectedFilter = newFilter;
              });
            },
          ),
          const Divider(height: 1),

          // Reports List
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
                  return HazardEmptyState(selectedFilter: _selectedFilter);
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
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 12),
                    itemBuilder: (context, idx) {
                      final item = filtered[idx];
                      return HazardReportCard(
                        item: item,
                        onTap: () => _openDetailPage(item),
                      );
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
}
