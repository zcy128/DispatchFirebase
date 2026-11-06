import 'package:flutter/material.dart';
import '../../../../core/theme.dart';

class HazardFilterPills extends StatelessWidget {
  final int selectedFilter;
  final ValueChanged<int> onFilterSelected;

  const HazardFilterPills({
    super.key,
    required this.selectedFilter,
    required this.onFilterSelected,
  });

  static const List<Map<String, dynamic>> _filters = [
    {'label': 'All', 'value': -1},
    {'label': 'Open', 'value': 0},
    {'label': 'Investigating', 'value': 1},
    {'label': 'Resolved', 'value': 2},
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: isDark ? AppColors.darkCard : Colors.white,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _filters.map((f) {
            final filterValue = f['value'] as int;
            final label = f['label'] as String;
            final isSelected = selectedFilter == filterValue;

            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(label),
                selected: isSelected,
                onSelected: (_) => onFilterSelected(filterValue),
                selectedColor: const Color(0xFFD97706).withValues(alpha: 0.18),
                labelStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? const Color(0xFFD97706) : null,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
