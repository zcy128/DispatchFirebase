import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../dispatch/repository/dispatch_repository.dart';
import '../../expense_reimbursement/repository/expense_reimbursement_repository.dart';
import '../../route/repository/route_repository.dart';
import '../models/timesheet_model.dart';
import '../repository/timesheet_repository.dart';

class TimesheetPage extends StatefulWidget {
  final String driverId;
  final String driverName;
  final String role;
  final bool showAppBar;

  const TimesheetPage({
    super.key,
    required this.driverId,
    this.driverName = 'Driver',
    this.role = 'Driver',
    this.showAppBar = false,
  });

  @override
  State<TimesheetPage> createState() => _TimesheetPageState();
}

class _TimesheetPageState extends State<TimesheetPage> {
  late TimesheetRepository _repository;
  late String _startDate;
  String _weekFilter = 'all'; // 'all' | 'week1' | 'week2'
  bool _loading = true;
  String? _error;
  BiweeklyTimesheetSummary? _summary;

  @override
  void initState() {
    super.initState();
    _startDate = TimesheetRepository.formatDate(
      TimesheetRepository.getDefaultBiweeklyStartDate(),
    );
    DispatchRepository? dispatchRepo;
    RouteRepository? routeRepo;
    ExpenseReimbursementRepository? expenseRepo;
    try {
      dispatchRepo = context.read<DispatchRepository>();
    } catch (_) {}
    try {
      routeRepo = context.read<RouteRepository>();
    } catch (_) {}
    try {
      expenseRepo = context.read<ExpenseReimbursementRepository>();
    } catch (_) {}

    _repository = TimesheetRepository(
      dispatchRepository: dispatchRepo,
      routeRepository: routeRepo,
      expenseRepository: expenseRepo,
    );
    _loadData();
  }

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final summary = await _repository.loadBiweeklyTimesheet(
        driverId: widget.driverId,
        driverName: widget.driverName,
        startDate: _startDate,
      );
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _shiftPeriod(int days) {
    setState(() {
      _startDate = TimesheetRepository.addDays(_startDate, days);
    });
    _loadData();
  }

  void _jumpToCurrentPeriod() {
    final defStart = TimesheetRepository.formatDate(
      TimesheetRepository.getDefaultBiweeklyStartDate(),
    );
    if (_startDate != defStart) {
      setState(() {
        _startDate = defStart;
      });
    }
    _loadData();
  }

  Future<void> _pickStartDate() async {
    final initial = TimesheetRepository.parseDate(_startDate);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2024, 1, 1),
      lastDate: DateTime(2028, 12, 31),
      helpText: 'Select Bi-Weekly Period Start Date',
    );
    if (picked != null) {
      setState(() {
        _startDate = TimesheetRepository.formatDate(picked);
      });
      _loadData();
    }
  }

  String _formatFriendlyRange(String startStr, String endStr) {
    try {
      final s = TimesheetRepository.parseDate(startStr);
      final e = TimesheetRepository.parseDate(endStr);
      final fmtShort = DateFormat('MMM d');
      final fmtFull = DateFormat('MMM d, yyyy');
      return '${fmtShort.format(s)} – ${fmtFull.format(e)}';
    } catch (_) {
      return '$startStr to $endStr';
    }
  }

  String _formatFullDayHeader(String dateStr) {
    try {
      final dt = TimesheetRepository.parseDate(dateStr);
      return DateFormat('EEEE, MMM d, yyyy').format(dt);
    } catch (_) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final endDate = TimesheetRepository.addDays(_startDate, 13);

    final content = RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _loadData,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 36),
        children: [
          // 1. Bi-Weekly Period Navigation Bar
          _buildPeriodSelectorCard(isDark, endDate),
          const SizedBox(height: 14),

          if (_loading)
            Container(
              height: 240,
              alignment: Alignment.center,
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 12),
                  Text(
                    'Synchronizing bi-weekly timesheet & payroll...',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            )
          else if (_error != null)
            _buildErrorCard(isDark)
          else if (_summary != null) ...[
            // 2. Top 2-Week Wages & Hours Summary Card
            _buildBiweeklySummaryCard(_summary!, isDark),
            const SizedBox(height: 14),

            // 3. Week 1 vs Week 2 Filter Tabs
            _buildWeekFilterTabs(_summary!, isDark),
            const SizedBox(height: 12),

            // 4. Daily Dispatch Shifts Breakdown
            ..._buildDailyShiftsSections(_summary!, isDark),
          ],
        ],
      ),
    );

    if (!widget.showAppBar) {
      return content;
    }

    return Scaffold(
      appBar: AppBar(
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
              'Payroll Wages, Hours & Daily Shifts',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Current Period',
            icon: const Icon(Icons.today_rounded, color: AppColors.primary),
            onPressed: _jumpToCurrentPeriod,
          ),
          IconButton(
            tooltip: 'Sync Payroll Data',
            icon: const Icon(Icons.sync_rounded, color: AppColors.primary),
            onPressed: _loadData,
          ),
        ],
      ),
      body: content,
    );
  }

  Widget _buildPeriodSelectorCard(bool isDark, String endDate) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Previous 2 Weeks (-14d)',
                visualDensity: VisualDensity.compact,
                onPressed: () => _shiftPeriod(-14),
                icon: const Icon(Icons.chevron_left_rounded, color: AppColors.primary),
              ),
              Expanded(
                child: InkWell(
                  onTap: _pickStartDate,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.calendar_month_rounded,
                              size: 15,
                              color: AppColors.primary,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                _formatFriendlyRange(_startDate, endDate),
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '14-Day Bi-Weekly Period ($_startDate to $endDate)',
                          style: TextStyle(
                            fontSize: 10,
                            color: isDark
                                ? AppColors.textSecondaryDark
                                : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Next 2 Weeks (+14d)',
                visualDensity: VisualDensity.compact,
                onPressed: () => _shiftPeriod(14),
                icon: const Icon(Icons.chevron_right_rounded, color: AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton.icon(
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                ),
                onPressed: _jumpToCurrentPeriod,
                icon: const Icon(Icons.today_rounded, size: 14, color: AppColors.primary),
                label: const Text(
                  'Current 2-Week Period',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
              TextButton.icon(
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                ),
                onPressed: _loadData,
                icon: const Icon(Icons.sync_rounded, size: 14, color: AppColors.primary),
                label: const Text(
                  'Sync Payroll',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
      ),
      child: Column(
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 32),
          const SizedBox(height: 8),
          const Text(
            'Unable to load timesheet records',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 4),
          Text(
            _error ?? '',
            style: const TextStyle(fontSize: 12, color: Colors.grey),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: _loadData,
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildBiweeklySummaryCard(BiweeklyTimesheetSummary summary, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.16),
            isDark ? AppColors.darkCard : Colors.white,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'BI-WEEKLY PAYROLL SUMMARY',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                        color: AppColors.primary,
                      ),
                    ),
                    Text(
                      '${widget.driverName} (${widget.driverId})',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark
                            ? AppColors.textSecondaryDark
                            : AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${summary.totalShiftsCount} SHIFTS',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: AppColors.success,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Main 2-Week Wages & Hours Row
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkBg.withValues(alpha: 0.55)
                        : Colors.white.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '2-Week Route Wages',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark
                              ? AppColors.textSecondaryDark
                              : AppColors.textSecondaryLight,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '\$${summary.totalPay.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                      ),
                      if (summary.approvedExpensesAmount > 0) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Net Payout: \$${summary.netTotalPayout.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkBg.withValues(alpha: 0.55)
                        : Colors.white.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '2-Week Total Hours',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark
                              ? AppColors.textSecondaryDark
                              : AppColors.textSecondaryLight,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${summary.totalHours.toStringAsFixed(2)} hrs',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.info,
                        ),
                      ),
                      if (summary.approvedExpensesAmount > 0) ...[
                        const SizedBox(height: 2),
                        Text(
                          '+\$${summary.approvedExpensesAmount.toStringAsFixed(2)} Expenses',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Week 1 & Week 2 Breakdown Row
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkBg.withValues(alpha: 0.35)
                        : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Week 1 (${summary.startDate.substring(5)}–${summary.week1EndDate.substring(5)})',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '\$${summary.week1Pay.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '${summary.week1Hours.toStringAsFixed(2)} hrs · ${summary.week1ShiftsCount} runs',
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkBg.withValues(alpha: 0.35)
                        : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Week 2 (${summary.week2StartDate.substring(5)}–${summary.endDate.substring(5)})',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '\$${summary.week2Pay.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '${summary.week2Hours.toStringAsFixed(2)} hrs · ${summary.week2ShiftsCount} runs',
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          if (summary.holidayShiftsCount > 0) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.celebration_rounded, size: 16, color: Colors.amber),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Includes ${summary.holidayShiftsCount} Statutory Holiday Credit Shifts (+\$${summary.holidayPay.toStringAsFixed(2)})',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.amber,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildWeekFilterTabs(BiweeklyTimesheetSummary summary, bool isDark) {
    Widget buildTab(String key, String label, int count) {
      final isSelected = _weekFilter == key;
      return Expanded(
        child: InkWell(
          onTap: () => setState(() => _weekFilter = key),
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 9),
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.primary
                  : (isDark ? AppColors.darkCard : Colors.white),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isSelected
                    ? AppColors.primary
                    : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              '$label ($count)',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isSelected
                    ? const Color(0xFF0F172A)
                    : (isDark ? Colors.white70 : Colors.black87),
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        buildTab('all', 'All 2 Weeks', summary.totalShiftsCount),
        const SizedBox(width: 8),
        buildTab('week1', 'Week 1', summary.week1ShiftsCount),
        const SizedBox(width: 8),
        buildTab('week2', 'Week 2', summary.week2ShiftsCount),
      ],
    );
  }

  List<Widget> _buildDailyShiftsSections(
    BiweeklyTimesheetSummary summary,
    bool isDark,
  ) {
    final activeShifts = _weekFilter == 'week1'
        ? summary.week1Shifts
        : _weekFilter == 'week2'
            ? summary.week2Shifts
            : summary.shifts;

    if (activeShifts.isEmpty) {
      return [
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
          ),
          child: const Column(
            children: [
              Icon(Icons.event_busy_rounded, size: 36, color: Colors.grey),
              SizedBox(height: 8),
              Text(
                'No dispatch shifts recorded for this period',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 4),
              Text(
                'Use the date selector above to switch between 2-week pay periods.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ];
    }

    final groupedByDate = summary.groupShiftsByDate(activeShifts);
    final widgets = <Widget>[];

    groupedByDate.forEach((dateStr, dayShifts) {
      final isWeek1 = dateStr.compareTo(summary.week1EndDate) <= 0;
      final dayPay = dayShifts.fold<double>(0.0, (sum, s) => sum + s.payAmount);
      final dayHours = dayShifts.fold<double>(0.0, (sum, s) => sum + s.eiHours);

      widgets.add(
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Day Header Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkBg.withValues(alpha: 0.45)
                      : Colors.grey.shade100,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_rounded,
                      size: 14,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _formatFullDayHeader(dateStr),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isWeek1
                            ? Colors.blueGrey.withValues(alpha: 0.15)
                            : AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isWeek1 ? 'Week 1' : 'Week 2',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isWeek1 ? Colors.blueGrey : AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${dayHours.toStringAsFixed(2)} hrs · \$${dayPay.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),

              // Individual Shift Rows for this Day
              ...dayShifts.asMap().entries.map((entry) {
                final idx = entry.key;
                final shift = entry.value;
                return Column(
                  children: [
                    if (idx > 0)
                      Divider(
                        height: 1,
                        color: isDark
                            ? AppColors.darkCardBorder
                            : AppColors.lightCardBorder,
                      ),
                    _buildShiftTile(shift, isDark),
                  ],
                );
              }),
            ],
          ),
        ),
      );
    });

    return widgets;
  }

  Widget _buildShiftTile(TimesheetShiftEntry shift, bool isDark) {
    final shiftUpper = shift.shiftType.toUpperCase();
    Color shiftColor = Colors.blue;
    if (shiftUpper == 'PM') {
      shiftColor = Colors.indigoAccent;
    } else if (shiftUpper == 'MIDDAY' || shiftUpper == 'EXTRA') {
      shiftColor = Colors.purpleAccent;
    } else if (shiftUpper == 'CHARTER' || shift.isCharter) {
      shiftColor = Colors.deepOrangeAccent;
    }

    Color statusColor = AppColors.success;
    String statusLabel = 'Approved';
    if (shift.isHolidayCredit) {
      statusColor = Colors.amber;
      statusLabel = 'Holiday Credit';
    } else if (shift.status == 'pending_approval') {
      statusColor = AppColors.warning;
      statusLabel = 'Pending Review';
    } else if (shift.status == 'scheduled') {
      statusColor = AppColors.info;
      statusLabel = 'Scheduled';
    } else if (shift.status == 'in_progress') {
      statusColor = AppColors.primary;
      statusLabel = 'In Progress';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Shift Type Badge (AM / PM / MIDDAY / CHARTER)
          Container(
            width: 50,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: shiftColor.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: shiftColor.withValues(alpha: 0.35)),
            ),
            alignment: Alignment.center,
            child: Text(
              shiftUpper,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: shiftColor,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Route & Time Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        'Route ${shift.routeNo}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                if (shift.routeName.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    shift.routeName,
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      shift.isHolidayCredit
                          ? Icons.celebration_rounded
                          : Icons.access_time_rounded,
                      size: 12,
                      color: Colors.grey,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        shift.isHolidayCredit
                            ? (shift.rateDescription ?? 'Statutory Holiday Entitlement')
                            : (shift.checkInTime != null || shift.checkOutTime != null)
                                ? '${shift.checkInTime ?? '--'} → ${shift.checkOutTime ?? '--'} · ${shift.payOption}'
                                : 'Standard Shift · ${shift.payOption}',
                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Single Shift Payroll Amount & Hours
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\$${shift.payAmount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${shift.eiHours.toStringAsFixed(2)} hrs',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.info,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
