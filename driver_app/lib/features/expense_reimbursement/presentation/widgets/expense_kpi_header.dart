import 'package:flutter/material.dart';
import '../../../../core/theme.dart';

class ExpenseKpiHeader extends StatelessWidget {
  final int pendingCount;
  final int approvedCount;
  final double approvedTotal;
  final Color brandColor;

  const ExpenseKpiHeader({
    super.key,
    required this.pendingCount,
    required this.approvedCount,
    required this.approvedTotal,
    this.brandColor = const Color(0xFF0D9488),
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      children: [
        Expanded(
          child: _MetricTile(
            label: 'Pending',
            value: pendingCount.toString(),
            color: const Color(0xFFD97706),
            icon: Icons.hourglass_top_rounded,
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _MetricTile(
            label: 'Approved',
            value: approvedCount.toString(),
            color: AppColors.success,
            icon: Icons.check_circle_outline_rounded,
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _MetricTile(
            label: 'Reimbursed',
            value: '\$${approvedTotal.toStringAsFixed(0)}',
            color: brandColor,
            icon: Icons.payments_outlined,
            isDark: isDark,
          ),
        ),
      ],
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  final bool isDark;

  const _MetricTile({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }
}
