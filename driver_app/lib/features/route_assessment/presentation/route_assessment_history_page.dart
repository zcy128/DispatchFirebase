import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/route_assessment_bloc.dart';
import '../bloc/route_assessment_event.dart';
import '../bloc/route_assessment_state.dart';
import '../models/route_assessment_model.dart';
import '../repository/route_assessment_repository.dart';
import 'route_assessment_detail_page.dart';
import 'route_assessment_form_page.dart';
import 'widgets/route_assessment_card.dart';
import 'widgets/route_assessment_empty_state.dart';
import 'widgets/route_assessment_filter_pills.dart';

class RouteAssessmentHistoryPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String? defaultRouteId;
  final String? defaultSchoolName;
  final String? defaultSchoolBoard;

  const RouteAssessmentHistoryPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteId,
    this.defaultSchoolName,
    this.defaultSchoolBoard,
  });

  @override
  Widget build(BuildContext context) {
    RouteAssessmentBloc? existingBloc;
    try {
      existingBloc = context.read<RouteAssessmentBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _RouteAssessmentHistoryView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteId: defaultRouteId,
      defaultSchoolName: defaultSchoolName,
      defaultSchoolBoard: defaultSchoolBoard,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<RouteAssessmentBloc>(
      create: (ctx) => RouteAssessmentBloc(
        repository: ctx.read<RouteAssessmentRepository>(),
      )..add(LoadRouteAssessments(employeeId: driverId)),
      child: view,
    );
  }
}

class _RouteAssessmentHistoryView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String? defaultRouteId;
  final String? defaultSchoolName;
  final String? defaultSchoolBoard;

  const _RouteAssessmentHistoryView({
    required this.driverId,
    required this.driverName,
    this.defaultRouteId,
    this.defaultSchoolName,
    this.defaultSchoolBoard,
  });

  @override
  State<_RouteAssessmentHistoryView> createState() => _RouteAssessmentHistoryViewState();
}

class _RouteAssessmentHistoryViewState extends State<_RouteAssessmentHistoryView> {
  RouteAssessmentStatus? _selectedStatus; // null means 'all'

  @override
  void initState() {
    super.initState();
    context.read<RouteAssessmentBloc>().add(LoadRouteAssessments(employeeId: widget.driverId));
  }

  void _openCreatePage() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => BlocProvider.value(
          value: context.read<RouteAssessmentBloc>(),
          child: RouteAssessmentFormPage(
            driverId: widget.driverId,
            driverName: widget.driverName,
            defaultRouteId: widget.defaultRouteId,
            defaultSchoolName: widget.defaultSchoolName,
            defaultSchoolBoard: widget.defaultSchoolBoard,
          ),
        ),
      ),
    );
  }

  void _openDetailPage(RouteAssessmentModel item) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RouteAssessmentDetailPage(assessment: item),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Route Assessments'),
        centerTitle: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreatePage,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Assessment'),
      ),
      body: Column(
        children: [
          // Filter Tabs
          RouteAssessmentFilterPills(
            selectedStatus: _selectedStatus,
            onStatusSelected: (newStatus) {
              setState(() {
                _selectedStatus = newStatus;
              });
            },
          ),
          const Divider(height: 1),

          Expanded(
            child: BlocBuilder<RouteAssessmentBloc, RouteAssessmentState>(
              builder: (context, state) {
                if (state is RouteAssessmentLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (state is RouteAssessmentError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                          const SizedBox(height: 12),
                          Text(state.message, textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () {
                              context.read<RouteAssessmentBloc>().add(
                                    LoadRouteAssessments(employeeId: widget.driverId),
                                  );
                            },
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                final assessments = state is RouteAssessmentLoaded ? state.assessments : <RouteAssessmentModel>[];
                final filtered = _selectedStatus == null
                    ? assessments
                    : assessments.where((a) => a.status == _selectedStatus).toList();

                if (filtered.isEmpty) {
                  return const RouteAssessmentEmptyState();
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    context.read<RouteAssessmentBloc>().add(
                          LoadRouteAssessments(employeeId: widget.driverId),
                        );
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                    itemCount: filtered.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 10),
                    itemBuilder: (context, idx) {
                      final item = filtered[idx];
                      return RouteAssessmentCard(
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
