import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme.dart';
import '../../../charter/models/charter_model.dart';
import '../../../charter/presentation/available_charters_sheet.dart';
import '../../../charter/presentation/charter_trip_card.dart';
import '../../../charter/repository/charter_repository.dart';

class AssignedCharterSection extends StatelessWidget {
  final String driverId;
  final String username;
  final String role;

  const AssignedCharterSection({
    super.key,
    required this.driverId,
    required this.username,
    required this.role,
  });

  @override
  Widget build(BuildContext context) {
    final charterRepo = context.read<CharterRepository>();

    return StreamBuilder<List<CharterTripModel>>(
      stream: charterRepo.streamAssignedTrips(driverId: driverId, username: username),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return const SizedBox.shrink();
        }

        final assignedTrips = snapshot.data!;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'ASSIGNED CHARTER TRIPS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${assignedTrips.length} RUN${assignedTrips.length > 1 ? 'S' : ''}',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: () {
                    AvailableChartersSheet.show(
                      context,
                      driverId: driverId,
                      username: username,
                      role: role,
                      repository: charterRepo,
                    );
                  },
                  icon: const Icon(Icons.explore_outlined, size: 14),
                  label: const Text('Browse Charters', style: TextStyle(fontSize: 11)),
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...assignedTrips.map((trip) {
              final assignment = trip.getAssignmentForUser(driverId, username);
              if (assignment == null) return const SizedBox.shrink();
              return CharterTripCard(
                key: ValueKey('charter-${trip.id}-${assignment.id}'),
                trip: trip,
                assignment: assignment,
                driverId: driverId,
                username: username,
                role: role,
                repository: charterRepo,
              );
            }),
            const SizedBox(height: 12),
          ],
        );
      },
    );
  }
}
