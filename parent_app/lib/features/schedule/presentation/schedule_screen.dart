import 'package:flutter/material.dart';
import '../../../core/models.dart';
import '../../../core/theme.dart';

class ScheduleScreen extends StatefulWidget {
  final List<ParentStudentCommute> students;
  final int initialStudentIndex;
  final Function(int index)? onStudentChanged;
  final Function(ParentStudentCommute commute)? onReportAbsent;
  final VoidCallback? onSwitchToLiveBento;

  const ScheduleScreen({
    super.key,
    required this.students,
    this.initialStudentIndex = 0,
    this.onStudentChanged,
    this.onReportAbsent,
    this.onSwitchToLiveBento,
  });

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  late int _selectedStudentIndex;
  String _selectedFilter = 'ALL'; // ALL, AM, PM_REG, PM_FRI

  @override
  void initState() {
    super.initState();
    _selectedStudentIndex = widget.initialStudentIndex.clamp(0, widget.students.isEmpty ? 0 : widget.students.length - 1);
  }

  ParentStudentCommute? get _activeCommute {
    if (widget.students.isEmpty) return null;
    if (_selectedStudentIndex >= widget.students.length) return widget.students.first;
    return widget.students[_selectedStudentIndex];
  }

  @override
  Widget build(BuildContext context) {
    final commute = _activeCommute;
    if (commute == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Text('No route schedule available', style: TextStyle(color: AppColors.textSecondary)),
        ),
      );
    }

    final stopLocation = commute.stopLocation.isNotEmpty
        ? commute.stopLocation
        : 'Woodroffe Ave & Baseline Rd, Ottawa, ON';
    final schoolName = commute.schoolName.isNotEmpty ? commute.schoolName : 'Broadview Public School';
    final routeNo = commute.routeNo.isNotEmpty ? commute.routeNo : 'OCDSB-001';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Top Header with Title and Student Switcher
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(bottom: BorderSide(color: AppColors.border, width: 1.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Text('📅', style: TextStyle(fontSize: 20)),
                          SizedBox(width: 8),
                          Text(
                            'Route Master Schedule',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.3,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          'Route $routeNo',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Official school board timetables & Bell times (Mon–Thu vs Friday)',
                    style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),

                  // Multi-Student Switcher Pills
                  if (widget.students.length > 1) ...[
                    const SizedBox(height: 10),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: List.generate(widget.students.length, (idx) {
                          final s = widget.students[idx];
                          final isSelected = idx == _selectedStudentIndex;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () {
                                setState(() => _selectedStudentIndex = idx);
                                widget.onStudentChanged?.call(idx);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: isSelected ? AppColors.surfaceHighlight : AppColors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: isSelected ? AppColors.primary : AppColors.border,
                                    width: isSelected ? 1.5 : 1.0,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    CircleAvatar(
                                      radius: 8,
                                      backgroundColor: isSelected ? AppColors.primary : AppColors.border,
                                      child: Text(
                                        s.studentName.isNotEmpty ? s.studentName[0] : 'S',
                                        style: TextStyle(
                                          color: isSelected ? const Color(0xFF0B101D) : AppColors.textSecondary,
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      s.studentName,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                        color: isSelected ? AppColors.primary : AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // 2. Filter Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: AppColors.background,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('All Shifts', 'ALL'),
                    const SizedBox(width: 8),
                    _buildFilterChip('🌅 AM Morning', 'AM'),
                    const SizedBox(width: 8),
                    _buildFilterChip('🌆 Mon–Thu PM (3 PM)', 'PM_REG'),
                    const SizedBox(width: 8),
                    _buildFilterChip('⚡ Friday PM (1 PM)', 'PM_FRI'),
                  ],
                ),
              ),
            ),

            // 3. Main Schedule List
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
                children: [
                  // Weekly Fast Snapshot Table
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              commute.studentName,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            Text(
                              schoolName,
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        const Divider(height: 1, color: AppColors.border),
                        const SizedBox(height: 10),

                        // Weekday Quick Matrix
                        Row(
                          children: [
                            _buildDayPill('MON', '07:35', '15:30', isFriday: false),
                            const SizedBox(width: 6),
                            _buildDayPill('TUE', '07:35', '15:30', isFriday: false),
                            const SizedBox(width: 6),
                            _buildDayPill('WED', '07:35', '15:30', isFriday: false),
                            const SizedBox(width: 6),
                            _buildDayPill('THU', '07:35', '15:30', isFriday: false),
                            const SizedBox(width: 6),
                            _buildDayPill('FRI', '07:35', '13:30', isFriday: true),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Card 1: Morning AM Pickup
                  if (_selectedFilter == 'ALL' || _selectedFilter == 'AM') ...[
                    _buildScheduleCard(
                      icon: Icons.wb_sunny_rounded,
                      iconColor: AppColors.secondary,
                      badgeText: 'MONDAY – FRIDAY DAILY',
                      badgeColor: AppColors.secondary,
                      title: 'Morning Pickup (AM Shift)',
                      subtitle: 'Bus pickup & transfer to $schoolName',
                      stopLabel: 'PICKUP STOP',
                      stopAddress: stopLocation,
                      departureTime: '07:35 AM',
                      departureLabel: 'Scheduled Bus Pickup',
                      destinationTime: '08:35 AM',
                      destinationLabel: 'School Dropoff (Bell: 08:45 AM)',
                      routeNo: routeNo,
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Card 2: Mon - Thu Regular PM Dropoff
                  if (_selectedFilter == 'ALL' || _selectedFilter == 'PM_REG') ...[
                    _buildScheduleCard(
                      icon: Icons.school_rounded,
                      iconColor: AppColors.lavender,
                      badgeText: 'MON – THU REGULAR',
                      badgeColor: AppColors.lavender,
                      title: 'Afternoon Return (Mon–Thu PM)',
                      subtitle: 'Regular 3:00 PM dismissal run',
                      stopLabel: 'HOMESITE DROPOFF',
                      stopAddress: stopLocation,
                      departureTime: '03:10 PM',
                      departureLabel: 'Bus Departs School (Bell: 03:00 PM)',
                      destinationTime: '03:30 PM',
                      destinationLabel: 'Scheduled Home Arrival',
                      routeNo: routeNo,
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Card 3: Friday Early Dismissal PM Dropoff
                  if (_selectedFilter == 'ALL' || _selectedFilter == 'PM_FRI') ...[
                    _buildScheduleCard(
                      icon: Icons.electric_bolt_rounded,
                      iconColor: AppColors.primary,
                      badgeText: 'FRIDAY EARLY DISMISSAL',
                      badgeColor: AppColors.primary,
                      title: 'Friday Early Return (1:00 PM)',
                      subtitle: 'Special Friday 1:00 PM early dismissal run',
                      stopLabel: 'HOMESITE DROPOFF',
                      stopAddress: stopLocation,
                      departureTime: '01:10 PM',
                      departureLabel: 'Bus Departs School (Bell: 01:00 PM)',
                      destinationTime: '01:30 PM',
                      destinationLabel: 'Scheduled Home Arrival',
                      routeNo: routeNo,
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Live Dispatch vs Route Callout Box
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('💡', style: TextStyle(fontSize: 18)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Route Plan vs Live Dispatch',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 3),
                              const Text(
                                'This tab displays the baseline scheduled timetable. Today\'s actual bus unit, live traffic delays, and GPS location are continuously tracked on the Bento tab.',
                                style: TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.35),
                              ),
                              if (widget.onSwitchToLiveBento != null) ...[
                                const SizedBox(height: 8),
                                InkWell(
                                  onTap: widget.onSwitchToLiveBento,
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'Switch to Live Bento Map',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      SizedBox(width: 4),
                                      Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.primary),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  if (widget.onReportAbsent != null) ...[
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => widget.onReportAbsent!(commute),
                      icon: const Icon(Icons.event_busy_rounded, size: 18),
                      label: Text('Report Absence for ${commute.studentName}'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surfaceHighlight,
                        foregroundColor: AppColors.coral,
                        side: const BorderSide(color: AppColors.coral),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String filterKey) {
    final isSelected = _selectedFilter == filterKey;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => setState(() => _selectedFilter = filterKey),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surfaceHighlight : AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 1.4 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
            color: isSelected ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildDayPill(String day, String amTime, String pmTime, {required bool isFriday}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isFriday ? AppColors.primary.withValues(alpha: 0.12) : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isFriday ? AppColors.primary.withValues(alpha: 0.5) : AppColors.border,
          ),
        ),
        child: Column(
          children: [
            Text(
              day,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: isFriday ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              amTime,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 2),
            Text(
              pmTime,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: isFriday ? AppColors.primary : AppColors.secondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScheduleCard({
    required IconData icon,
    required Color iconColor,
    required String badgeText,
    required Color badgeColor,
    required String title,
    required String subtitle,
    required String stopLabel,
    required String stopAddress,
    required String departureTime,
    required String departureLabel,
    required String destinationTime,
    required String destinationLabel,
    required String routeNo,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border, width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: badgeColor.withValues(alpha: 0.4)),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: badgeColor,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Timetable Timeline
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                // Step 1: Bus Departure / Pickup
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: iconColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        Container(
                          width: 2,
                          height: 28,
                          color: AppColors.border,
                        ),
                      ],
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              departureLabel,
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            departureTime,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // Step 2: Stop Arrival
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              destinationLabel,
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            destinationTime,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primary,
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

          const SizedBox(height: 12),

          // Designated Stop Row
          Row(
            children: [
              const Icon(Icons.pin_drop_rounded, size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                '$stopLabel: ',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
              ),
              Expanded(
                child: Text(
                  stopAddress,
                  style: const TextStyle(fontSize: 11, color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
