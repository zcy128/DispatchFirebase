import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_client.dart';
import '../../core/theme.dart';
import '../auth/login_page.dart';
import '../dispatch/presentation/dispatch_page.dart';
import '../route/bloc/route_bloc.dart';
import '../route/bloc/route_event.dart';
import '../route/repository/route_repository.dart';
import '../route/presentation/route_tab.dart';
import '../forms/bloc/time_off_bloc.dart';
import '../forms/bloc/time_off_event.dart';
import '../forms/repository/time_off_repository.dart';
import '../forms/presentation/forms_tab.dart';
import '../pretrip/bloc/pretrip_bloc.dart';
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
import '../company_contacts/presentation/company_contacts_page.dart';
import 'presentation/widgets/dashboard_tab.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../core/services/device_token_service.dart';

class DriverHomePage extends StatefulWidget {
  final String username;
  final String role;
  final String employeeId;
  final int initialTab;

  const DriverHomePage({
    super.key,
    required this.username,
    this.role = 'Driver',
    this.employeeId = '',
    this.initialTab = 0,
  });

  @override
  State<DriverHomePage> createState() => _DriverHomePageState();
}

class _DriverHomePageState extends State<DriverHomePage> {
  late int _currentIndex;
  int _formsSectionIndex = 0; // 0 = Forms & Safety, 1 = Timesheet & Payroll

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialTab.clamp(0, 3);
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
    final provided = widget.employeeId.trim();
    if (provided.isNotEmpty) return provided;
    return RouteRepository.resolveEmployeeId(widget.username);
  }

  void _onTabSelected(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  void _openFormsSection(int sectionIndex) {
    setState(() {
      _currentIndex = 3;
      _formsSectionIndex = sectionIndex;
    });
  }

  void _onFormsSectionChanged(int sectionIndex) {
    setState(() {
      _formsSectionIndex = sectionIndex;
    });
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
        formsSectionIndex: _formsSectionIndex,
        onTabSelected: _onTabSelected,
        onOpenFormsSection: _openFormsSection,
        onFormsSectionChanged: _onFormsSectionChanged,
      ),
    );
  }
}

class _DriverHomePageBody extends StatelessWidget {
  final String username;
  final String role;
  final String driverId;
  final int currentIndex;
  final int formsSectionIndex;
  final ValueChanged<int> onTabSelected;
  final ValueChanged<int> onOpenFormsSection;
  final ValueChanged<int> onFormsSectionChanged;

  const _DriverHomePageBody({
    required this.username,
    required this.role,
    required this.driverId,
    required this.currentIndex,
    required this.formsSectionIndex,
    required this.onTabSelected,
    required this.onOpenFormsSection,
    required this.onFormsSectionChanged,
  });

  void _openChat(BuildContext context) {
    ChatNotificationService().clearAllUnread();
    final chatRepo = context.read<ChatRepository>();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatChannelsPage(
          driverId: driverId,
          driverName: username,
          repository: chatRepo,
        ),
      ),
    );
  }

  void _openCompanyContacts(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const CompanyContactsPage(),
      ),
    );
  }

  Widget _buildChatActionButton(BuildContext context) {
    return IconButton(
      tooltip: 'Operations Chat',
      onPressed: () => _openChat(context),
      icon: ValueListenableBuilder<int>(
        valueListenable: ChatNotificationService().unreadCountNotifier,
        builder: (context, unreadCount, child) {
          return Badge(
            isLabelVisible: unreadCount > 0,
            label: Text('$unreadCount'),
            child: const Icon(
              Icons.chat_bubble_outline_rounded,
              color: AppColors.primary,
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      // When on Dispatch tab (index 1), page has its own specialized AppBar
      appBar: currentIndex == 1 ? null : _buildAppBar(context, isDark),
      body: IndexedStack(
        index: currentIndex,
        children: [
          DashboardTab(
            driverId: driverId,
            username: username,
            role: role,
            onTabSelected: onTabSelected,
            onOpenFormsSection: onOpenFormsSection,
            onOpenChat: () => _openChat(context),
            onOpenCompanyContacts: () => _openCompanyContacts(context),
          ),
          DispatchPage(
            driverId: driverId,
            isActive: currentIndex == 1,
            onOpenChat: () => _openChat(context),
          ),
          RouteTab(driverId: driverId),
          FormsTab(
            driverId: driverId,
            driverName: username,
            role: role,
            sectionIndex: formsSectionIndex,
            onSectionChanged: onFormsSectionChanged,
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
          items: const [
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
              icon: Icon(Icons.assignment_outlined),
              activeIcon: Icon(Icons.assignment_rounded),
              label: 'Forms / Work',
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
            tooltip: 'Company Contacts',
            icon: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primary),
            onPressed: () => _openCompanyContacts(context),
          ),
          _buildChatActionButton(context),
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
            Text(
              formsSectionIndex == 1 ? 'Bi-Weekly Timesheet' : 'Forms & Work Hub',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            Text(
              formsSectionIndex == 1
                  ? 'Synchronized Payroll Wages, Hours & Daily Shifts'
                  : 'Inspections, Incidents, Leave & Timesheet',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
        actions: [
          if (formsSectionIndex == 0)
            IconButton(
              tooltip: 'Refresh Requests',
              icon: const Icon(Icons.sync_rounded, color: AppColors.primary),
              onPressed: () {
                context.read<TimeOffBloc>().add(LoadTimeOffRequestsEvent(driverId));
              },
            ),
          IconButton(
            tooltip: 'Company Contacts',
            icon: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primary),
            onPressed: () => _openCompanyContacts(context),
          ),
          _buildChatActionButton(context),
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
          tooltip: 'Company Contacts',
          icon: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primary),
          onPressed: () => _openCompanyContacts(context),
        ),
        _buildChatActionButton(context),
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

  Future<void> _signOut(BuildContext context) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('driver_auth_token');
      AuthenticatedHttpClient.setToken(null);
      await prefs.remove('driver_saved_employee_id');
      await prefs.remove('driver_saved_display_name');
      await prefs.remove('driver_saved_username');
      await prefs.remove('driver_saved_overrides');
    } catch (_) {}
    if (!context.mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginPage()),
    );
  }
}
