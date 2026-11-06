import 'package:flutter/material.dart';
import '../../../../core/theme.dart';
import '../../models/route_assessment_model.dart';

class RouteAssessmentFilterPills extends StatelessWidget {
  final RouteAssessmentStatus? selectedStatus;
  final ValueChanged<RouteAssessmentStatus?> onStatusSelected;

  const RouteAssessmentFilterPills({
    super.key,
    required this.selectedStatus,
    required this.onStatusSelected,
  });

  static const List<Map<String, dynamic>> _filters = [
    {'label': 'All', 'status': null},
    {'label': 'Working', 'status': RouteAssessmentStatus.working},
    {'label': 'Completed', 'status': RouteAssessmentStatus.completed},
    {'label': 'Submitted', 'status': RouteAssessmentStatus.submitted},
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: _filters.map((f) {
          final status = f['status'] as RouteAssessmentStatus?;
          final label = f['label'] as String;
          final isSelected = selectedStatus == status;

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(label),
              selected: isSelected,
              onSelected: (_) => onStatusSelected(status),
              selectedColor: AppColors.primary.withValues(alpha: 0.2),
              checkmarkColor: AppColors.primary,
            ),
          );
        }).toList(),
      ),
    );
  }
}
