import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/student_incident_bloc.dart';
import '../bloc/student_incident_event.dart';
import '../bloc/student_incident_state.dart';
import '../models/student_incident_model.dart';
import '../repository/student_incident_repository.dart';
import 'create_student_incident_page.dart';

class StudentIncidentHistoryPage extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultRouteName;

  const StudentIncidentHistoryPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteNo = '',
    this.defaultRouteName = '',
  });

  @override
  Widget build(BuildContext context) {
    StudentIncidentBloc? existingBloc;
    try {
      existingBloc = context.read<StudentIncidentBloc>();
    } catch (_) {
      existingBloc = null;
    }

    final view = _StudentIncidentHistoryView(
      driverId: driverId,
      driverName: driverName,
      defaultRouteNo: defaultRouteNo,
      defaultRouteName: defaultRouteName,
    );

    if (existingBloc != null) {
      return view;
    }

    return BlocProvider<StudentIncidentBloc>(
      create: (ctx) => StudentIncidentBloc(
        repository: ctx.read<StudentIncidentRepository>(),
      )..add(LoadStudentIncidents(driverId: driverId)),
      child: view,
    );
  }
}

class _StudentIncidentHistoryView extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultRouteName;

  const _StudentIncidentHistoryView({
    required this.driverId,
    required this.driverName,
    required this.defaultRouteNo,
    required this.defaultRouteName,
  });

  @override
  State<_StudentIncidentHistoryView> createState() =>
      _StudentIncidentHistoryViewState();
}

class _StudentIncidentHistoryViewState
    extends State<_StudentIncidentHistoryView> {
  String _selectedFilter = 'all'; // 'all' | 'needs_review' | 'closed'

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context
          .read<StudentIncidentBloc>()
          .add(LoadStudentIncidents(driverId: widget.driverId));
    });
  }

  void _openCreatePage() {
    StudentIncidentBloc? incidentBloc;
    try {
      incidentBloc = context.read<StudentIncidentBloc>();
    } catch (_) {
      incidentBloc = null;
    }

    Navigator.of(context)
        .push<bool>(
      MaterialPageRoute(
        builder: (ctx) {
          if (incidentBloc != null) {
            return BlocProvider<StudentIncidentBloc>.value(
              value: incidentBloc,
              child: CreateStudentIncidentPage(
                driverId: widget.driverId,
                driverName: widget.driverName,
                defaultRouteNo: widget.defaultRouteNo,
                defaultRouteName: widget.defaultRouteName,
              ),
            );
          }
          return CreateStudentIncidentPage(
            driverId: widget.driverId,
            driverName: widget.driverName,
            defaultRouteNo: widget.defaultRouteNo,
            defaultRouteName: widget.defaultRouteName,
          );
        },
      ),
    )
        .then((created) {
      if (created == true && mounted) {
        context
            .read<StudentIncidentBloc>()
            .add(LoadStudentIncidents(driverId: widget.driverId));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Student Incident History'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Reports',
            onPressed: () {
              context
                  .read<StudentIncidentBloc>()
                  .add(LoadStudentIncidents(driverId: widget.driverId));
            },
          ),
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Report Incident',
            onPressed: _openCreatePage,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Bar
          _buildFilterBar(isDark),

          // List of Incidents
          Expanded(
            child: BlocBuilder<StudentIncidentBloc, StudentIncidentState>(
              builder: (context, state) {
                if (state is StudentIncidentLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (state is StudentIncidentOperationFailure) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline,
                              size: 48, color: Colors.redAccent),
                          const SizedBox(height: 12),
                          Text('Failed to load incident history:\n${state.error}',
                              textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () {
                              context.read<StudentIncidentBloc>().add(
                                  LoadStudentIncidents(
                                      driverId: widget.driverId));
                            },
                            icon: const Icon(Icons.refresh),
                            label: const Text('Try Again'),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                List<StudentIncident> items = [];
                if (state is StudentIncidentLoaded) {
                  items = state.reports;
                }

                // Apply local tab filter
                if (_selectedFilter == 'needs_review') {
                  items = items.where((r) => r.needsOfficeReview).toList();
                } else if (_selectedFilter == 'closed') {
                  items = items
                      .where((r) => r.status == StudentIncidentStatus.closed)
                      .toList();
                }

                if (items.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.shield_outlined,
                            size: 56,
                            color: isDark ? Colors.grey[600] : Colors.grey[400],
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'No Student Incidents Found',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _selectedFilter == 'all'
                                ? 'No incident reports filed by this driver yet.'
                                : 'No incident reports match this filter.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              color:
                                  isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            onPressed: _openCreatePage,
                            icon: const Icon(Icons.add_circle_outline),
                            label: const Text('Report New Incident'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
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
                        .read<StudentIncidentBloc>()
                        .add(LoadStudentIncidents(driverId: widget.driverId));
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, index) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final incident = items[index];
                      return _buildIncidentCard(incident, isDark);
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

  Widget _buildFilterBar(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[900] : Colors.grey[100],
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ),
      ),
      child: Row(
        children: [
          _buildFilterChip('all', 'All Reports'),
          const SizedBox(width: 8),
          _buildFilterChip('needs_review', 'Pending Office'),
          const SizedBox(width: 8),
          _buildFilterChip('closed', 'Closed'),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _selectedFilter == key;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (val) {
        if (val) setState(() => _selectedFilter = key);
      },
      selectedColor: const Color(0xFFD97706).withValues(alpha: 0.2),
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        color: isSelected ? const Color(0xFFD97706) : null,
      ),
    );
  }

  Widget _buildIncidentCard(StudentIncident incident, bool isDark) {
    final status = incident.status;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: status.color.withValues(alpha: 0.15),
          child: Icon(Icons.shield, color: status.color, size: 20),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                incident.studentName,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: status.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: status.color.withValues(alpha: 0.4)),
              ),
              child: Text(
                status.label,
                style: TextStyle(
                  color: status.color,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              '${incident.incidentDate} at ${incident.incidentTime} · Route ${incident.routeNo}',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
            if (incident.schoolName.isNotEmpty) ...[
              Text(
                incident.schoolName,
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ],
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                ...incident.incidentTypes.map((typeKey) {
                  final label =
                      IncidentCategoryConstants.categoryLabels[typeKey] ??
                          typeKey;
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.grey[800] : Colors.grey[200],
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      label,
                      style: const TextStyle(fontSize: 11),
                    ),
                  );
                }),
                if (incident.firstAidRequired)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'First Aid Required',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.redAccent,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                if (incident.studentRemovedFromBus)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'Removed from Bus',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.deepOrange,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Divider(),
                // Location & Description
                _buildDetailRow('Location', incident.location),
                const SizedBox(height: 6),
                _buildDetailRow('Description', incident.description),
                if (incident.otherStudentsInvolved.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  _buildDetailRow(
                      'Other Students', incident.otherStudentsInvolved),
                ],
                if (incident.witnesses.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  _buildDetailRow('Witnesses', incident.witnesses),
                ],
                if (incident.immediateActionTaken.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  _buildDetailRow(
                      'Immediate Action', incident.immediateActionTaken),
                ],
                if (incident.parentsNotified) ...[
                  const SizedBox(height: 6),
                  _buildDetailRow('Parents Notified',
                      incident.parentsNotificationDetail.isNotEmpty
                          ? incident.parentsNotificationDetail
                          : 'Yes'),
                ],

                // Office Review Section
                if (incident.officeFollowUp != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB).withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: const Color(0xFF2563EB).withValues(alpha: 0.25),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.admin_panel_settings,
                                size: 16, color: Color(0xFF2563EB)),
                            const SizedBox(width: 6),
                            const Text(
                              'Office Administrative Follow-up',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                            const Spacer(),
                            if (incident.officeFollowUp!.isOfficeLocked)
                              const Icon(Icons.lock,
                                  size: 14, color: Colors.grey),
                          ],
                        ),
                        const SizedBox(height: 6),
                        if (incident.officeFollowUp!.administratorName !=
                            null)
                          Text(
                            'Reviewed by: ${incident.officeFollowUp!.administratorName} (${incident.officeFollowUp!.reviewedDate ?? ''})',
                            style: const TextStyle(fontSize: 12),
                          ),
                        if (incident
                            .officeFollowUp!.disciplinaryActions.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Action: ${incident.officeFollowUp!.disciplinaryActions.map((d) => IncidentCategoryConstants.disciplinaryLabels[d] ?? d).join(', ')}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                        if (incident.officeFollowUp!.officeNotes != null &&
                            incident.officeFollowUp!.officeNotes!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Notes: ${incident.officeFollowUp!.officeNotes}',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ],
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

  Widget _buildDetailRow(String label, String value) {
    return RichText(
      text: TextSpan(
        style: TextStyle(
          fontSize: 13,
          color: Theme.of(context).textTheme.bodyMedium?.color,
        ),
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          TextSpan(text: value),
        ],
      ),
    );
  }
}
