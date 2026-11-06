import 'package:flutter/material.dart';

/// Empty state placeholder when contact search or department filter returns no items.
class CompanyContactEmptyState extends StatelessWidget {
  final bool hasQuery;

  const CompanyContactEmptyState({
    super.key,
    this.hasQuery = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.contact_phone_outlined,
              size: 48,
              color: isDark ? Colors.grey.shade700 : Colors.grey.shade400,
            ),
            const SizedBox(height: 12),
            Text(
              hasQuery ? 'No matching contacts found' : 'No company contacts available',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text(
              hasQuery
                  ? 'Try searching with different keywords or switch department filter.'
                  : 'Emergency contacts will appear here once configured.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
