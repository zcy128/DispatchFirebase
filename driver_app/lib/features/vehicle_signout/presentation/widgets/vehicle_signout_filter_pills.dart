import 'package:flutter/material.dart';
import '../../../../core/theme.dart';

/// Horizontally scrollable status filter pills for Vehicle Handover records.
class VehicleSignoutFilterPills extends StatelessWidget {
  final String selectedFilter;
  final ValueChanged<String> onFilterSelected;

  static const List<String> filters = ['All', 'Signed Out', 'Signed In'];

  const VehicleSignoutFilterPills({
    super.key,
    required this.selectedFilter,
    required this.onFilterSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: filters.map((filter) {
          final isSelected = selectedFilter == filter;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: () => onFilterSelected(filter),
              borderRadius: BorderRadius.circular(20),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? AppColors.primary : Colors.grey[700]!,
                  ),
                ),
                child: Text(
                  filter,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? const Color(0xFF0F172A) : Colors.grey[400],
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
