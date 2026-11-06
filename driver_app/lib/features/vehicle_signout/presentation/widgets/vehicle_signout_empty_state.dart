import 'package:flutter/material.dart';

/// Empty state placeholder when no handover records match current criteria.
class VehicleSignoutEmptyState extends StatelessWidget {
  final bool hasFilter;

  const VehicleSignoutEmptyState({
    super.key,
    this.hasFilter = false,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.assignment_turned_in_outlined,
              size: 48,
              color: Colors.grey,
            ),
            const SizedBox(height: 12),
            Text(
              hasFilter ? 'No matching handover records' : 'No handover records found',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Text(
              hasFilter
                  ? 'Try adjusting your search keywords or filter pills.'
                  : 'Completed vehicle handovers will appear here.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
