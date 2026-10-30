import 'package:flutter/material.dart';
import '../../../core/models.dart';
import '../../../core/theme.dart';

class EtaCardWidget extends StatefulWidget {
  final ParentStudentCommute commute;
  final VoidCallback? onCallDriver;
  final VoidCallback? onReportAbsent;
  final VoidCallback? onContactDispatcher;

  const EtaCardWidget({
    super.key,
    required this.commute,
    this.onCallDriver,
    this.onReportAbsent,
    this.onContactDispatcher,
  });

  @override
  State<EtaCardWidget> createState() => _EtaCardWidgetState();
}

class _EtaCardWidgetState extends State<EtaCardWidget> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.25).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final commute = widget.commute;
    final statusColor = _getStatusColor(commute.status);
    final badgeText = _getBadgeText(commute);
    final reassuranceTitle = _getReassuranceTitle(commute);
    final (etaNumber, etaUnit) = _getEtaDisplay(commute);
    final progressValue = _getProgressValue(commute.status);
    final busUnit = commute.busUnitNumber.isNotEmpty ? commute.busUnitNumber : '42';
    final distanceStr = commute.distanceKm != null ? ' • ${commute.distanceKm!.toStringAsFixed(1)} km away' : '';

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border, width: 1.1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 18,
            offset: Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // 1. Compact Reassurance Header Bar
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.surfaceHighlight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Center(
                  child: Text('🚌', style: TextStyle(fontSize: 18)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      reassuranceTitle,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 1),
                    Text(
                      'Bus #$busUnit$distanceStr',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Calming Pulse Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: statusColor.withValues(alpha: 0.35)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ScaleTransition(
                      scale: _pulseAnimation,
                      child: Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      badgeText,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: statusColor,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // 2. Compact Bento Hero Countdown Slot
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          etaNumber,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.8,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          etaUnit,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textSecondary,
                            letterSpacing: 0.4,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.secondary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_circle_rounded, size: 11, color: AppColors.secondary),
                          const SizedBox(width: 4),
                          Text(
                            commute.scheduledTime.isNotEmpty ? commute.scheduledTime : 'On Time',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // Micro Stepper Progress Bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progressValue,
                    minHeight: 4,
                    backgroundColor: const Color(0xFF0F172A),
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                  ),
                ),

                const SizedBox(height: 7),

                // Stop Sequence Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.pin_drop_rounded, size: 12, color: AppColors.primary),
                          const SizedBox(width: 3),
                          Flexible(
                            child: Text(
                              commute.stopLocation.isNotEmpty ? commute.stopLocation : 'Pickup Stop',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.school_rounded, size: 12, color: AppColors.textMuted),
                          const SizedBox(width: 3),
                          Flexible(
                            child: Text(
                              commute.schoolName.isNotEmpty ? commute.schoolName : 'School',
                              style: const TextStyle(
                                fontSize: 10.5,
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // 3. Compact Info Row: Stop & Driver in 1 Sleek Row
          Row(
            children: [
              // Stop & Scheduled Time
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.schedule_rounded, size: 13, color: AppColors.primary),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          'Stop: ',
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // Driver & Direct Call
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.badge_rounded, size: 13, color: AppColors.lavender),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          commute.driverName.isNotEmpty ? commute.driverName : 'Driver',
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (widget.onCallDriver != null) ...[
                        const SizedBox(width: 4),
                        InkWell(
                          onTap: widget.onCallDriver,
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              color: AppColors.lavender.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(5),
                            ),
                            child: const Icon(Icons.phone_rounded, size: 11, color: AppColors.lavender),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 9),

          // 4. Action Row: Absence Button & Quick Contacts
          Row(
            children: [
              if (widget.onReportAbsent != null)
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: widget.onReportAbsent,
                    icon: const Icon(Icons.event_busy_rounded, size: 15),
                    label: const Text(
                      'Report Absence / Leave',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: const Color(0xFF0B101D),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),

              if (widget.onCallDriver != null) ...[
                const SizedBox(width: 7),
                InkWell(
                  onTap: widget.onCallDriver,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    height: 38,
                    width: 38,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceHighlight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Icon(Icons.call_rounded, size: 17, color: AppColors.lavender),
                  ),
                ),
              ],

              if (widget.onContactDispatcher != null) ...[
                const SizedBox(width: 7),
                InkWell(
                  onTap: widget.onContactDispatcher,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    height: 38,
                    width: 38,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceHighlight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Icon(Icons.support_agent_rounded, size: 17, color: AppColors.primary),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  String _getReassuranceTitle(ParentStudentCommute commute) {
    if (commute.status == 'BOARDED') {
      return 'On Board • ';
    }
    if (commute.status == 'DROPPED_OFF') {
      return 'Arrived at School';
    }
    if (commute.status == 'APPROACHING') {
      return 'Bus Arriving Shortly';
    }
    if (commute.status == 'DELAYED') {
      return 'Commute Delayed';
    }
    return ' • On Schedule';
  }

  (String, String) _getEtaDisplay(ParentStudentCommute commute) {
    if (commute.status == 'BOARDED') {
      return ('En Route', 'TO SCHOOL');
    }
    if (commute.status == 'DROPPED_OFF') {
      return ('Safe', 'ARRIVED');
    }
    if (commute.minutesAway != null && commute.minutesAway! > 0) {
      return ('', 'MINS AWAY');
    }
    if (commute.status == 'APPROACHING') {
      return ('< 2', 'MINS AWAY');
    }
    return (commute.scheduledTime, 'SCHEDULED');
  }

  double _getProgressValue(String status) {
    switch (status) {
      case 'DROPPED_OFF':
        return 1.0;
      case 'BOARDED':
        return 0.85;
      case 'APPROACHING':
        return 0.65;
      case 'EN_ROUTE':
        return 0.40;
      case 'SCHEDULED':
      default:
        return 0.15;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'APPROACHING':
        return AppColors.warning;
      case 'BOARDED':
      case 'DROPPED_OFF':
        return AppColors.secondary;
      case 'DELAYED':
        return AppColors.coral;
      case 'EN_ROUTE':
        return AppColors.lavender;
      default:
        return AppColors.textSecondary;
    }
  }

  String _getBadgeText(ParentStudentCommute commute) {
    if (commute.status == 'BOARDED') return 'ON BOARD';
    if (commute.status == 'DROPPED_OFF') return 'ARRIVED';
    if (commute.status == 'APPROACHING') return 'APPROACHING';
    if (commute.minutesAway != null && commute.minutesAway! > 0) {
      return ' MINS';
    }
    if (commute.status == 'DELAYED') {
      return 'DELAYED (+m)';
    }
    return 'ON TIME';
  }
}
