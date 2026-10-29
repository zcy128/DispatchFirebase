import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/time_off_bloc.dart';
import '../bloc/time_off_event.dart';
import '../bloc/time_off_state.dart';
import '../models/time_off_model.dart';
import 'create_leave_request_dialog.dart';
import 'time_off_page.dart';
import '../../pretrip/presentation/pretrip_status_card.dart';
import '../../defect/bloc/defect_bloc.dart';
import '../../defect/bloc/defect_event.dart';
import '../../defect/presentation/defect_summary_card.dart';
import '../../student_incident/bloc/student_incident_bloc.dart';
import '../../student_incident/bloc/student_incident_event.dart';
import '../../student_incident/presentation/student_incident_summary_card.dart';
import '../../expense_reimbursement/bloc/expense_reimbursement_bloc.dart';
import '../../expense_reimbursement/bloc/expense_reimbursement_event.dart';
import '../../expense_reimbursement/presentation/expense_summary_card.dart';
import '../../hazard_report/bloc/hazard_report_bloc.dart';
import '../../hazard_report/bloc/hazard_report_event.dart';
import '../../hazard_report/presentation/hazard_summary_card.dart';
import '../../route_assessment/bloc/route_assessment_bloc.dart';
import '../../route_assessment/bloc/route_assessment_event.dart';
import '../../route_assessment/presentation/route_assessment_summary_card.dart';
import '../../vehicle_signout/bloc/vehicle_signout_bloc.dart';
import '../../vehicle_signout/bloc/vehicle_signout_event.dart';
import '../../vehicle_signout/presentation/vehicle_signout_summary_card.dart';
import '../../route/bloc/route_bloc.dart';
import '../../route/bloc/route_state.dart';
import '../../timesheet/presentation/timesheet_page.dart';
import '../../company_contacts/presentation/company_contacts_page.dart';

/// Central Forms & Work Hub providing vehicle inspection, defect reporting, student incidents, time-off operations, and bi-weekly timesheet.
class FormsTab extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String role;
  final int sectionIndex;
  final ValueChanged<int>? onSectionChanged;

  const FormsTab({
    super.key,
    required this.driverId,
    this.driverName = 'Driver',
    this.role = 'Driver',
    this.sectionIndex = 0,
    this.onSectionChanged,
  });

  @override
  State<FormsTab> createState() => _FormsTabState();
}

class _FormsTabState extends State<FormsTab> {
  late int _internalSectionIndex;

  String get driverId => widget.driverId;
  String get driverName => widget.driverName;
  String get role => widget.role;

  @override
  void initState() {
    super.initState();
    _internalSectionIndex = widget.sectionIndex;
  }

  @override
  void didUpdateWidget(covariant FormsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sectionIndex != widget.sectionIndex) {
      _internalSectionIndex = widget.sectionIndex;
    }
  }

  void _selectSection(int index) {
    setState(() {
      _internalSectionIndex = index;
    });
    widget.onSectionChanged?.call(index);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final normalizedRole = role.toLowerCase().trim();
    final isHelper = normalizedRole == 'helper' || normalizedRole == 'attendant' || normalizedRole == 'monitor';
    final isFleet = normalizedRole == 'fleet' || normalizedRole == 'admin';

    return Column(
      children: [
        // Top Segmented Switcher: Forms & Safety vs Timesheet & Payroll
        Container(
          margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: _buildSegmentButton(
                  index: 0,
                  icon: Icons.assignment_rounded,
                  label: 'Forms & Safety',
                  isDark: isDark,
                ),
              ),
              Expanded(
                child: _buildSegmentButton(
                  index: 1,
                  icon: Icons.receipt_long_rounded,
                  label: 'Timesheet & Payroll',
                  isDark: isDark,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: IndexedStack(
            index: _internalSectionIndex,
            children: [
              _buildFormsScrollView(context, isDark, isHelper, isFleet),
              TimesheetPage(
                driverId: driverId,
                driverName: driverName,
                role: role,
                showAppBar: false,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSegmentButton({
    required int index,
    required IconData icon,
    required String label,
    required bool isDark,
  }) {
    final isSelected = _internalSectionIndex == index;
    return GestureDetector(
      onTap: () => _selectSection(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected
                  ? const Color(0xFF0F172A)
                  : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.bold,
                  color: isSelected
                      ? const Color(0xFF0F172A)
                      : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFormsScrollView(
    BuildContext context,
    bool isDark,
    bool isHelper,
    bool isFleet,
  ) {
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async {
        context.read<TimeOffBloc>().add(LoadTimeOffRequestsEvent(driverId));
        if (!isHelper) {
          context.read<DefectBloc>().add(LoadDefects(driverId: driverId));
        }
        try {
          context.read<StudentIncidentBloc>().add(LoadStudentIncidents(driverId: driverId));
        } catch (_) {}
        try {
          context.read<ExpenseReimbursementBloc>().add(LoadExpenseClaims(employeeId: driverId));
        } catch (_) {}
        try {
          context.read<HazardReportBloc>().add(LoadHazardReports(employeeId: driverId));
        } catch (_) {}
        if (!isHelper) {
          try {
            context.read<RouteAssessmentBloc>().add(LoadRouteAssessments(employeeId: driverId));
          } catch (_) {}
          try {
            context.read<VehicleSignoutBloc>().add(const LoadVehicleSignouts());
          } catch (_) {}
        }
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // ─── Section 1 & 2: Vehicle Inspection & Defects (Driver Only) ───
          if (!isHelper) ...[
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
                child: Text(
                  'VEHICLE INSPECTION',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                    color: Colors.grey,
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                child: BlocBuilder<RouteBloc, RouteState>(
                  builder: (context, routeState) {
                    final vehicleUnit = routeState is RouteLoaded &&
                            routeState.route != null
                        ? routeState.route!.vehicleUnit
                        : '';
                    final today = DateTime.now();
                    final dateStr =
                        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
                    return PreTripStatusCard(
                      driverId: driverId,
                      driverName: driverName,
                      defaultVehicleUnit:
                          vehicleUnit.isNotEmpty ? vehicleUnit : null,
                      currentDate: dateStr,
                    );
                  },
                ),
              ),
            ),

            // Section Divider
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Divider(
                  color: isDark
                      ? AppColors.darkCardBorder
                      : AppColors.lightCardBorder,
                ),
              ),
            ),

            // Section 2: Vehicle Defects
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
                child: Text(
                  'VEHICLE DEFECTS & MAINTENANCE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                    color: Colors.grey,
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                child: BlocBuilder<RouteBloc, RouteState>(
                  builder: (context, routeState) {
                    final vehicleUnit = routeState is RouteLoaded &&
                            routeState.route != null
                        ? routeState.route!.vehicleUnit
                        : '';
                    return DefectSummaryCard(
                      driverId: driverId,
                      driverName: driverName,
                      defaultVehicleUnit: vehicleUnit,
                    );
                  },
                ),
              ),
            ),

            // Section Divider
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Divider(
                  color: isDark
                      ? AppColors.darkCardBorder
                      : AppColors.lightCardBorder,
                ),
              ),
            ),
          ],

          // ─── Section 3: Student Incidents & Safety ───────────────────────
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
              child: Text(
                'STUDENT INCIDENTS & SAFETY',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: Colors.grey,
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: BlocBuilder<RouteBloc, RouteState>(
                builder: (context, routeState) {
                  final routeNo = routeState is RouteLoaded &&
                          routeState.route != null
                      ? routeState.route!.routeNo
                      : '';
                  final routeName = routeState is RouteLoaded &&
                          routeState.route != null
                      ? routeState.route!.routeName
                      : '';
                  return StudentIncidentSummaryCard(
                    driverId: driverId,
                    driverName: driverName,
                    defaultRouteNo: routeNo,
                    defaultRouteName: routeName,
                  );
                },
              ),
            ),
          ),

          // ─── Section Divider ─────────────────────────────────────────────
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Divider(
                color: isDark
                    ? AppColors.darkCardBorder
                    : AppColors.lightCardBorder,
              ),
            ),
          ),

          // ─── Section 4: Leave & Time-Off ─────────────────────────────────
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
              child: Text(
                'TIME-OFF & LEAVE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: Colors.grey,
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: _buildTimeOffSummaryCard(context, isDark),
            ),
          ),

          // ─── Section Divider ─────────────────────────────────────────────
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Divider(
                color: isDark
                    ? AppColors.darkCardBorder
                    : AppColors.lightCardBorder,
              ),
            ),
          ),

          // ─── Section 5: Expense Reimbursements ───────────────────────────
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
              child: Text(
                'EXPENSE REIMBURSEMENTS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: Colors.grey,
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: BlocBuilder<RouteBloc, RouteState>(
                builder: (context, routeState) {
                  final routeNo = routeState is RouteLoaded &&
                          routeState.route != null
                      ? routeState.route!.routeNo
                      : '';
                  return ExpenseSummaryCard(
                    driverId: driverId,
                    driverName: driverName,
                    defaultRouteNo: routeNo,
                  );
                },
              ),
            ),
          ),

          // ─── Section Divider ─────────────────────────────────────────────
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Divider(
                color: isDark
                    ? AppColors.darkCardBorder
                    : AppColors.lightCardBorder,
              ),
            ),
          ),

          // ─── Section 6: Hazards & Near-Miss Reports ─────────────────────
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
              child: Text(
                'HAZARDS & NEAR-MISS REPORTS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: Colors.grey,
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, isHelper ? 40 : 0),
              child: BlocBuilder<RouteBloc, RouteState>(
                builder: (context, routeState) {
                  final routeNo = routeState is RouteLoaded &&
                          routeState.route != null
                      ? routeState.route!.routeNo
                      : '';
                  final vehicleUnit = routeState is RouteLoaded &&
                          routeState.route != null
                      ? routeState.route!.vehicleUnit
                      : '';
                  return HazardSummaryCard(
                    driverId: driverId,
                    driverName: driverName,
                    defaultRouteNo: routeNo,
                    defaultVehicleUnit: vehicleUnit,
                  );
                },
              ),
            ),
          ),

          // ─── Section 7 & 8: Route Safety Assessment & Handover (Driver / Fleet Only) ───
          if (!isHelper) ...[
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Divider(
                  color: isDark
                      ? AppColors.darkCardBorder
                      : AppColors.lightCardBorder,
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
                child: Text(
                  'ROUTE SAFETY ASSESSMENT',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                    color: Colors.grey,
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                child: BlocBuilder<RouteBloc, RouteState>(
                  builder: (context, routeState) {
                    final routeNo = routeState is RouteLoaded &&
                            routeState.route != null
                        ? routeState.route!.routeNo
                        : '';
                    return RouteAssessmentSummaryCard(
                      driverId: driverId,
                      driverName: driverName,
                      defaultRouteId: routeNo,
                    );
                  },
                ),
              ),
            ),

            // ─── Section 8: Vehicle Sign-Out & Handover (Read-Only for Driver) ───
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Divider(
                  color: isDark
                      ? AppColors.darkCardBorder
                      : AppColors.lightCardBorder,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
                child: Text(
                  isFleet
                      ? 'VEHICLE HANDOVER (FLEET OPERATIONS)'
                      : 'VEHICLE HANDOVER (READ-ONLY)',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                    color: Colors.grey,
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                child: BlocBuilder<RouteBloc, RouteState>(
                  builder: (context, routeState) {
                    final vehicleUnit = routeState is RouteLoaded &&
                            routeState.route != null
                        ? routeState.route!.vehicleUnit
                        : '';
                    return VehicleSignoutSummaryCard(
                      driverId: driverId,
                      driverName: driverName,
                      defaultVehicleUnit:
                          vehicleUnit.isNotEmpty ? vehicleUnit : null,
                      isReadOnly: !isFleet,
                    );
                  },
                ),
              ),
            ),
          ],

          // ─── Section: Company Contacts & Emergency Hotlines ─────────────────────
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Divider(
                color: isDark
                    ? AppColors.darkCardBorder
                    : AppColors.lightCardBorder,
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 6, 16, 6),
              child: Text(
                'COMPANY & EMERGENCY DIRECTORY',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: Colors.grey,
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
              child: _buildCompanyContactsCard(context, isDark),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompanyContactsCard(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.phone_in_talk_rounded,
              color: Color(0xFFF59E0B),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Company Contacts',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 2),
                Text(
                  '24/7 Operations Desk, Student Safety Line, Fleet Roadside & HR',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const CompanyContactsPage(),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              foregroundColor: const Color(0xFF0F172A),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Open', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeOffSummaryCard(BuildContext context, bool isDark) {
    return BlocBuilder<TimeOffBloc, TimeOffState>(
      builder: (context, state) {
        int totalCount = 0;
        int pendingCount = 0;
        int approvedCount = 0;
        TimeOffRequestModel? latestRequest;

        if (state is TimeOffLoaded) {
          totalCount = state.totalCount;
          pendingCount = state.pendingCount;
          approvedCount = state.approvedCount;
          if (state.requests.isNotEmpty) {
            latestRequest = state.requests.first;
          }
        }

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark
                  ? AppColors.darkCardBorder
                  : AppColors.lightCardBorder,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.event_note_rounded,
                      color: AppColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Leave & Absence Requests',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Submit and track vacation, sick leave, or personal day requests.',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark
                                ? AppColors.textSecondaryDark
                                : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // KPI Stats Row
              Row(
                children: [
                  _buildStatBadge(
                    label: 'Total Requests',
                    value: '$totalCount',
                    color: Colors.blue,
                    icon: Icons.list_alt_rounded,
                    isDark: isDark,
                  ),
                  const SizedBox(width: 8),
                  _buildStatBadge(
                    label: 'Pending',
                    value: '$pendingCount',
                    color: pendingCount > 0
                        ? AppColors.warning
                        : AppColors.success,
                    icon: pendingCount > 0
                        ? Icons.hourglass_top_rounded
                        : Icons.check_circle_outline_rounded,
                    isDark: isDark,
                  ),
                  const SizedBox(width: 8),
                  _buildStatBadge(
                    label: 'Approved',
                    value: '$approvedCount',
                    color: AppColors.success,
                    icon: Icons.verified_rounded,
                    isDark: isDark,
                  ),
                ],
              ),

              // Latest Request Preview (if available)
              if (latestRequest != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkBg.withValues(alpha: 0.6)
                        : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isDark
                          ? AppColors.darkCardBorder.withValues(alpha: 0.5)
                          : AppColors.lightCardBorder,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.history_rounded,
                        size: 16,
                        color: isDark
                            ? AppColors.textSecondaryDark
                            : AppColors.textSecondaryLight,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Latest: ${latestRequest.leaveType.label} (${latestRequest.startDate})',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      _buildStatusPill(latestRequest.status),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 16),

              // Action Buttons Row
              Row(
                children: [
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      minimumSize: const Size(0, 42),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    icon: const Icon(Icons.add_rounded, size: 16),
                    label: const Text(
                      'New Request',
                      style:
                          TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    onPressed: () {
                      CreateLeaveRequestDialog.show(
                        context,
                        employeeId: driverId,
                        employeeName: driverName,
                      );
                    },
                  ),
                  const Spacer(),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: const Color(0xFF0F172A),
                      minimumSize: const Size(0, 42),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                    label: const Text(
                      'View All Requests',
                      style:
                          TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    onPressed: () {
                      Navigator.of(context).push(
                        TimeOffPage.route(
                          driverId: driverId,
                          driverName: driverName,
                          bloc: context.read<TimeOffBloc>(),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatBadge({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
    required bool isDark,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 13, color: color),
                const SizedBox(width: 4),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusPill(TimeOffStatus status) {
    Color color;
    switch (status) {
      case TimeOffStatus.approved:
        color = AppColors.success;
        break;
      case TimeOffStatus.rejected:
        color = AppColors.error;
        break;
      case TimeOffStatus.cancelled:
        color = Colors.grey;
        break;
      case TimeOffStatus.pending:
        color = AppColors.warning;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }
}
