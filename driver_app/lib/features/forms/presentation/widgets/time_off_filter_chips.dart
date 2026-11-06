import 'package:flutter/material.dart';
import '../../../../core/theme.dart';
import '../../models/time_off_model.dart';

class TimeOffFilterChips extends StatelessWidget {
  final TimeOffStatus? currentFilter;
  final int totalCount;
  final int pendingCount;
  final int approvedCount;
  final int rejectedCount;
  final ValueChanged<TimeOffStatus?> onFilterSelected;

  const TimeOffFilterChips({
    super.key,
    required this.currentFilter,
    required this.totalCount,
    required this.pendingCount,
    required this.approvedCount,
    required this.rejectedCount,
    required this.onFilterSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildChip(context, 'All', null, totalCount),
          _buildChip(context, 'Pending', TimeOffStatus.pending, pendingCount),
          _buildChip(context, 'Approved', TimeOffStatus.approved, approvedCount),
          _buildChip(context, 'Rejected', TimeOffStatus.rejected, rejectedCount),
        ],
      ),
    );
  }

  Widget _buildChip(BuildContext context, String label, TimeOffStatus? filterVal, int count) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isSelected = currentFilter == filterVal;

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        selected: isSelected,
        label: Text('$label ($count)'),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          color: isSelected
              ? Colors.black
              : (isDark ? Colors.white : Colors.black87),
        ),
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        selectedColor: AppColors.primary,
        checkmarkColor: Colors.black,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: isSelected
                ? AppColors.primary
                : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
          ),
        ),
        onSelected: (_) => onFilterSelected(filterVal),
      ),
    );
  }
}
