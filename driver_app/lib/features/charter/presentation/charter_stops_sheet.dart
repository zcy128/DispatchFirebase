import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme.dart';
import '../models/charter_model.dart';
import '../repository/charter_repository.dart';

class CharterStopsSheet extends StatefulWidget {
  final CharterTripModel trip;
  final CharterRepository repository;
  final String? assignmentId;

  const CharterStopsSheet({
    super.key,
    required this.trip,
    required this.repository,
    this.assignmentId,
  });

  static Future<void> show(
    BuildContext context, {
    required CharterTripModel trip,
    required CharterRepository repository,
    String? assignmentId,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CharterStopsSheet(
        trip: trip,
        repository: repository,
        assignmentId: assignmentId,
      ),
    );
  }

  @override
  State<CharterStopsSheet> createState() => _CharterStopsSheetState();
}

class _CharterStopsSheetState extends State<CharterStopsSheet> {
  late CharterTripModel _currentTrip;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _currentTrip = widget.trip;
  }

  Future<void> _refreshTrip() async {
    final updated = await widget.repository.getTripById(_currentTrip.id);
    if (updated != null && mounted) {
      setState(() {
        _currentTrip = updated;
      });
    }
  }

  Future<void> _markArrival(CharterStopModel stop) async {
    setState(() => _isSaving = true);
    final nowStr = DateFormat('HH:mm').format(DateTime.now());
    try {
      await widget.repository.recordStopArrival(
        tripId: _currentTrip.id,
        stopId: stop.id,
        assignmentId: widget.assignmentId,
        arrivalTime: nowStr,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Arrival at "${stop.locationName.isNotEmpty ? stop.locationName : stop.address}" recorded at $nowStr'),
            backgroundColor: AppColors.success,
          ),
        );
        await _refreshTrip();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to record arrival: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _markDeparture(CharterStopModel stop) async {
    setState(() => _isSaving = true);
    final nowStr = DateFormat('HH:mm').format(DateTime.now());
    try {
      await widget.repository.recordStopDeparture(
        tripId: _currentTrip.id,
        stopId: stop.id,
        assignmentId: widget.assignmentId,
        departureTime: nowStr,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Departure from "${stop.locationName.isNotEmpty ? stop.locationName : stop.address}" recorded at $nowStr'),
            backgroundColor: AppColors.success,
          ),
        );
        await _refreshTrip();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to record departure: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _openNavigation(String address) async {
    if (address.trim().isEmpty) return;
    final encoded = Uri.encodeComponent(address.trim());
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$encoded');
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open map: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final stops = _currentTrip.effectiveStopsForAssignment(widget.assignmentId);

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.45,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            children: [
              // Sheet Drag Handle
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

              // Header
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
                      child: const Icon(Icons.alt_route_rounded, color: AppColors.primary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _currentTrip.title,
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'Charter Stops & Arrival Logging • ${_currentTrip.stops.length} Stops',
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

              // Direction C: Micro-stepper in Stops Sheet
              if (stops.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'STEP ${stops.where((s) => s.isArrived).length} OF ${stops.length}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                          Text(
                            stops.every((s) => s.isArrived)
                                ? 'ALL STOPS COMPLETE'
                                : '${((stops.where((s) => s.isArrived).length / stops.length) * 100).toInt()}% COMPLETED',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: stops.every((s) => s.isArrived) ? AppColors.success : AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: List.generate(stops.length, (idx) {
                          final isDone = stops[idx].isArrived;
                          return Expanded(
                            child: Container(
                              height: 4,
                              margin: EdgeInsets.only(right: idx == stops.length - 1 ? 0 : 4),
                              decoration: BoxDecoration(
                                color: isDone
                                    ? AppColors.success
                                    : (isDark ? Colors.grey.shade800 : Colors.grey.shade300),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: 10),
                    ],
                  ),
                ),
              ],

              // Stops Timeline List
              Expanded(
                child: stops.isEmpty
                    ? Center(
                        child: Text(
                          'No stops configured for this charter trip.',
                          style: TextStyle(
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        itemCount: stops.length,
                        itemBuilder: (context, index) {
                          final stop = stops[index];
                          final isLast = index == stops.length - 1;
                          return _buildStopItem(context, stop, index, isLast, isDark);
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStopItem(
    BuildContext context,
    CharterStopModel stop,
    int index,
    bool isLast,
    bool isDark,
  ) {
    Color typeColor;
    IconData typeIcon;
    switch (stop.stopType) {
      case 0:
        typeColor = AppColors.primary;
        typeIcon = Icons.departure_board_rounded;
        break;
      case 1:
        typeColor = Colors.purple;
        typeIcon = Icons.flag_rounded;
        break;
      case 3:
        typeColor = AppColors.info;
        typeIcon = Icons.departure_board_rounded;
        break;
      case 2:
        typeColor = AppColors.success;
        typeIcon = Icons.keyboard_return_rounded;
        break;
      default:
        typeColor = Colors.blueGrey;
        typeIcon = Icons.place_rounded;
    }

    final hasArrived = stop.isArrived;
    final hasDeparted = stop.isDeparted;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline indicator
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: hasDeparted
                      ? AppColors.success
                      : hasArrived
                          ? AppColors.primary
                          : typeColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: hasArrived ? Colors.transparent : typeColor,
                    width: 2,
                  ),
                ),
                child: Center(
                  child: hasDeparted
                      ? const Icon(Icons.check, color: Colors.white, size: 18)
                      : Text(
                          '${index + 1}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: hasArrived ? Colors.white : typeColor,
                          ),
                        ),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: hasDeparted
                        ? AppColors.success.withValues(alpha: 0.5)
                        : (isDark ? Colors.grey.shade800 : Colors.grey.shade300),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),

          // Stop Content Card
          Expanded(
            child: Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkCardBorder.withValues(alpha: 0.3) : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: hasArrived
                      ? AppColors.primary.withValues(alpha: 0.4)
                      : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Stop Header Badges
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: typeColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(typeIcon, size: 12, color: typeColor),
                            const SizedBox(width: 4),
                            Text(
                              stop.stopTypeLabel.toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: typeColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      if (stop.scheduledAt != null && stop.scheduledAt!.isNotEmpty)
                        Row(
                          children: [
                            Icon(
                              Icons.schedule_rounded,
                              size: 13,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Sched: ${CharterStopModel.extractTimeOnly(stop.scheduledAt)}',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Location Name & Address
                  if (stop.locationName.isNotEmpty) ...[
                    Text(
                      stop.locationName,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                  ],
                  Text(
                    stop.address,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),

                  // Timing status badges
                  if (hasArrived || hasDeparted) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        if (hasArrived)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.pin_drop_rounded, size: 12, color: AppColors.primary),
                                const SizedBox(width: 4),
                                Text(
                                  'Arrived: ${stop.arrivedAt}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (hasDeparted)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.success.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.departure_board_rounded, size: 12, color: AppColors.success),
                                const SizedBox(width: 4),
                                Text(
                                  'Departed: ${stop.departedAt}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.success,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 12),
                  // Actions row
                  Row(
                    children: [
                      // Navigation Button
                      OutlinedButton.icon(
                        onPressed: () => _openNavigation(stop.address),
                        icon: const Icon(Icons.navigation_outlined, size: 14),
                        label: const Text('Navigate', style: TextStyle(fontSize: 11)),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                      const Spacer(),

                      // Mark Arrived Button
                      if (!hasArrived)
                        ElevatedButton.icon(
                          onPressed: _isSaving ? null : () => _markArrival(stop),
                          icon: const Icon(Icons.pin_drop_rounded, size: 14),
                          label: const Text('Mark Arrived', style: TextStyle(fontSize: 11)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            visualDensity: VisualDensity.compact,
                          ),
                        )
                      else if (!hasDeparted)
                        ElevatedButton.icon(
                          onPressed: _isSaving ? null : () => _markDeparture(stop),
                          icon: const Icon(Icons.check_circle_outline_rounded, size: 14),
                          label: const Text('Mark Departed', style: TextStyle(fontSize: 11)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
