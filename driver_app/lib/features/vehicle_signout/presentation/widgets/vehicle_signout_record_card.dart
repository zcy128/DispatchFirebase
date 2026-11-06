import 'package:flutter/material.dart';
import '../../../../core/theme.dart';
import '../../models/vehicle_signout_model.dart';

/// Card component representing an individual Vehicle Handover (Sign-out / Sign-in) record.
class VehicleSignoutRecordCard extends StatelessWidget {
  final VehicleSignoutModel item;
  final VoidCallback onTap;

  const VehicleSignoutRecordCard({
    super.key,
    required this.item,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[900] : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: Status Badge, Unit Number & Sign Date
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: item.isSignIn
                        ? Colors.green.withValues(alpha: 0.15)
                        : Colors.blue.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.isSignIn ? 'SIGN IN' : 'SIGN OUT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: item.isSignIn ? Colors.green : Colors.blue[400],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Unit #${item.unitNumber}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  item.signDate,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Row 2: Driver Name & Optional Route ID
            Row(
              children: [
                const Icon(Icons.person_outline_rounded, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Flexible(
                  flex: 3,
                  child: Text(
                    item.employeeName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
                if (item.routeId != null && item.routeId!.isNotEmpty) ...[
                  const SizedBox(width: 12),
                  const Icon(Icons.alt_route_rounded, size: 14, color: Colors.grey),
                  const SizedBox(width: 4),
                  Flexible(
                    flex: 2,
                    child: Text(
                      item.routeId!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),

            // Row 3: Odometer, Fuel Details & Photo Attachments Counter
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '${item.odometer.toStringAsFixed(1)} km · ${item.fuelLevelDescription ?? "Full"}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ),
                if (item.attachments.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.photo_camera_outlined, size: 12, color: AppColors.primary),
                      const SizedBox(width: 3),
                      Text(
                        '${item.attachments.length}',
                        style: const TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
