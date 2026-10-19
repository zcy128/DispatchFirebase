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

class RouteAssessmentHistoryPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String? defaultRouteId;

  const RouteAssessmentHistoryPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteId,
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

  const _RouteAssessmentHistoryView({
    required this.driverId,
    required this.driverName,
    this.defaultRouteId,
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Route Assessments'),
        centerTitle: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (ctx) => BlocProvider.value(
                value: context.read<RouteAssessmentBloc>(),
                child: RouteAssessmentFormPage(
                  driverId: widget.driverId,
                  driverName: widget.driverName,
                  defaultRouteId: widget.defaultRouteId,
                ),
              ),
            ),
          );
        },
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Assessment'),
      ),
      body: Column(
        children: [
          // Filter Tabs
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _buildFilterChip('All', null),
                const SizedBox(width: 8),
                _buildFilterChip('Working', RouteAssessmentStatus.working),
                const SizedBox(width: 8),
                _buildFilterChip('Completed', RouteAssessmentStatus.completed),
                const SizedBox(width: 8),
                _buildFilterChip('Submitted', RouteAssessmentStatus.submitted),
              ],
            ),
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
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.assignment_outlined, size: 56, color: Colors.grey[400]),
                        const SizedBox(height: 12),
                        Text(
                          'No route assessments found',
                          style: TextStyle(fontSize: 15, color: Colors.grey[600]),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Tap "+ New Assessment" to conduct your route safety checklist.',
                          style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                        ),
                      ],
                    ),
                  );
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
                      return _buildCard(item, isDark);
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

  Widget _buildFilterChip(String label, RouteAssessmentStatus? status) {
    final selected = _selectedStatus == status;
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) {
        setState(() {
          _selectedStatus = status;
        });
      },
      selectedColor: AppColors.primary.withValues(alpha: 0.2),
      checkmarkColor: AppColors.primary,
    );
  }

  Widget _buildCard(RouteAssessmentModel item, bool isDark) {
    final risks = item.flaggedConcernsCount;

    return Card(
      elevation: 0,
      color: isDark ? Colors.grey[900] : Colors.grey[50],
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => RouteAssessmentDetailPage(assessment: item),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: item.assessmentType == '0'
                          ? Colors.blue.withValues(alpha: 0.12)
                          : Colors.purple.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      item.typeLabel,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: item.assessmentType == '0' ? Colors.blue : Colors.purple,
                      ),
                    ),
                  ),
                  _buildStatusBadge(item.status),
                ],
              ),
              const SizedBox(height: 8),

              Text(
                item.routeId,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
              ),
              const SizedBox(height: 4),

              Text(
                '${item.school ?? "School"} • ${item.schoolYear}',
                style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey[600]),
              ),

              if (item.summary != null && item.summary!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  item.summary!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[300] : Colors.grey[700]),
                ),
              ],

              const Divider(height: 16),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    item.assessmentDate != null
                        ? item.assessmentDate!.toLocal().toString().split(' ')[0]
                        : item.createdAt.toLocal().toString().split(' ')[0],
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  Row(
                    children: [
                      if (risks > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, size: 12, color: Colors.red),
                              const SizedBox(width: 3),
                              Text(
                                '$risks Risk${risks > 1 ? "s" : ""}',
                                style: const TextStyle(fontSize: 10, color: Colors.red, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Clear',
                            style: TextStyle(fontSize: 10, color: Colors.green, fontWeight: FontWeight.bold),
                          ),
                        ),
                      if (item.attachmentUrls.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Icon(Icons.attach_file, size: 14, color: Colors.grey[500]),
                        Text(
                          '${item.attachmentUrls.length}',
                          style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(RouteAssessmentStatus status) {
    Color color;
    IconData icon;
    switch (status) {
      case RouteAssessmentStatus.submitted:
        color = Colors.blue;
        icon = Icons.send;
        break;
      case RouteAssessmentStatus.completed:
        color = Colors.green;
        icon = Icons.check_circle;
        break;
      case RouteAssessmentStatus.working:
        color = Colors.amber[800]!;
        icon = Icons.access_time;
        break;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 4),
        Text(status.label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
