import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/student_incident_bloc.dart';
import '../bloc/student_incident_event.dart';
import '../bloc/student_incident_state.dart';
import '../models/student_incident_model.dart';
import 'create_student_incident_page.dart';
import 'student_incident_history_page.dart';

class StudentIncidentSummaryCard extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String defaultRouteNo;
  final String defaultRouteName;

  const StudentIncidentSummaryCard({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteNo = '',
    this.defaultRouteName = '',
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary =
        isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;

    return BlocBuilder<StudentIncidentBloc, StudentIncidentState>(
      builder: (context, state) {
        int totalReports = 0;
        int pendingReview = 0;
        int closedCount = 0;
        StudentIncident? latestIncident;

        if (state is StudentIncidentLoaded) {
          totalReports = state.reports.length;
          pendingReview = state.pendingReviewCount;
          closedCount = state.reports
              .where((r) => r.status == StudentIncidentStatus.closed)
              .length;
          if (state.reports.isNotEmpty) {
            latestIncident = state.reports.first;
          }
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
                color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ─── Header: Icon + Title + Count Badge ──────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD97706).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
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
                          'Student Incidents & Safety',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Driver behavior reports & office follow-ups',
                          style: TextStyle(
                            fontSize: 12,
                            color: textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (pendingReview > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.amber.shade700.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Text(
                        '$pendingReview Under Review',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade800,
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 14),

              // ─── KPI Chips Row ──────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Total Filed',
                      value: '$totalReports',
                      color: Colors.blueGrey,
                      isDark: isDark,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Pending Office',
                      value: '$pendingReview',
                      color: pendingReview > 0
                          ? const Color(0xFFD97706)
                          : const Color(0xFF059669),
                      isDark: isDark,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildMetricTile(
                      label: 'Closed',
                      value: '$closedCount',
                      color: const Color(0xFF059669),
                      isDark: isDark,
                    ),
                  ),
                ],
              ),

              // ─── Latest Incident Snippet ─────────────────────────────────
              if (latestIncident != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[850] : Colors.grey[100],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        size: 16,
                        color: latestIncident.status.color,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Latest: ${latestIncident.studentName} (${latestIncident.incidentDate}) - ${latestIncident.status.label}',
                          style: const TextStyle(fontSize: 12),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 14),

              // ─── Action Buttons ──────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        StudentIncidentBloc? bloc;
                        try {
                          bloc = context.read<StudentIncidentBloc>();
                        } catch (_) {
                          bloc = null;
                        }

                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (ctx) {
                              if (bloc != null) {
                                return BlocProvider<StudentIncidentBloc>.value(
                                  value: bloc,
                                  child: StudentIncidentHistoryPage(
                                    driverId: driverId,
                                    driverName: driverName,
                                    defaultRouteNo: defaultRouteNo,
                                    defaultRouteName: defaultRouteName,
                                  ),
                                );
                              }
                              return StudentIncidentHistoryPage(
                                driverId: driverId,
                                driverName: driverName,
                                defaultRouteNo: defaultRouteNo,
                                defaultRouteName: defaultRouteName,
                              );
                            },
                          ),
                        );
                      },
                      icon: const Icon(Icons.history, size: 16),
                      label: const Text('View History'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        StudentIncidentBloc? bloc;
                        try {
                          bloc = context.read<StudentIncidentBloc>();
                        } catch (_) {
                          bloc = null;
                        }

                        Navigator.of(context)
                            .push<bool>(
                          MaterialPageRoute(
                            builder: (ctx) {
                              if (bloc != null) {
                                return BlocProvider<StudentIncidentBloc>.value(
                                  value: bloc,
                                  child: CreateStudentIncidentPage(
                                    driverId: driverId,
                                    driverName: driverName,
                                    defaultRouteNo: defaultRouteNo,
                                    defaultRouteName: defaultRouteName,
                                  ),
                                );
                              }
                              return CreateStudentIncidentPage(
                                driverId: driverId,
                                driverName: driverName,
                                defaultRouteNo: defaultRouteNo,
                                defaultRouteName: defaultRouteName,
                              );
                            },
                          ),
                        )
                            .then((created) {
                          if (created == true && context.mounted) {
                            context.read<StudentIncidentBloc>().add(
                                  LoadStudentIncidents(driverId: driverId),
                                );
                          }
                        });
                      },
                      icon: const Icon(Icons.add_circle_outline, size: 16),
                      label: const Text('Report Incident'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
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

  Widget _buildMetricTile({
    required String label,
    required String value,
    required Color color,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
