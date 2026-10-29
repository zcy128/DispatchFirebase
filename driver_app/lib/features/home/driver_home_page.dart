import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/theme.dart';
import '../auth/login_page.dart';
import '../dispatch/presentation/dispatch_page.dart';
import '../route/bloc/route_bloc.dart';
import '../route/bloc/route_event.dart';
import '../route/bloc/route_state.dart';
import '../route/repository/route_repository.dart';
import '../route/presentation/route_tab.dart';
import '../forms/bloc/time_off_bloc.dart';
import '../forms/bloc/time_off_event.dart';
import '../forms/repository/time_off_repository.dart';
import '../forms/presentation/forms_tab.dart';
import '../pretrip/bloc/pretrip_bloc.dart';
import '../pretrip/bloc/pretrip_event.dart';
import '../pretrip/bloc/pretrip_state.dart';
import '../pretrip/repository/pretrip_repository.dart';
import '../defect/bloc/defect_bloc.dart';
import '../defect/bloc/defect_event.dart';
import '../defect/repository/defect_repository.dart';
import '../student_incident/bloc/student_incident_bloc.dart';
import '../student_incident/bloc/student_incident_event.dart';
import '../student_incident/repository/student_incident_repository.dart';
import '../expense_reimbursement/bloc/expense_reimbursement_bloc.dart';
import '../expense_reimbursement/bloc/expense_reimbursement_event.dart';
import '../expense_reimbursement/repository/expense_reimbursement_repository.dart';
import '../hazard_report/bloc/hazard_report_bloc.dart';
import '../hazard_report/bloc/hazard_report_event.dart';
import '../hazard_report/repository/hazard_report_repository.dart';
import '../route_assessment/bloc/route_assessment_bloc.dart';
import '../route_assessment/bloc/route_assessment_event.dart';
import '../route_assessment/repository/route_assessment_repository.dart';
import '../vehicle_signout/bloc/vehicle_signout_bloc.dart';
import '../vehicle_signout/bloc/vehicle_signout_event.dart';
import '../vehicle_signout/repository/vehicle_signout_repository.dart';
import '../chat/repository/chat_repository.dart';
import '../chat/presentation/chat_channels_page.dart';
import '../chat/services/chat_notification_service.dart';
import '../route_openings/route_openings_page.dart';
import '../charter/models/charter_model.dart';
import '../charter/repository/charter_repository.dart';
import '../charter/presentation/charter_trip_card.dart';
import '../charter/presentation/available_charters_sheet.dart';
import '../timesheet/presentation/timesheet_page.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../core/services/device_token_service.dart';

class DriverHomePage extends StatefulWidget {
  final String username;
  final String role;
  final int initialTab;

  const DriverHomePage({
    super.key,
    required this.username,
    this.role = 'Driver',
    this.initialTab = 0,
  });

  @override
  State<DriverHomePage> createState() => _DriverHomePageState();
}

class _DriverHomePageState extends State<DriverHomePage> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialTab;
    DeviceTokenService().initializeForEmployee(
      employeeId: _resolvedDriverId,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ChatNotificationService().startListening(
          driverId: _resolvedDriverId,
          repository: context.read<ChatRepository>(),
        );
      }
    });
  }

  @override
  void dispose() {
    ChatNotificationService().stopListening();
    super.dispose();
  }

  String get _resolvedDriverId {
    return RouteRepository.resolveEmployeeId(widget.username);
  }

  void _onTabSelected(int index) {
    setState(() {
      _currentIndex = index;
    });
    if (index == 5) {
      ChatNotificationService().clearAllUnread();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<RouteBloc>(
          create: (context) => RouteBloc(
            repository: context.read<RouteRepository>(),
          )..add(LoadRouteEvent(_resolvedDriverId)),
        ),
        BlocProvider<TimeOffBloc>(
          create: (context) => TimeOffBloc(
            repository: context.read<TimeOffRepository>(),
          )..add(LoadTimeOffRequestsEvent(_resolvedDriverId)),
        ),
        BlocProvider<PreTripBloc>(
          create: (context) => PreTripBloc(
            repository: context.read<PreTripRepository>(),
          ),
        ),
        BlocProvider<DefectBloc>(
          create: (context) => DefectBloc(
            repository: context.read<DefectRepository>(),
          )..add(WatchDefectsStarted(driverId: _resolvedDriverId)),
        ),
        BlocProvider<StudentIncidentBloc>(
          create: (context) => StudentIncidentBloc(
            repository: context.read<StudentIncidentRepository>(),
          )..add(LoadStudentIncidents(driverId: _resolvedDriverId)),
        ),
        BlocProvider<ExpenseReimbursementBloc>(
          create: (context) => ExpenseReimbursementBloc(
            repository: context.read<ExpenseReimbursementRepository>(),
          )..add(LoadExpenseClaims(employeeId: _resolvedDriverId)),
        ),
        BlocProvider<HazardReportBloc>(
          create: (context) => HazardReportBloc(
            repository: context.read<HazardReportRepository>(),
          )..add(LoadHazardReports(employeeId: _resolvedDriverId)),
        ),
        BlocProvider<RouteAssessmentBloc>(
          create: (context) => RouteAssessmentBloc(
            repository: context.read<RouteAssessmentRepository>(),
          )..add(LoadRouteAssessments(employeeId: _resolvedDriverId)),
        ),
        BlocProvider<VehicleSignoutBloc>(
          create: (context) => VehicleSignoutBloc(
            repository: context.read<VehicleSignoutRepository>(),
          )..add(const LoadVehicleSignouts()),
        ),
      ],
      child: _DriverHomePageBody(
        username: widget.username,
        role: widget.role,
        driverId: _resolvedDriverId,
        currentIndex: _currentIndex,
        onTabSelected: _onTabSelected,
      ),
    );
  }
}


class _DriverHomePageBody extends StatelessWidget {
  final String username;
  final String role;
  final String driverId;
  final int currentIndex;
  final ValueChanged<int> onTabSelected;

  const _DriverHomePageBody({
    required this.username,
    required this.role,
    required this.driverId,
    required this.currentIndex,
    required this.onTabSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      // When on Dispatch tab (index 1) or Chat tab (index 5), page has its own specialized AppBar
      appBar: (currentIndex == 1 || currentIndex == 5) ? null : _buildAppBar(context, isDark),
      body: IndexedStack(
        index: currentIndex,
        children: [
          _buildDashboardTab(context, isDark),
          DispatchPage(driverId: driverId),
          RouteTab(driverId: driverId),
          TimesheetPage(driverId: driverId, driverName: username, role: role),
          FormsTab(driverId: driverId, driverName: username, role: role),
          ChatChannelsPage(
            driverId: driverId,
            driverName: username,
            repository: context.read<ChatRepository>(),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
              width: 1,
            ),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: onTabSelected,
          backgroundColor: isDark ? AppColors.darkCard : Colors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: isDark ? Colors.grey.shade500 : Colors.grey.shade600,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          type: BottomNavigationBarType.fixed,
          items: [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard_rounded),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.assignment_turned_in_outlined),
              activeIcon: Icon(Icons.assignment_turned_in_rounded),
              label: 'Dispatch',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.alt_route_outlined),
              activeIcon: Icon(Icons.alt_route_rounded),
              label: 'My Route',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_outlined),
              activeIcon: Icon(Icons.receipt_long_rounded),
              label: 'Timesheet',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.assignment_outlined),
              activeIcon: Icon(Icons.assignment_rounded),
              label: 'Forms',
            ),
            BottomNavigationBarItem(
              icon: ValueListenableBuilder<int>(
                valueListenable: ChatNotificationService().unreadCountNotifier,
                builder: (context, unreadCount, child) {
                  return Badge(
                    isLabelVisible: unreadCount > 0,
                    label: Text('$unreadCount'),
                    child: const Icon(Icons.chat_bubble_outline_rounded),
                  );
                },
              ),
              activeIcon: ValueListenableBuilder<int>(
                valueListenable: ChatNotificationService().unreadCountNotifier,
                builder: (context, unreadCount, child) {
                  return Badge(
                    isLabelVisible: unreadCount > 0,
                    label: Text('$unreadCount'),
                    child: const Icon(Icons.chat_bubble_rounded),
                  );
                },
              ),
              label: 'Chat',
            ),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, bool isDark) {
    if (currentIndex == 2) {
      return AppBar(
        elevation: 0,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Assigned Route Details',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            Text(
              'Sequential Stops & Student Manifest',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Sync Route & Stop Times',
            icon: const Icon(Icons.sync_rounded, color: AppColors.primary),
            onPressed: () {
              context.read<RouteBloc>().add(LoadRouteEvent(driverId));
            },
          ),
          IconButton(
            tooltip: 'Sign Out',
            icon: const Icon(Icons.logout_rounded, color: AppColors.error),
            onPressed: () => _signOut(context),
          ),
        ],
      );
    }

    if (currentIndex == 3) {
      return AppBar(
        elevation: 0,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Bi-Weekly Timesheet',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            Text(
              'Synchronized Payroll Wages, Hours & Daily Shifts',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Sign Out',
            icon: const Icon(Icons.logout_rounded, color: AppColors.error),
            onPressed: () => _signOut(context),
          ),
        ],
      );
    }

    if (currentIndex == 4) {
      return AppBar(
        elevation: 0,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Forms & Requests',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            Text(
              'Time-Off & Leave Applications',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh Requests',
            icon: const Icon(Icons.sync_rounded, color: AppColors.primary),
            onPressed: () {
              context.read<TimeOffBloc>().add(LoadTimeOffRequestsEvent(driverId));
            },
          ),
          IconButton(
            tooltip: 'Sign Out',
            icon: const Icon(Icons.logout_rounded, color: AppColors.error),
            onPressed: () => _signOut(context),
          ),
        ],
      );
    }

    return AppBar(
      backgroundColor: isDark ? AppColors.darkCard : Colors.white,
      elevation: 0,
      title: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              image: const DecorationImage(
                image: AssetImage('assets/images/app_icon.png'),
                fit: BoxFit.cover,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'PCY Tech Driver Hub',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              Text(
                'Fleet Operations Terminal',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
        ],
      ),
      actions: [
        IconButton(
          tooltip: 'Notification Settings',
          icon: const Icon(Icons.notifications_active_outlined, color: AppColors.primary),
          onPressed: () => _showNotificationDialog(context),
        ),
        IconButton(
          tooltip: 'Sign Out',
          icon: const Icon(Icons.logout_rounded, color: AppColors.error),
          onPressed: () => _signOut(context),
        ),
      ],
    );
  }

  void _showNotificationDialog(BuildContext context) async {
    final status = await DeviceTokenService().getPermissionStatus();
    final isAuthorized = (status == AuthorizationStatus.authorized || status == AuthorizationStatus.provisional);
    final isDenied = (status == AuthorizationStatus.denied);

    if (!context.mounted) return;

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Row(
          children: [
            Icon(
              isAuthorized ? Icons.check_circle_rounded : Icons.notifications_active_rounded,
              color: isAuthorized ? AppColors.success : AppColors.primary,
            ),
            const SizedBox(width: 8),
            const Text('Push Notifications', style: TextStyle(fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isAuthorized
                  ? 'Notifications are enabled on this device. You will receive automatic check-in reminders and urgent dispatch notices.'
                  : isDenied
                      ? 'Notifications are currently blocked by your browser. To unblock:\n\n1. Click the site settings icon to the left of the URL in your address bar.\n2. Change Notifications to "Allow".\n3. Refresh this page.'
                      : 'Allow browser notifications so you never miss scheduled check-in reminders or critical route dispatches.',
              style: const TextStyle(fontSize: 13, height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Close'),
          ),
          if (!isAuthorized && !isDenied)
            ElevatedButton.icon(
              onPressed: () async {
                Navigator.of(dialogCtx).pop();
                await DeviceTokenService().initializeForEmployee(employeeId: driverId);
              },
              icon: const Icon(Icons.check, size: 16),
              label: const Text('Enable Now'),
            ),
        ],
      ),
    );
  }

  void _signOut(BuildContext context) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginPage()),
    );
  }

  Widget _buildDashboardTab(BuildContext context, bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Driver Profile Card
          _buildProfileCard(context, isDark),
          const SizedBox(height: 24),

          // Assigned Charter Trips Section (Live Stream)
          _buildAssignedCharterSection(context, isDark),

          // Active Shift / Route Card Header
          Row(
            children: [
              const Text(
                'TODAY\'S ASSIGNED RUN',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: AppColors.primary,
                ),
              ),
              const Spacer(),
              BlocBuilder<RouteBloc, RouteState>(
                builder: (context, state) {
                  if (state is RouteLoaded && state.isAssigned && state.route != null) {
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: AppColors.success,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'LIVE',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppColors.success,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
            ],
          ),
          const SizedBox(height: 10),
          _buildAssignedRunCard(context, isDark),
          const SizedBox(height: 12),

          // Pre-Trip Inspection Reminder (shown when driver has a dispatch)
          _buildPreTripReminderBanner(context, isDark),
          const SizedBox(height: 24),


          // Quick Access Navigation Tiles
          const Text(
            'QUICK SHORTCUTS',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 10),
          _buildShortcutTile(
            context: context,
            isDark: isDark,
            icon: Icons.receipt_long_rounded,
            iconColor: AppColors.primary,
            title: 'Bi-Weekly Timesheet & Payroll',
            subtitle: 'View 2-week wages, EI hours & daily dispatch shift breakdown',
            onTap: () => onTabSelected(3),
          ),
          const SizedBox(height: 12),
          _buildShortcutTile(
            context: context,
            isDark: isDark,
            icon: Icons.alt_route_rounded,
            iconColor: AppColors.primary,
            title: 'Assigned Route & Stops',
            subtitle: 'View turn-by-turn stop sequence, pullaway times & roster',
            onTap: () => onTabSelected(2),
          ),
          const SizedBox(height: 12),
          _buildShortcutTile(
            context: context,
            isDark: isDark,
            icon: Icons.event_available_rounded,
            iconColor: AppColors.success,
            title: 'Daily Attendance & Check-in',
            subtitle: 'Mark student pickups, drop-offs, absences & bulk arrival',
            onTap: () => onTabSelected(1),
          ),
          const SizedBox(height: 12),
          _buildShortcutTile(
            context: context,
            isDark: isDark,
            icon: Icons.chat_bubble_rounded,
            iconColor: Colors.amber,
            title: 'Fleet & Dispatch Chat',
            subtitle: 'Real-time communication with Dispatch, Payroll & Yard Crew',
            onTap: () => onTabSelected(5),
          ),
          const SizedBox(height: 12),
          _buildShortcutTile(
            context: context,
            isDark: isDark,
            icon: Icons.campaign_rounded,
            iconColor: AppColors.info,
            title: 'Route Openings & Shift Bidding',
            subtitle: 'Preview sanitized route stops and apply for open runs',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => RouteOpeningsPage(
                    driverId: driverId,
                    driverName: username,
                    role: role,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          _buildShortcutTile(
            context: context,
            isDark: isDark,
            icon: Icons.airport_shuttle_rounded,
            iconColor: Colors.deepOrangeAccent,
            title: 'Charter & Field Trips',
            subtitle: 'Browse and self-assign available charter runs or view assignments',
            onTap: () {
              AvailableChartersSheet.show(
                context,
                driverId: driverId,
                username: username,
                role: role,
                repository: context.read<CharterRepository>(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAssignedCharterSection(BuildContext context, bool isDark) {
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

  Widget _buildPreTripReminderBanner(BuildContext context, bool isDark) {
    return BlocBuilder<RouteBloc, RouteState>(
      builder: (context, routeState) {
        if (routeState is! RouteLoaded ||
            !routeState.isAssigned ||
            routeState.route == null) {
          return const SizedBox.shrink();
        }
        final vehicleUnit = routeState.route!.vehicleUnit;
        if (vehicleUnit.isEmpty) return const SizedBox.shrink();

        final today = DateTime.now();
        final dateStr =
            '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

        // Trigger load on first build with this vehicle unit
        final bloc = context.read<PreTripBloc>();
        final preTripState = bloc.state;
        if (preTripState is PreTripInitial) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (bloc.state is PreTripInitial) {
              bloc.add(LoadPreTripStatusEvent(
                vehicleUnit: vehicleUnit,
                date: dateStr,
              ));
            }
          });
        }

        return BlocBuilder<PreTripBloc, PreTripState>(
          builder: (context, preTripState) {
            if (preTripState is PreTripLoading) {
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkCard : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: isDark
                          ? AppColors.darkCardBorder
                          : AppColors.lightCardBorder),
                ),
                child: const Row(
                  children: [
                    SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.primary)),
                    SizedBox(width: 10),
                    Text('Checking pre-trip inspection status...',
                        style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              );
            }

            if (preTripState is PreTripStatusLoaded) {
              if (preTripState.isInspectedToday) {
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: AppColors.success.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_rounded,
                          color: AppColors.success, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Pre-trip inspection complete for Bus #$vehicleUnit',
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: AppColors.success),
                        ),
                      ),
                    ],
                  ),
                );
              } else {
                return InkWell(
                  onTap: () => onTabSelected(4),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.warning.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded,
                            color: AppColors.warning, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Pre-trip inspection required for Bus #$vehicleUnit',
                                style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.warning),
                              ),
                              const Text(
                                'Tap to complete inspection in Forms tab',
                                style: TextStyle(
                                    fontSize: 11, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded,
                            color: Colors.grey, size: 18),
                      ],
                    ),
                  ),
                );
              }
            }

            return const SizedBox.shrink();
          },
        );
      },
    );
  }

  Widget _buildShortcutTile({
    required BuildContext context,
    required bool isDark,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCard : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.grey),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileCard(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.primary.withValues(alpha: 0.2),
            child: Text(
              username.isNotEmpty ? username[0].toUpperCase() : 'D',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  username,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        role.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: BlocBuilder<RouteBloc, RouteState>(
                        builder: (context, state) {
                          if (state is RouteLoaded && state.route != null) {
                            final r = state.route!;
                            return Text(
                              '${r.yardName} · Bus #${r.vehicleUnit}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                              overflow: TextOverflow.ellipsis,
                            );
                          }
                          return const Text(
                            'Fleet Operations Hub',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                            ),
                            overflow: TextOverflow.ellipsis,
                          );
                        },
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

  Widget _buildAssignedRunCard(BuildContext context, bool isDark) {
    return BlocBuilder<RouteBloc, RouteState>(
      builder: (context, state) {
        if (state is RouteLoading) {
          return Container(
            height: 160,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
              ),
            ),
            child: const CircularProgressIndicator(color: AppColors.primary),
          );
        }

        if (state is RouteLoaded && state.isAssigned && state.route != null) {
          final route = state.route!;
          final amShift = route.shifts.where((s) => s.shiftType == 'AM').firstOrNull ??
              route.shifts.firstOrNull;
          final departureTime = amShift?.firstStopTime.isNotEmpty == true
              ? amShift!.firstStopTime
              : '07:30 AM';
          final runDescription = amShift != null
              ? '${amShift.shiftName} (${amShift.runDays})'
              : route.routeName;

          return Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withValues(alpha: 0.15),
                  isDark ? AppColors.darkCard : Colors.white,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.3),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Route ${route.routeNo}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'ON SCHEDULE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.success,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  runDescription,
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _StatColumn(title: 'Stops', value: '${route.totalStops}'),
                    _StatColumn(title: 'Students', value: '${route.totalUniqueStudents}'),
                    _StatColumn(title: 'Departure', value: departureTime),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => onTabSelected(1),
                        icon: const Icon(Icons.assignment_turned_in_rounded, size: 18),
                        label: const Text('Daily Dispatch'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: const Color(0xFF0F172A),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => onTabSelected(2),
                        icon: const Icon(Icons.alt_route_rounded, size: 18),
                        label: const Text('Route Stops'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        }

        // Unassigned or empty state
        return Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Icon(Icons.alt_route_rounded, size: 36, color: Colors.grey),
              const SizedBox(height: 10),
              const Text(
                'No Route Assigned',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              const Text(
                'When dispatch assigns a route to your profile, details will appear here automatically.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: () => onTabSelected(2),
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Check Assignments'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}


class _StatColumn extends StatelessWidget {
  final String title;
  final String value;

  const _StatColumn({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 2),
        Text(
          title,
          style: const TextStyle(fontSize: 11, color: Colors.grey),
        ),
      ],
    );
  }
}
