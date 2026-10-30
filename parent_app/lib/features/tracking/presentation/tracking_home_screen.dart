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
import '../../schedule/presentation/schedule_screen.dart';
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
  int _currentTabIndex = 0;
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

    if (activeCommute == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Text(
            'No active student commute found.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: IndexedStack(
        index: _currentTabIndex,
        children: [
          // Tab 0: 🏠 Bento (Live Dispatch Tracking)
          _buildLiveBentoTab(context, activeCommute, isRegistered),

          // Tab 1: 📅 Schedule (Route Master Weekly Plan)
          ScheduleScreen(
            students: widget.students,
            initialStudentIndex: _selectedStudentIndex,
            onStudentChanged: (idx) => setState(() => _selectedStudentIndex = idx),
            onReportAbsent: (commute) => _showQuickAbsentDialog(context, commute),
            onSwitchToLiveBento: () => setState(() => _currentTabIndex = 0),
          ),

          // Tab 2: 📞 Support (Dispatch Operations Desk)
          DispatcherContactSheet(
            commute: activeCommute,
            allStudents: widget.students,
            parentContact: widget.contact,
            apiClient: widget.apiClient,
            isTabMode: true,
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNavigationBar(),
    );
  }

  Widget _buildLiveBentoTab(BuildContext context, ParentStudentCommute activeCommute, bool isRegistered) {
    return Stack(
      children: [
        // 1. Full-Screen Interactive Live Map
        Positioned.fill(
          child: BusMapWidget(commute: activeCommute),
        ),

        // 2. Floating Top Header & Student Selector (Bento Dark Glass)
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
                  // Top App Bar Bento Card
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: AppColors.surface.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border, width: 1.2),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x3D000000),
                          blurRadius: 16,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceMuted,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.asset(
                              'assets/images/pcy_tech_app_icon.jpg',
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => const Icon(
                                Icons.directions_bus_rounded,
                                size: 20,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _firstName,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                  letterSpacing: -0.2,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 1),
                              const Text(
                                'Family Transit Safe Guard',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: AppColors.secondary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Direct Report Absence Shortcut
                        IconButton(
                          icon: const Icon(Icons.event_busy_rounded, size: 20, color: AppColors.coral),
                          tooltip: 'Report Absence',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          onPressed: () => _openDispatcherContactSheet(context, activeCommute, autoOpenCustomAbsence: true),
                        ),
                        // Profile & Address Shortcut
                        IconButton(
                          icon: const Icon(Icons.person_outline_rounded, size: 21, color: AppColors.lavender),
                          tooltip: 'My Profile & Address',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          onPressed: () => _openEditProfileSheet(context),
                        ),
                        // SMS Hotline Shortcut
                        IconButton(
                          icon: const Icon(Icons.sms_outlined, size: 20, color: AppColors.primary),
                          tooltip: 'SMS Hotline Guide',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          onPressed: () {
                            showDialog(context: context, builder: (_) => const SmsGuideModal());
                          },
                        ),
                        // More Popup
                        PopupMenuButton<String>(
                          icon: const Icon(Icons.more_vert_rounded, size: 20, color: AppColors.textSecondary),
                          color: AppColors.surface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: const BorderSide(color: AppColors.border),
                          ),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          onSelected: (val) {
                            if (val == 'dispatch') {
                              setState(() => _currentTabIndex = 2);
                            } else if (val == 'schedule') {
                              setState(() => _currentTabIndex = 1);
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
                              value: 'schedule',
                              child: Row(
                                children: [
                                  Icon(Icons.calendar_month_rounded, size: 18, color: AppColors.primary),
                                  SizedBox(width: 8),
                                  Text('Route Schedule & Timetable', style: TextStyle(color: AppColors.textPrimary)),
                                ],
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'dispatch',
                              child: Row(
                                children: [
                                  Icon(Icons.support_agent_rounded, size: 18, color: AppColors.primary),
                                  SizedBox(width: 8),
                                  Text('Contact Dispatcher', style: TextStyle(color: AppColors.textPrimary)),
                                ],
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'profile',
                              child: Row(
                                children: [
                                  Icon(Icons.person_outline_rounded, size: 18, color: AppColors.lavender),
                                  SizedBox(width: 8),
                                  Text('Edit Profile & Address', style: TextStyle(color: AppColors.textPrimary)),
                                ],
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'absence',
                              child: Row(
                                children: [
                                  Icon(Icons.event_busy_rounded, size: 18, color: AppColors.coral),
                                  SizedBox(width: 8),
                                  Text('Report Absence', style: TextStyle(color: AppColors.coral)),
                                ],
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'alerts',
                              child: Row(
                                children: [
                                  Icon(Icons.notifications_none_rounded, size: 18, color: AppColors.textSecondary),
                                  SizedBox(width: 8),
                                  Text('Alert Preferences', style: TextStyle(color: AppColors.textPrimary)),
                                ],
                              ),
                            ),
                            if (!isRegistered)
                              const PopupMenuItem(
                                value: 'register',
                                child: Row(
                                  children: [
                                    Icon(Icons.shield_outlined, size: 18, color: AppColors.secondary),
                                    SizedBox(width: 8),
                                    Text('Save Account & Password', style: TextStyle(color: AppColors.textPrimary)),
                                  ],
                                ),
                              ),
                            const PopupMenuItem(
                              value: 'refresh',
                              child: Row(
                                children: [
                                  Icon(Icons.refresh_rounded, size: 18, color: AppColors.textSecondary),
                                  SizedBox(width: 8),
                                  Text('Refresh Live Telemetry', style: TextStyle(color: AppColors.textPrimary)),
                                ],
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'logout',
                              child: Row(
                                children: [
                                  Icon(Icons.logout_rounded, size: 18, color: AppColors.coral),
                                  SizedBox(width: 8),
                                  Text('Sign Out', style: TextStyle(color: AppColors.coral)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Multi-Student Switching Bento Carousel
                  if (widget.students.length > 1) ...[
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: List.generate(widget.students.length, (idx) {
                          final s = widget.students[idx];
                          final isSelected = idx == _selectedStudentIndex;

                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: InkWell(
                              onTap: () {
                                setState(() => _selectedStudentIndex = idx);
                              },
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                decoration: BoxDecoration(
                                  color: isSelected ? AppColors.surfaceHighlight : AppColors.surface.withValues(alpha: 0.92),
                                  borderRadius: BorderRadius.circular(20),
                                  boxShadow: const [
                                    BoxShadow(color: Color(0x33000000), blurRadius: 8, offset: Offset(0, 2)),
                                  ],
                                  border: Border.all(
                                    color: isSelected ? AppColors.primary : AppColors.border,
                                    width: isSelected ? 1.5 : 1.0,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    CircleAvatar(
                                      radius: 10,
                                      backgroundColor: isSelected ? AppColors.primary : AppColors.surfaceMuted,
                                      child: Text(
                                        s.studentName.isNotEmpty ? s.studentName[0] : 'S',
                                        style: TextStyle(
                                          color: isSelected ? const Color(0xFF0B101D) : AppColors.textSecondary,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 7),
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
          ),
        ),

        // 3. Floating Quick Action Buttons on Map (Right Side, placed safely below map controls)
        Positioned(
          top: 295,
          right: 14,
          child: FloatingActionButton.small(
            heroTag: 'fab_dispatcher',
            backgroundColor: AppColors.surface,
            foregroundColor: AppColors.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: AppColors.border, width: 1.2),
            ),
            tooltip: 'Contact Dispatcher (Call/SMS/Chat)',
            onPressed: () => setState(() => _currentTabIndex = 2),
            child: const Icon(Icons.support_agent_rounded, size: 20),
          ),
        ),

        // 4. Mobile Commute Detail: Draggable Bento Sheet or Collapsed Pill
        if (_showCommuteDetails)
          _buildDraggableBottomSheet(context, activeCommute)
        else
          _buildCollapsedCommutePill(context, activeCommute),
      ],
    );
  }

  Widget _buildBottomNavigationBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0B101D),
        border: Border(top: BorderSide(color: AppColors.border, width: 1.0)),
      ),
      child: BottomNavigationBar(
        currentIndex: _currentTabIndex,
        onTap: (idx) => setState(() => _currentTabIndex = idx),
        backgroundColor: const Color(0xFF0B101D),
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
        elevation: 0,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Padding(
              padding: EdgeInsets.only(bottom: 3),
              child: Text('🏠', style: TextStyle(fontSize: 18)),
            ),
            label: 'Bento',
          ),
          BottomNavigationBarItem(
            icon: Padding(
              padding: EdgeInsets.only(bottom: 3),
              child: Text('📅', style: TextStyle(fontSize: 18)),
            ),
            label: 'Schedule',
          ),
          BottomNavigationBarItem(
            icon: Padding(
              padding: EdgeInsets.only(bottom: 3),
              child: Text('📞', style: TextStyle(fontSize: 18)),
            ),
            label: 'Support',
          ),
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
            elevation: 12,
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(30),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: AppColors.border, width: 1.2),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.directions_bus_rounded, color: AppColors.primary, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Bus #${commute.busUnitNumber.isNotEmpty ? commute.busUnitNumber : '42'} • ETA: ${commute.estimatedTime}',
                    style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
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
                          Text(
                            'Expand',
                            style: TextStyle(
                              color: Color(0xFF0B101D),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(width: 2),
                          Icon(Icons.keyboard_arrow_up_rounded, color: Color(0xFF0B101D), size: 16),
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
      initialChildSize: 0.26,
      minChildSize: 0.16,
      maxChildSize: 0.44,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Color(0x66000000),
                blurRadius: 24,
                offset: Offset(0, -6),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 16),
            children: [
              // Grab Handle Row with Hide Button
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const SizedBox(width: 48), // Balance spacing
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
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

              // Direction C: Bento Grid Hero Card
              EtaCardWidget(
                commute: commute,
                onCallDriver: () => _callDriver(commute),
                onReportAbsent: () => _showQuickAbsentDialog(context, commute),
                onContactDispatcher: () => _openDispatcherContactSheet(context, commute),
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
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            border: Border(
              top: BorderSide(color: AppColors.border, width: 1.2),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
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
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.event_busy_rounded, color: AppColors.coral, size: 22),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Report Absence: ${commute.studentName}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Select the date your child will not ride the school bus:',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                // 1. Absent Tomorrow
                ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  tileColor: AppColors.surfaceMuted,
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.coral.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.event_busy_rounded, color: AppColors.coral, size: 20),
                  ),
                  title: const Text('Absent Tomorrow', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary)),
                  subtitle: Text('$tomorrowStr • Full day (AM & PM)', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                  onTap: () {
                    Navigator.pop(ctx);
                    _confirmAndSubmitAbsence(commute, date: tomorrowStr, shiftType: 'ALL', dateLabel: 'tomorrow');
                  },
                ),
                const SizedBox(height: 10),
                // 2. Absent Today
                ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  tileColor: AppColors.surfaceMuted,
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.today_rounded, color: AppColors.primary, size: 20),
                  ),
                  title: const Text('Absent Today', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary)),
                  subtitle: Text('$todayStr • Immediate notice', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                  onTap: () {
                    Navigator.pop(ctx);
                    _confirmAndSubmitAbsence(commute, date: todayStr, shiftType: 'ALL', dateLabel: 'today');
                  },
                ),
                const SizedBox(height: 10),
                // 3. Custom Date / Shift
                ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  tileColor: AppColors.surfaceMuted,
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.lavender.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.calendar_month_rounded, color: AppColors.lavender, size: 20),
                  ),
                  title: const Text('Specify Date / AM or PM', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary)),
                  subtitle: const Text('Pick another date or single run only', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                  onTap: () {
                    Navigator.pop(ctx);
                    _openDispatcherContactSheet(context, commute, autoOpenCustomAbsence: true);
                  },
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      side: const BorderSide(color: AppColors.border),
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
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.coral, size: 24),
            SizedBox(width: 8),
            Text('Confirm Absence', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
          ],
        ),
        content: Text(
          'Are you sure you want to report ${commute.studentName} as absent for $dateLabel ($date)?\n\nThis will notify the bus driver and dispatcher not to pick up your child.',
          style: const TextStyle(fontSize: 14, height: 1.4, color: AppColors.textSecondary),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          OutlinedButton(
            onPressed: () => Navigator.pop(ctx),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
                      backgroundColor: AppColors.secondary,
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
              backgroundColor: AppColors.coral,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
