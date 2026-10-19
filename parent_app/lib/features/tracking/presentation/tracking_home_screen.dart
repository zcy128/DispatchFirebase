import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/api_client.dart';
import '../../../core/models.dart';
import '../../../core/theme.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../auth/presentation/register_dialog.dart';
import '../../dispatcher/presentation/dispatcher_contact_sheet.dart';
import '../../notifications/presentation/notification_settings_sheet.dart';
import '../../profile/presentation/edit_profile_sheet.dart';
import '../../sms_inquiry/presentation/sms_guide_modal.dart';
import 'bus_map_widget.dart';
import 'eta_card_widget.dart';
import 'package:url_launcher/url_launcher.dart';

class TrackingHomeScreen extends StatefulWidget {
  final ApiClient apiClient;
  final List<ParentStudentCommute> students;
  final String contact;
  final ParentUser? user;

  const TrackingHomeScreen({
    super.key,
    required this.apiClient,
    required this.students,
    required this.contact,
    this.user,
  });

  @override
  State<TrackingHomeScreen> createState() => _TrackingHomeScreenState();
}

class _TrackingHomeScreenState extends State<TrackingHomeScreen> {
  int _selectedStudentIndex = 0;
  Timer? _refreshTimer;
  bool _showCommuteDetails = true;
  ParentUser? _currentUser;

  void _openDispatcherContactSheet(BuildContext context, ParentStudentCommute? commute, {bool autoOpenCustomAbsence = false}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DispatcherContactSheet(
        commute: commute,
        allStudents: widget.students,
        parentContact: widget.contact,
        apiClient: widget.apiClient,
        autoOpenCustomAbsence: autoOpenCustomAbsence,
      ),
    );
  }

  void _openEditProfileSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => EditProfileSheet(
        apiClient: widget.apiClient,
        parentContact: widget.contact,
        initialUser: _currentUser,
        initialAddress: _activeCommute?.stopLocation,
        onProfileUpdated: (updated) {
          setState(() {
            _currentUser = updated;
          });
        },
      ),
    );
  }

  String get _firstName {
    final rawName = _currentUser?.displayName.trim() ?? '';
    if (rawName.isNotEmpty) {
      return rawName.split(RegExp(r'\s+')).first;
    }
    return 'Parent';
  }

  Future<void> _loadProfile() async {
    try {
      final user = await widget.apiClient.fetchProfile(widget.contact);
      if (mounted) {
        setState(() {
          _currentUser = user;
        });
      }
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    _currentUser = widget.user;
    _loadProfile();
    // Auto-refresh live telemetry every 12 seconds
    _refreshTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      context.read<AuthBloc>().add(RefreshCommutesEvent());
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  ParentStudentCommute? get _activeCommute {
    if (widget.students.isEmpty) return null;
    if (_selectedStudentIndex >= widget.students.length) return widget.students.first;
    return widget.students[_selectedStudentIndex];
  }

  @override
  Widget build(BuildContext context) {
    return _buildMobileScaffold(context);
  }

  Widget _buildMobileScaffold(BuildContext context) {
    final activeCommute = _activeCommute;
    final isRegistered = widget.user?.isRegistered ?? false;

    return Scaffold(
      backgroundColor: Colors.white,
      body: activeCommute == null
          ? const Center(child: Text('No active student commute found.'))
          : Stack(
              children: [
                // 1. Full-Screen Interactive Live Map
                Positioned.fill(
                  child: BusMapWidget(commute: activeCommute),
                ),

                // 2. Floating Top Header & Student Selector
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Top App Bar Card
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.94),
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 3))],
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(8),
                                    boxShadow: const [
                                      BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 1)),
                                    ],
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.asset(
                                      'assets/images/pcy_tech_app_icon.jpg',
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, _, _) => const Icon(Icons.directions_bus_rounded, size: 20, color: AppColors.primary),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    _firstName,
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                // Direct Report Absence Shortcut
                                IconButton(
                                  icon: const Icon(Icons.event_busy_rounded, size: 21, color: AppColors.error),
                                  tooltip: 'Report Absence',
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                                  onPressed: () => _openDispatcherContactSheet(context, activeCommute, autoOpenCustomAbsence: true),
                                ),
                                // Profile & Address Shortcut
                                IconButton(
                                  icon: const Icon(Icons.person_outline_rounded, size: 22, color: AppColors.primary),
                                  tooltip: 'My Profile & Address',
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                                  onPressed: () => _openEditProfileSheet(context),
                                ),
                                // SMS Hotline Shortcut
                                IconButton(
                                  icon: const Icon(Icons.sms_outlined, size: 21, color: AppColors.primary),
                                  tooltip: 'SMS Hotline Guide',
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                                  onPressed: () {
                                    showDialog(context: context, builder: (_) => const SmsGuideModal());
                                  },
                                ),
                                // More Popup
                                PopupMenuButton<String>(
                                  icon: const Icon(Icons.more_vert_rounded, size: 22, color: AppColors.textSecondary),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                                  onSelected: (val) {
                                    if (val == 'dispatch') {
                                      _openDispatcherContactSheet(context, activeCommute);
                                    } else if (val == 'profile') {
                                      _openEditProfileSheet(context);
                                    } else if (val == 'absence') {
                                      _openDispatcherContactSheet(context, activeCommute, autoOpenCustomAbsence: true);
                                    } else if (val == 'alerts') {
                                      showModalBottomSheet(
                                        context: context,
                                        isScrollControlled: true,
                                        backgroundColor: Colors.transparent,
                                        builder: (_) => NotificationSettingsSheet(apiClient: widget.apiClient),
                                      );
                                    } else if (val == 'register') {
                                      showDialog(context: context, builder: (_) => RegisterDialog(contact: widget.contact));
                                    } else if (val == 'refresh') {
                                      context.read<AuthBloc>().add(RefreshCommutesEvent());
                                    } else if (val == 'logout') {
                                      context.read<AuthBloc>().add(LogoutEvent());
                                    }
                                  },
                                  itemBuilder: (context) => [
                                    const PopupMenuItem(
                                      value: 'dispatch',
                                      child: Row(
                                        children: [
                                          Icon(Icons.support_agent_rounded, size: 18, color: AppColors.primary),
                                          SizedBox(width: 8),
                                          Text('Contact Dispatcher'),
                                        ],
                                      ),
                                    ),
                                    const PopupMenuItem(
                                      value: 'profile',
                                      child: Row(
                                        children: [
                                          Icon(Icons.person_outline_rounded, size: 18, color: AppColors.primary),
                                          SizedBox(width: 8),
                                          Text('Edit Profile & Address'),
                                        ],
                                      ),
                                    ),
                                    const PopupMenuItem(
                                      value: 'absence',
                                      child: Row(
                                        children: [
                                          Icon(Icons.event_busy_rounded, size: 18, color: AppColors.error),
                                          SizedBox(width: 8),
                                          Text('Report Absence'),
                                        ],
                                      ),
                                    ),
                                    const PopupMenuItem(
                                      value: 'alerts',
                                      child: Row(
                                        children: [
                                          Icon(Icons.notifications_none_rounded, size: 18),
                                          SizedBox(width: 8),
                                          Text('Alert Preferences'),
                                        ],
                                      ),
                                    ),
                                    if (!isRegistered)
                                      const PopupMenuItem(
                                        value: 'register',
                                        child: Row(
                                          children: [
                                            Icon(Icons.shield_outlined, size: 18, color: AppColors.primary),
                                            SizedBox(width: 8),
                                            Text('Save Account & Password'),
                                          ],
                                        ),
                                      ),
                                    const PopupMenuItem(
                                      value: 'refresh',
                                      child: Row(
                                        children: [
                                          Icon(Icons.refresh_rounded, size: 18),
                                          SizedBox(width: 8),
                                          Text('Refresh Live Telemetry'),
                                        ],
                                      ),
                                    ),
                                    const PopupMenuItem(
                                      value: 'logout',
                                      child: Row(
                                        children: [
                                          Icon(Icons.logout_rounded, size: 18, color: AppColors.error),
                                          SizedBox(width: 8),
                                          Text('Sign Out', style: TextStyle(color: AppColors.error)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                          // Multi-Student Switching Carousel
                          if (widget.students.length > 1) ...[
                            const SizedBox(height: 8),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: List.generate(widget.students.length, (idx) {
                                  final s = widget.students[idx];
                                  final isSelected = idx == _selectedStudentIndex;
                                  final avatarColor = Color(int.parse(s.avatarColor.replaceFirst('#', '0xFF')));

                                  return Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: InkWell(
                                      onTap: () {
                                        setState(() => _selectedStudentIndex = idx);
                                      },
                                      borderRadius: BorderRadius.circular(20),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        decoration: BoxDecoration(
                                          color: isSelected ? AppColors.primary : Colors.white.withValues(alpha: 0.92),
                                          borderRadius: BorderRadius.circular(20),
                                          boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2))],
                                          border: Border.all(
                                            color: isSelected ? AppColors.primary : Colors.white,
                                            width: 1.5,
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            CircleAvatar(
                                              radius: 10,
                                              backgroundColor: isSelected ? Colors.white : avatarColor,
                                              child: Text(
                                                s.studentName.isNotEmpty ? s.studentName[0] : 'S',
                                                style: TextStyle(
                                                  color: isSelected ? AppColors.primary : Colors.white,
                                                  fontSize: 10,
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
                                                color: isSelected ? Colors.white : AppColors.textPrimary,
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
                  ),
                ),

                // 3. Floating Quick Action Buttons on Map (Right Side)
                Positioned(
                  bottom: _showCommuteDetails ? 230 : 84,
                  right: 14,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Dispatcher Contact FAB
                      FloatingActionButton.small(
                        heroTag: 'fab_dispatcher',
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        tooltip: 'Contact Dispatcher (Call/SMS/Chat)',
                        onPressed: () => _openDispatcherContactSheet(context, activeCommute),
                        child: const Icon(Icons.support_agent_rounded, size: 20),
                      ),
                      const SizedBox(height: 8),
                      // Toggle Commute Detail FAB
                      FloatingActionButton.small(
                        heroTag: 'fab_toggle_details',
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.textPrimary,
                        tooltip: _showCommuteDetails ? 'Hide Commute Card' : 'Show Commute Card',
                        onPressed: () => setState(() => _showCommuteDetails = !_showCommuteDetails),
                        child: Icon(
                          _showCommuteDetails ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                          size: 18,
                        ),
                      ),
                    ],
                  ),
                ),

                // 4. Mobile Commute Detail: Draggable Sheet or Collapsed Pill
                if (_showCommuteDetails)
                  _buildDraggableBottomSheet(context, activeCommute)
                else
                  _buildCollapsedCommutePill(context, activeCommute),
              ],
            ),
    );
  }

  Widget _buildCollapsedCommutePill(BuildContext context, ParentStudentCommute commute) {
    return Positioned(
      bottom: 24,
      left: 16,
      right: 16,
      child: SafeArea(
        child: Center(
          child: Material(
            elevation: 10,
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(30),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.directions_bus_rounded, color: Color(0xFFFBBF24), size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Bus #${commute.busUnitNumber.isNotEmpty ? commute.busUnitNumber : '42'} • ETA: ${commute.estimatedTime}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(width: 10),
                  InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => setState(() => _showCommuteDetails = true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('Expand Details', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                          SizedBox(width: 2),
                          Icon(Icons.keyboard_arrow_up_rounded, color: Colors.white, size: 16),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDraggableBottomSheet(BuildContext context, ParentStudentCommute commute) {
    return DraggableScrollableSheet(
      initialChildSize: 0.32,
      minChildSize: 0.20,
      maxChildSize: 0.42,
      builder: (context, scrollController) {
        return Material(
          color: Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          elevation: 12,
          clipBehavior: Clip.antiAlias,
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
            children: [
              // Grab Handle Row with Hide Button
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const SizedBox(width: 48), // Balance spacing
                  Container(
                    width: 44,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => setState(() => _showCommuteDetails = false),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('Hide', style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.bold)),
                          SizedBox(width: 2),
                          Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: AppColors.textSecondary),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Option A: Live Flow Hero Card (with Call Driver & Absent Shortcut)
              EtaCardWidget(
                commute: commute,
                onCallDriver: () => _callDriver(commute),
                onReportAbsent: () => _showQuickAbsentDialog(context, commute),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _callDriver(ParentStudentCommute commute) async {
    const defaultDriverPhone = '+16135550199';
    final uri = Uri.parse('tel:$defaultDriverPhone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Calling Driver: ${commute.driverName.isNotEmpty ? commute.driverName : 'Assigned Driver'} ($defaultDriverPhone)'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showQuickAbsentDialog(BuildContext context, ParentStudentCommute commute) {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final tomorrowStr = '${tomorrow.year.toString().padLeft(4, '0')}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}';
    final now = DateTime.now();
    final todayStr = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.event_busy_rounded, color: AppColors.error, size: 22),
                    const SizedBox(width: 8),
                    Text(
                      'Report Absence: ${commute.studentName}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Select the date your child will not ride the school bus:',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                // 1. Absent Tomorrow (First priority)
                ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFFEF2F2),
                    child: Icon(Icons.event_busy_rounded, color: AppColors.error, size: 20),
                  ),
                  title: const Text('Absent Tomorrow', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  subtitle: Text('$tomorrowStr • Full day (AM & PM)', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                  onTap: () {
                    Navigator.pop(ctx);
                    _confirmAndSubmitAbsence(commute, date: tomorrowStr, shiftType: 'ALL', dateLabel: 'tomorrow');
                  },
                ),
                const SizedBox(height: 8),
                // 2. Absent Today
                ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFFEF2F2),
                    child: Icon(Icons.today_rounded, color: AppColors.error, size: 20),
                  ),
                  title: const Text('Absent Today', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  subtitle: Text('$todayStr • Immediate notice', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                  onTap: () {
                    Navigator.pop(ctx);
                    _confirmAndSubmitAbsence(commute, date: todayStr, shiftType: 'ALL', dateLabel: 'today');
                  },
                ),
                const SizedBox(height: 8),
                // 3. Custom Date / Shift
                ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFF1F5F9),
                    child: Icon(Icons.calendar_month_rounded, color: AppColors.primary, size: 20),
                  ),
                  title: const Text('Specify Date / AM or PM', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  subtitle: const Text('Pick another date or single run only', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                  onTap: () {
                    Navigator.pop(ctx);
                    _openDispatcherContactSheet(context, commute, autoOpenCustomAbsence: true);
                  },
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _confirmAndSubmitAbsence(
    ParentStudentCommute commute, {
    required String date,
    required String shiftType,
    required String dateLabel,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 24),
            SizedBox(width: 8),
            Text('Confirm Absence', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'Are you sure you want to report ${commute.studentName} as absent for $dateLabel ($date)?\n\nThis will notify the bus driver and dispatcher not to pick up your child.',
          style: const TextStyle(fontSize: 14, height: 1.4, color: AppColors.textPrimary),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          OutlinedButton(
            onPressed: () => Navigator.pop(ctx),
            style: OutlinedButton.styleFrom(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await widget.apiClient.recordStudentAbsence(
                  date: date,
                  studentId: commute.studentId,
                  studentName: commute.studentName,
                  schoolName: commute.schoolName,
                  routeNo: commute.routeNo,
                  shiftType: shiftType,
                  reason: 'Parent reported via mobile app',
                  reportedBy: widget.contact,
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('✓ Absence confirmed for ${commute.studentName} ($dateLabel). Driver and dispatch notified.'),
                      backgroundColor: AppColors.success,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Error: ${e.toString().replaceAll('Exception: ', '')}'),
                      backgroundColor: AppColors.error,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
