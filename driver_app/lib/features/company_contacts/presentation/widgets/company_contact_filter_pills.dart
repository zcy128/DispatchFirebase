import 'package:flutter/material.dart';
import '../../../../core/theme.dart';

/// Horizontally scrollable department filter chips for the Company Contacts directory.
class CompanyContactFilterPills extends StatelessWidget {
  final List<String> departments;
  final String selectedDepartment;
  final ValueChanged<String> onDepartmentSelected;

  const CompanyContactFilterPills({
    super.key,
    required this.departments,
    required this.selectedDepartment,
    required this.onDepartmentSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: departments.map((dept) {
          final isSelected = selectedDepartment.toLowerCase() == dept.toLowerCase();
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: FilterChip(
              label: Text(dept, style: const TextStyle(fontSize: 11)),
              selected: isSelected,
              onSelected: (_) => onDepartmentSelected(dept),
              selectedColor: AppColors.primary.withValues(alpha: 0.25),
              checkmarkColor: AppColors.primary,
              labelStyle: TextStyle(
                color: isSelected
                    ? AppColors.primary
                    : (isDark ? Colors.white70 : Colors.black87),
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              visualDensity: VisualDensity.compact,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          );
        }).toList(),
      ),
    );
  }
}
