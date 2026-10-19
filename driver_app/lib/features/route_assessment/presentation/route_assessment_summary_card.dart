import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/route_assessment_bloc.dart';
import '../bloc/route_assessment_state.dart';
import 'route_assessment_form_page.dart';
import 'route_assessment_history_page.dart';

class RouteAssessmentSummaryCard extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String? defaultRouteId;

  const RouteAssessmentSummaryCard({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultRouteId,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Card(
      elevation: 0,
      color: isDark ? Colors.grey[900] : Colors.grey[50],
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.assignment_turned_in_outlined,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Route Safety Assessment',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Text(
                        'Dry-run checklist & change in route evaluation',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            BlocBuilder<RouteAssessmentBloc, RouteAssessmentState>(
              builder: (context, state) {
                final total = state is RouteAssessmentLoaded ? state.assessments.length : 0;
                final working = state is RouteAssessmentLoaded ? state.workingCount : 0;
                final completed = state is RouteAssessmentLoaded ? state.completedCount : 0;

                return Row(
                  children: [
                    _buildStatCol('Total', '$total', isDark),
                    _buildStatCol('Working', '$working', isDark, color: Colors.amber[800]),
                    _buildStatCol('Completed', '$completed', isDark, color: Colors.green),
                  ],
                );
              },
            ),
            const SizedBox(height: 14),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (ctx) => BlocProvider.value(
                            value: context.read<RouteAssessmentBloc>(),
                            child: RouteAssessmentHistoryPage(
                              driverId: driverId,
                              driverName: driverName,
                              defaultRouteId: defaultRouteId,
                            ),
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.history, size: 16),
                    label: const Text('View All', style: TextStyle(fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (ctx) => BlocProvider.value(
                            value: context.read<RouteAssessmentBloc>(),
                            child: RouteAssessmentFormPage(
                              driverId: driverId,
                              driverName: driverName,
                              defaultRouteId: defaultRouteId,
                            ),
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.add_task, size: 16),
                    label: const Text('New Checklist', style: TextStyle(fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCol(String label, String value, bool isDark, {Color? color}) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color ?? (isDark ? Colors.white : Colors.black),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }
}
