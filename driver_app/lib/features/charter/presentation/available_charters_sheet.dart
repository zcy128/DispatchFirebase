import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../models/charter_model.dart';
import '../repository/charter_repository.dart';
import 'charter_stops_sheet.dart';

class AvailableChartersSheet extends StatefulWidget {
  final String driverId;
  final String username;
  final String role;
  final CharterRepository repository;

  const AvailableChartersSheet({
    super.key,
    required this.driverId,
    required this.username,
    required this.role,
    required this.repository,
  });

  static Future<void> show(
    BuildContext context, {
    required String driverId,
    required String username,
    required String role,
    required CharterRepository repository,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AvailableChartersSheet(
        driverId: driverId,
        username: username,
        role: role,
        repository: repository,
      ),
    );
  }

  @override
  State<AvailableChartersSheet> createState() => _AvailableChartersSheetState();
}

class _AvailableChartersSheetState extends State<AvailableChartersSheet> {
  bool _isClaiming = false;

  Future<void> _claimAssignment(
    CharterTripModel trip,
    CharterAssignmentModel? assignment,
    String role,
  ) async {
    final unitInfo = (assignment != null &&
            assignment.vehicleUnitNumber.isNotEmpty &&
            assignment.vehicleUnitNumber != 'TBD')
        ? 'Bus #${assignment.vehicleUnitNumber}'
        : 'Vehicle TBD by Dispatch';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Claim Charter Shift'),
        content: Text(
          'Do you want to self-assign as $role for "${trip.title}" on ${trip.dispatchDate}?\n\n$unitInfo • ${trip.passengerCount} Passengers',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm Assignment'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isClaiming = true);
    try {
      await widget.repository.assignCrewMember(
        tripId: trip.id,
        assignmentId: assignment?.id,
        role: role,
        employeeId: widget.driverId,
        employeeName: widget.username,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Successfully assigned to "${trip.title}"!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to claim shift: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isClaiming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DraggableScrollableSheet(
      initialChildSize: 0.8,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey.shade700 : Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.airport_shuttle_rounded, color: AppColors.primary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Available Charter Trips',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Browse & Self-Assign Open Charter Shifts',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(height: 20),

              // Trips Stream
              Expanded(
                child: StreamBuilder<List<CharterTripModel>>(
                  stream: widget.repository.streamAllActiveTrips(),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                    }
                    if (snapshot.hasError) {
                      return Center(child: Text('Error loading trips: ${snapshot.error}'));
                    }

                    final trips = snapshot.data ?? [];
                    if (trips.isEmpty) {
                      return Center(
                        child: Text(
                          'No charter trips currently scheduled.',
                          style: TextStyle(
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      );
                    }

                    return ListView.builder(
                      controller: scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      itemCount: trips.length,
                      itemBuilder: (context, index) {
                        final trip = trips[index];
                        return _buildTripItem(context, trip, isDark);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTripItem(BuildContext context, CharterTripModel trip, bool isDark) {
    final myAssignment = trip.getAssignmentForUser(widget.driverId, widget.username);
    final hasUserAssigned = myAssignment != null;

    final totalShifts = trip.assignments.length > trip.vehiclesNeeded
        ? trip.assignments.length
        : (trip.vehiclesNeeded > 0 ? trip.vehiclesNeeded : 1);
    final filledDriverCount = trip.assignments
        .where((a) => a.driverId.trim().isNotEmpty || a.driverName.trim().isNotEmpty)
        .length;
    final openDriverSlots = (totalShifts - filledDriverCount).clamp(0, totalShifts);

    final filledAttendantCount = trip.assignments
        .where((a) => a.attendantId.trim().isNotEmpty || a.attendantName.trim().isNotEmpty)
        .length;
    final openAttendantSlots =
        trip.needsAttendant ? (totalShifts - filledAttendantCount).clamp(0, totalShifts) : 0;

    CharterAssignmentModel? firstOpenDriverAsg;
    for (final a in trip.assignments) {
      if (a.driverId.trim().isEmpty && a.driverName.trim().isEmpty) {
        firstOpenDriverAsg = a;
        break;
      }
    }

    CharterAssignmentModel? firstOpenAttendantAsg;
    if (trip.needsAttendant) {
      for (final a in trip.assignments) {
        if (a.attendantId.trim().isEmpty && a.attendantName.trim().isEmpty) {
          firstOpenAttendantAsg = a;
          break;
        }
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E2538) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: hasUserAssigned
              ? AppColors.primary
              : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  trip.tripNumber.isNotEmpty ? trip.tripNumber : 'CHARTER',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.purple.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  trip.tripTypeLabel,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.purple),
                ),
              ),
              const Spacer(),
              Text(
                trip.dispatchDate,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(trip.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          Text(
            trip.clientName,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Departs: ${_formatTime(trip.departsAt)} • Returns: ${_formatTime(trip.returnsAt)} • ${trip.passengerCount} Passengers • ${trip.stops.length} Stops',
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
          const Divider(height: 18),

          // Unified Single Task Shift Summary & Action Card
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.directions_bus_rounded, size: 16, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      hasUserAssigned
                          ? 'Your Shift: ${myAssignment.runNumber != null ? "#${myAssignment.runNumber} • " : ""}Bus #${myAssignment.vehicleUnitNumber.isNotEmpty ? myAssignment.vehicleUnitNumber : "TBD"}'
                          : '$totalShifts ${totalShifts == 1 ? "Bus Needed" : "Buses Needed"}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    if (hasUserAssigned)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.success.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'ASSIGNED TO YOU',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.success),
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: (openDriverSlots > 0 ? Colors.orange : AppColors.success)
                              .withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          openDriverSlots > 0
                              ? '$openDriverSlots / $totalShifts Open'
                              : 'All Shifts Filled',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: openDriverSlots > 0 ? Colors.orange : AppColors.success,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),

                // Actions
                Row(
                  children: [
                    TextButton.icon(
                      onPressed: () => CharterStopsSheet.show(
                        context,
                        trip: trip,
                        repository: widget.repository,
                        assignmentId: myAssignment?.id,
                      ),
                      icon: const Icon(Icons.list_alt_rounded, size: 14),
                      label: const Text('View Stops', style: TextStyle(fontSize: 11)),
                    ),
                    const Spacer(),
                    if (!hasUserAssigned && openDriverSlots > 0)
                      ElevatedButton.icon(
                        onPressed: _isClaiming
                            ? null
                            : () => _claimAssignment(trip, firstOpenDriverAsg, 'Driver'),
                        icon: const Icon(Icons.person_add_alt_1_rounded, size: 14),
                        label: const Text('Claim as Driver', style: TextStyle(fontSize: 11)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.black,
                          visualDensity: VisualDensity.compact,
                        ),
                      )
                    else if (!hasUserAssigned &&
                        openAttendantSlots > 0 &&
                        widget.role.toLowerCase() != 'driver')
                      ElevatedButton.icon(
                        onPressed: _isClaiming
                            ? null
                            : () => _claimAssignment(trip, firstOpenAttendantAsg, 'Attendant'),
                        icon: const Icon(Icons.person_add_alt_1_rounded, size: 14),
                        label: const Text('Claim as Attendant', style: TextStyle(fontSize: 11)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.info,
                          foregroundColor: Colors.white,
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(String isoOrTime) {
    if (isoOrTime.isEmpty) return '--:--';
    if (isoOrTime.contains('T')) {
      try {
        final dt = DateTime.parse(isoOrTime);
        return DateFormat('hh:mm a').format(dt);
      } catch (_) {}
    }
    return isoOrTime;
  }
}
