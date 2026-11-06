import 'package:flutter/material.dart';
import '../../../../core/theme.dart';

class ExpenseEmptyState extends StatelessWidget {
  final String selectedFilter;

  const ExpenseEmptyState({
    super.key,
    required this.selectedFilter,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
        child: Column(
          children: [
            Icon(
              Icons.receipt_long_outlined,
              size: 64,
              color: (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)
                  .withValues(alpha: 0.4),
            ),
            const SizedBox(height: 16),
            Text(
              selectedFilter == 'all'
                  ? 'No expense claims submitted yet'
                  : 'No $selectedFilter expense claims',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              'Tap "New Claim" to submit gas, tolls, maintenance, or other work expenses.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
