import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../pretrip/bloc/pretrip_bloc.dart';
import '../../pretrip/bloc/pretrip_event.dart';
import '../../pretrip/presentation/pretrip_checklist_page.dart';
import '../../pretrip/repository/pretrip_repository.dart';
import '../models/charter_model.dart';
import '../repository/charter_repository.dart';
import 'charter_stops_sheet.dart';

class CharterTripCard extends StatefulWidget {
  final CharterTripModel trip;
  final CharterAssignmentModel assignment;
  final String driverId;
  final String username;
  final String role;
  final CharterRepository repository;

  const CharterTripCard({
    super.key,
    required this.trip,
    required this.assignment,
    required this.driverId,
    required this.username,
    required this.role,
    required this.repository,
  });

  @override
  State<CharterTripCard> createState() => _CharterTripCardState();
}

class _CharterTripCardState extends State<CharterTripCard> {
  bool _isInspectedToday = false;
  bool _isCheckingPreTrip = true;
  bool _isProcessingAction = false;

  @override
  void initState() {
    super.initState();
    _checkPreTripStatus();
  }

  @override
  void didUpdateWidget(covariant CharterTripCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.assignment.vehicleUnitNumber != widget.assignment.vehicleUnitNumber) {
      _checkPreTripStatus();
    }
  }

  Future<void> _checkPreTripStatus() async {
    final unit = widget.assignment.vehicleUnitNumber;
    if (unit.isEmpty) {
      if (mounted) setState(() => _isCheckingPreTrip = false);
      return;
    }

    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    try {
      final preTripRepo = context.read<PreTripRepository>();
      final inspected = await preTripRepo.isVehicleInspectedToday(unit, todayStr);
      if (mounted) {
        setState(() {
          _isInspectedToday = inspected;
          _isCheckingPreTrip = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isCheckingPreTrip = false);
    }
  }

  bool get _isDriverRole {
    return widget.assignment.isUserDriver(widget.driverId, widget.username);
  }

  bool get _isCheckedIn {
    return _isDriverRole
        ? widget.assignment.isDriverCheckedIn
        : widget.assignment.isAttendantCheckedIn;
  }

  String? get _checkedInAt {
    return _isDriverRole
        ? widget.assignment.driverCheckedInAt
        : widget.assignment.attendantCheckedInAt;
  }

  bool get _isCheckedOut {
    return _isDriverRole
        ? widget.assignment.isDriverCheckedOut
        : widget.assignment.isAttendantCheckedOut;
  }

  String? get _checkedOutAt {
    return _isDriverRole
        ? widget.assignment.driverCheckedOutAt
        : widget.assignment.attendantCheckedOutAt;
  }

  Future<void> _handleCheckIn() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.assignment_turned_in_rounded, color: AppColors.primary),
            SizedBox(width: 8),
            Text('Check In to Charter'),
          ],
        ),
        content: Text(
          'Confirm check-in for charter "${widget.trip.title}" with Bus #${widget.assignment.vehicleUnitNumber}?\n\nThis will automatically log your shift in Dispatch Payroll.',
          style: const TextStyle(fontSize: 13, height: 1.4),
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
            child: const Text('Confirm Check-In'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isProcessingAction = true);
    try {
      await widget.repository.checkInCrew(
        tripId: widget.trip.id,
        assignmentId: widget.assignment.id,
        isDriver: _isDriverRole,
        employeeId: widget.driverId,
        employeeName: widget.username,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Successfully checked in for charter run!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Check-in failed: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessingAction = false);
    }
  }

  Future<void> _handleCheckOut() async {
    final commentsCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.exit_to_app_rounded, color: AppColors.primary),
            SizedBox(width: 8),
            Text('Check Out of Charter'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Confirm check-out for charter "${widget.trip.title}"?\n\nEnter any comments or delay notes for Dispatch and Payroll review:',
              style: const TextStyle(fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: commentsCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                hintText: 'Optional notes (e.g., waiting for students, route detour)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.success,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm Check-Out'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isProcessingAction = true);
    try {
      await widget.repository.checkOutCrew(
        tripId: widget.trip.id,
        assignmentId: widget.assignment.id,
        isDriver: _isDriverRole,
        employeeId: widget.driverId,
        employeeName: widget.username,
        comments: commentsCtrl.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Successfully checked out from charter run!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Check-out failed: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessingAction = false);
    }
  }

  void _startPreTripInspection() {
    final unit = widget.assignment.vehicleUnitNumber;
    if (unit.isEmpty) return;

    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

    context.read<PreTripBloc>().add(
          StartPreTripInspectionEvent(
            vehicleUnit: unit,
            inspectorId: widget.driverId,
            inspectorName: widget.username,
            date: todayStr,
          ),
        );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BlocProvider.value(
          value: context.read<PreTripBloc>(),
          child: PreTripChecklistPage(
            vehicleUnit: unit,
            driverId: widget.driverId,
            driverName: widget.username,
            currentDate: todayStr,
          ),
        ),
      ),
    ).then((_) {
      _checkPreTripStatus();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final trip = widget.trip;
    final asg = widget.assignment;

    final arrivedStopsCount = trip.stops.where((s) => s.isArrived).length;
    final totalStopsCount = trip.stops.length;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _isCheckedIn && !_isCheckedOut
              ? AppColors.primary
              : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
          width: _isCheckedIn && !_isCheckedOut ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Ribbon
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkCardBorder.withValues(alpha: 0.4)
                  : Colors.grey.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Row(
              children: [
                // Charter Tag Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.airport_shuttle_rounded,
                          size: 14, color: AppColors.primary),
                      const SizedBox(width: 4),
                      Text(
                        trip.tripNumber.isNotEmpty ? trip.tripNumber : 'CHARTER',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),

                // Trip Type Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.purple.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    trip.tripTypeLabel,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.purple,
                    ),
                  ),
                ),
                const Spacer(),

                // Status Badge
                _buildStatusPill(isDark),
              ],
            ),
          ),

          // Main Card Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Trip Title & Client
                Text(
                  trip.title,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      Icons.business_rounded,
                      size: 14,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        trip.clientName,
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Schedule & Passenger Info Grid
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E2538) : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'DEPARTS',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _formatTime(trip.departsAt),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 28, color: Colors.grey.withValues(alpha: 0.3)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'RETURNS',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _formatTime(trip.returnsAt),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 28, color: Colors.grey.withValues(alpha: 0.3)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'PASSENGERS',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${trip.passengerCount} Pax',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Vehicle & Assignment Info
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.directions_bus_rounded, color: AppColors.primary, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            asg.vehicleUnitNumber.isNotEmpty
                                ? 'Bus #${asg.vehicleUnitNumber}'
                                : 'No Bus Assigned',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            _isDriverRole
                                ? 'Assigned Driver: ${asg.driverName}'
                                : 'Assigned Attendant: ${asg.attendantName}',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (asg.plateNumber.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.darkCardBorder : Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          asg.plateNumber,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),

                // Pre-Trip Inspection Banner (For Driver)
                if (_isDriverRole && asg.vehicleUnitNumber.isNotEmpty) ...[
                  _buildPreTripSection(isDark),
                  const SizedBox(height: 14),
                ],

                // Stops & Itinerary Shortcut Button
                InkWell(
                  onTap: () => CharterStopsSheet.show(
                    context,
                    trip: trip,
                    repository: widget.repository,
                  ),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.grey.shade900 : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.alt_route_rounded, color: AppColors.primary, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            totalStopsCount > 0
                                ? 'Stops & Timing ($arrivedStopsCount/$totalStopsCount Arrived)'
                                : 'Stops & Timing',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded, color: Colors.grey, size: 18),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Check-In / Check-Out Action Button
                _buildCheckInOutButton(isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPill(bool isDark) {
    if (_isCheckedOut) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.success.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          'Checked Out at $_checkedOutAt',
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.success),
        ),
      );
    }

    if (_isCheckedIn) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          'Checked In at $_checkedInAt',
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.orange.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text(
        'Assigned / Pending',
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.orange),
      ),
    );
  }

  Widget _buildPreTripSection(bool isDark) {
    if (_isCheckingPreTrip) {
      return Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCardBorder.withValues(alpha: 0.2) : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            SizedBox(width: 10),
            Text('Checking vehicle pre-trip status...', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      );
    }

    if (_isInspectedToday) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.success.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Pre-trip complete for Bus #${widget.assignment.vehicleUnitNumber}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.success),
              ),
            ),
          ],
        ),
      );
    }

    return InkWell(
      onTap: _startPreTripInspection,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.warning.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Pre-trip required for Bus #${widget.assignment.vehicleUnitNumber}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.warning),
                  ),
                  const Text(
                    'Tap to perform Schedule 5 inspection',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.grey, size: 18),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckInOutButton(bool isDark) {
    if (_isProcessingAction) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
        ),
      );
    }

    if (!_isCheckedIn) {
      return SizedBox(
        width: double.infinity,
        height: 44,
        child: ElevatedButton.icon(
          onPressed: _handleCheckIn,
          icon: const Icon(Icons.assignment_turned_in_rounded, size: 18),
          label: const Text(
            'CHECK IN (CHARTER)',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.black,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      );
    }

    if (!_isCheckedOut) {
      return SizedBox(
        width: double.infinity,
        height: 44,
        child: ElevatedButton.icon(
          onPressed: _handleCheckOut,
          icon: const Icon(Icons.exit_to_app_rounded, size: 18),
          label: const Text(
            'CHECK OUT (CHARTER)',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.success,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.task_alt_rounded, color: AppColors.success, size: 16),
          const SizedBox(width: 8),
          Text(
            'Charter Shift Complete (Checked out at $_checkedOutAt)',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: AppColors.success,
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
