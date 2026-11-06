import 'package:flutter/material.dart';
import '../../../../core/theme.dart';

class ExpenseFilterChips extends StatelessWidget {
  final String selectedFilter;
  final ValueChanged<String> onFilterSelected;
  final Color brandColor;

  const ExpenseFilterChips({
    super.key,
    required this.selectedFilter,
    required this.onFilterSelected,
    this.brandColor = const Color(0xFF0D9488),
  });

  static const List<Map<String, String>> _filters = [
    {'key': 'all', 'label': 'All'},
    {'key': 'pending', 'label': 'Pending'},
    {'key': 'approved', 'label': 'Approved'},
    {'key': 'rejected', 'label': 'Rejected'},
    {'key': 'cancelled', 'label': 'Cancelled'},
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _filters.map((f) {
          final isSelected = selectedFilter == f['key'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(f['label']!),
              selected: isSelected,
              showCheckmark: false,
              selectedColor: brandColor,
              labelStyle: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected
                    ? Colors.white
                    : (isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight),
              ),
              backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected
                      ? brandColor
                      : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
                ),
              ),
              onSelected: (_) => onFilterSelected(f['key']!),
            ),
          );
        }).toList(),
      ),
    );
  }
}
