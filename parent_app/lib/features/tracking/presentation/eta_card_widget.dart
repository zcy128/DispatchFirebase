import 'package:flutter/material.dart';
import '../../../core/models.dart';

class EtaCardWidget extends StatefulWidget {
  final ParentStudentCommute commute;
  final VoidCallback? onCallDriver;
  final VoidCallback? onReportAbsent;

  const EtaCardWidget({
    super.key,
    required this.commute,
    this.onCallDriver,
    this.onReportAbsent,
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
    final (etaNumber, etaUnit) = _getEtaDisplay(commute);
    final progressValue = _getProgressValue(commute.status);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F0F172A),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // 1. Header: Bus & Student info on left, Dynamic Pulse Badge on right
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Center(
                      child: Text('🚌', style: TextStyle(fontSize: 20)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Bus #${commute.busUnitNumber.isNotEmpty ? commute.busUnitNumber : '42'}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        commute.studentName,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // Dynamic Pulse Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ScaleTransition(
                      scale: _pulseAnimation,
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      badgeText,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: statusColor,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // 2. Main Focus Area: Big ETA + Micro Journey Stepper
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFEDF2F7)),
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
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.8,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          etaUnit,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFF59E0B),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '${commute.distanceKm != null ? '${commute.distanceKm!.toStringAsFixed(1)} km • ' : ''}${commute.scheduledTime}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                // Micro Journey Stepper Bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: progressValue,
                    minHeight: 6,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFF59E0B)),
                  ),
                ),

                const SizedBox(height: 8),

                // Stop Sequence Labels
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Depot',
                      style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.location_on_rounded, size: 13, color: Color(0xFFF59E0B)),
                            const SizedBox(width: 2),
                            Flexible(
                              child: Text(
                                commute.stopLocation,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Text(
                      commute.schoolName.isNotEmpty ? commute.schoolName : 'School',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 3. Driver Meta & Quick Contact Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Driver Avatar & Name (Single Line)
              Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: const Color(0xFFF1F5F9),
                    child: Text(
                      commute.driverName.isNotEmpty ? commute.driverName[0].toUpperCase() : 'D',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    commute.driverName.isNotEmpty ? commute.driverName : 'Assigned Driver',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),

              // Action Shortcuts (Call Driver & Absent)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.onCallDriver != null)
                    InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: widget.onCallDriver,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.call_rounded, size: 14, color: Color(0xFF2563EB)),
                            SizedBox(width: 4),
                            Text(
                              'Call Driver',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (widget.onReportAbsent != null) ...[
                    const SizedBox(width: 6),
                    InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: widget.onReportAbsent,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.event_busy_rounded, size: 14, color: Color(0xFFDC2626)),
                            SizedBox(width: 4),
                            Text(
                              'Absent',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  (String, String) _getEtaDisplay(ParentStudentCommute commute) {
    if (commute.status == 'BOARDED') {
      return ('En Route', 'TO SCHOOL');
    }
    if (commute.status == 'DROPPED_OFF') {
      return ('Safe', 'ARRIVED');
    }
    if (commute.minutesAway != null && commute.minutesAway! > 0) {
      return ('${commute.minutesAway}', 'MINS ARRIVING');
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
        return const Color(0xFFF59E0B);
      case 'BOARDED':
      case 'DROPPED_OFF':
        return const Color(0xFF10B981);
      case 'DELAYED':
        return const Color(0xFFEF4444);
      case 'EN_ROUTE':
        return const Color(0xFF2563EB);
      default:
        return const Color(0xFF64748B);
    }
  }

  String _getBadgeText(ParentStudentCommute commute) {
    if (commute.status == 'BOARDED') return 'ON BOARD';
    if (commute.status == 'DROPPED_OFF') return 'COMPLETED';
    if (commute.status == 'APPROACHING') return 'APPROACHING';
    if (commute.minutesAway != null && commute.minutesAway! > 0) {
      return '${commute.minutesAway} MINS AWAY';
    }
    if (commute.status == 'DELAYED') {
      return 'DELAYED (+${commute.lateMinutes}m)';
    }
    return 'SCHEDULED';
  }
}
