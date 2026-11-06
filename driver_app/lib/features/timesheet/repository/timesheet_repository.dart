import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import '../../../core/api_config.dart';
import '../../../core/network/api_client.dart';
import '../../dispatch/repository/dispatch_repository.dart';
import '../../expense_reimbursement/repository/expense_reimbursement_repository.dart';
import '../../route/models/route_model.dart';
import '../../route/repository/route_repository.dart';
import '../models/timesheet_model.dart';

/// The payroll API responded, but the body or status cannot be used as a timesheet.
class TimesheetSyncException implements Exception {
  final String message;

  const TimesheetSyncException(this.message);

  @override
  String toString() => message;
}

class TimesheetRepository {
  final http.Client _httpClient;
  final String apiBaseUrl;
  final DispatchRepository? dispatchRepository;
  final RouteRepository? routeRepository;
  final ExpenseReimbursementRepository? expenseRepository;

  TimesheetRepository({
    http.Client? httpClient,
    String? apiBaseUrl,
    this.dispatchRepository,
    this.routeRepository,
    this.expenseRepository,
  })  : _httpClient = httpClient ?? AuthenticatedHttpClient.instance,
        apiBaseUrl = apiBaseUrl ?? ApiConfig.baseUrl;

  bool get isFirestoreAvailable {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Synchronized with Web App BiweeklyPayrollView.tsx:
  /// Default start date is the Sunday of the previous week (14-day period covering previous week + current week).
  static DateTime getDefaultBiweeklyStartDate([DateTime? referenceNow]) {
    final now = referenceNow ?? DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // In Dart, Sunday is weekday == 7 (Mon=1 .. Sun=7). Convert to 0=Sun..6=Sat:
    final dayOfWeek = today.weekday % 7;
    final prevSunday = _addCalendarDays(today, -dayOfWeek);
    return _addCalendarDays(prevSunday, -7);
  }

  static String formatDate(DateTime dt) => DateFormat('yyyy-MM-dd').format(dt);

  static DateTime parseDate(String dateStr) {
    final parts = dateStr.split('-');
    if (parts.length == 3) {
      return DateTime(
        int.tryParse(parts[0]) ?? 2026,
        int.tryParse(parts[1]) ?? 1,
        int.tryParse(parts[2]) ?? 1,
      );
    }
    return DateTime.now();
  }

  /// Calendar days, so a 14-day period stays intact across daylight saving time.
  static DateTime _addCalendarDays(DateTime dt, int days) {
    return DateTime(dt.year, dt.month, dt.day + days);
  }

  static String addDays(String dateStr, int days) {
    return formatDate(_addCalendarDays(parseDate(dateStr), days));
  }

  /// Half-up currency rounding to 2 decimal places.
  static double roundMoney(num value) {
    if (value.isNaN || value.isInfinite) return 0;
    final sign = value.isNegative ? -1.0 : 1.0;
    final scaled = (value.abs() + 1e-8) * 100;
    return sign * scaled.round() / 100;
  }

  static const Map<String, String> predefinedHolidays = {
    '2026-01-01': "New Year's Day",
    '2026-02-16': 'Family Day',
    '2026-04-03': 'Good Friday',
    '2026-04-06': 'Easter Monday',
    '2026-05-18': 'Victoria Day',
    '2026-07-01': 'Canada Day',
    '2026-08-03': 'Civic Holiday',
    '2026-09-07': 'Labour Day',
    '2026-09-30': 'National Day for Truth and Reconciliation',
    '2026-10-12': 'Thanksgiving Day (10-12 Holiday)',
    '2026-11-11': 'Remembrance Day',
    '2026-12-25': 'Christmas Day',
    '2026-12-26': 'Boxing Day',
  };

  bool _matchesCurrentDriver({
    required String recordEmployeeId,
    required String recordEmployeeName,
    required String driverId,
    required String driverName,
  }) {
    if (recordEmployeeId.isNotEmpty && RouteRepository.matchesDriver(recordEmployeeId, driverId)) {
      return true;
    }
    if (recordEmployeeName.isNotEmpty &&
        driverName.isNotEmpty &&
        RouteRepository.matchesDriver(recordEmployeeName, driverName)) {
      return true;
    }
    if (recordEmployeeName.isNotEmpty &&
        driverName.isNotEmpty &&
        recordEmployeeName.toLowerCase().trim() == driverName.toLowerCase().trim()) {
      return true;
    }
    return false;
  }

  TimesheetShiftEntry _parsePayrollLogMap(Map<String, dynamic> m) {
    final id = (m['id'] ?? '').toString();
    final dispatchDate = (m['dispatchDate'] ?? '').toString();
    final routeNo = (m['routeNo'] ?? '').toString();
    final routeName = (m['routeName'] ?? '').toString();
    final shiftType = (m['shiftType'] ?? 'AM').toString().toUpperCase();
    final employeeId = (m['employeeId'] ?? '').toString();
    final employeeName = (m['employeeName'] ?? '').toString();
    final payAmount = _readMoney(m['payAmount'] ?? m['payRate'] ?? m['originalPayRate']);
    final eiHours = _readHours(m['eiHours'] ?? m['originalEiHours']);
    final payOption = (m['payOption'] ?? 'STANDARD').toString();
    final rateSource = (m['rateSource'] ?? 'board_base_rate').toString();
    final rateDescription = m['rateDescription']?.toString();
    final checkInTime = m['checkInTime']?.toString();
    final checkOutTime = m['checkOutTime']?.toString();
    final status = (m['status'] ?? 'approved').toString();
    final isHoliday = rateSource == 'holiday_route_assignment' || id.startsWith('HOLIDAY-');
    final isCharter = m['isCharter'] == true || shiftType == 'CHARTER';

    return TimesheetShiftEntry(
      id: id,
      dispatchDate: dispatchDate,
      routeNo: routeNo,
      routeName: routeName,
      shiftType: shiftType,
      employeeId: employeeId,
      employeeName: employeeName,
      payAmount: payAmount,
      eiHours: eiHours,
      payOption: payOption,
      rateSource: rateSource,
      rateDescription: rateDescription,
      checkInTime: checkInTime,
      checkOutTime: checkOutTime,
      status: isHoliday ? 'holiday_credit' : status,
      isHolidayCredit: isHoliday,
      isCharter: isCharter,
    );
  }

  Future<BiweeklyTimesheetSummary> loadBiweeklyTimesheet({
    required String driverId,
    required String driverName,
    required String startDate,
  }) async {
    final endDate = addDays(startDate, 13);
    final week1EndDate = addDays(startDate, 6);
    final week2StartDate = addDays(startDate, 7);
    final resolvedEmpId = RouteRepository.resolveEmployeeId(driverId);

    final shiftMap = <String, TimesheetShiftEntry>{};
    TimesheetSyncException? apiFailure;

    // 1. Fetch from Backend API (/api/public/dispatch/payroll-logs)
    try {
      final uri = Uri.parse(
        '$apiBaseUrl/api/public/dispatch/payroll-logs?startDate=$startDate&endDate=$endDate',
      );
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode != 200) {
        throw TimesheetSyncException('Timesheet sync failed (${res.statusCode}).');
      }
      final decoded = jsonDecode(res.body);
      if (decoded is! List) {
        throw const TimesheetSyncException(
          'Timesheet sync failed because the server response was not a payroll list.',
        );
      }
      for (final raw in decoded) {
        if (raw is! Map) continue;
        final m = Map<String, dynamic>.from(raw);
        final status = (m['status'] ?? '').toString();
        if (status == 'rejected') continue;
        final recEmpId = (m['employeeId'] ?? '').toString();
        final recEmpName = (m['employeeName'] ?? '').toString();
        if (_matchesCurrentDriver(
          recordEmployeeId: recEmpId,
          recordEmployeeName: recEmpName,
          driverId: driverId,
          driverName: driverName,
        )) {
          final entry = _parsePayrollLogMap(m);
          if (entry.dispatchDate.compareTo(startDate) >= 0 &&
              entry.dispatchDate.compareTo(endDate) <= 0) {
            final key = '${entry.dispatchDate}_${entry.routeNo}_${entry.shiftType}';
            shiftMap[key] = entry;
          }
        }
      }
    } catch (e) {
      apiFailure = e is TimesheetSyncException
          ? e
          : const TimesheetSyncException('Timesheet sync failed.');
      debugPrint('[TimesheetRepository] API payroll-logs fetch failed: $e');
    }

    // 2. Fetch from Firestore payroll_logs & dispatch_payrolls if available
    if (isFirestoreAvailable) {
      final queryEmpIds = <String>{
        driverId.trim(),
        driverId.trim().toLowerCase(),
        resolvedEmpId,
        resolvedEmpId.toLowerCase(),
      }.where((s) => s.isNotEmpty).toList();

      try {
        if (queryEmpIds.isNotEmpty) {
          final logsSnap = await FirebaseFirestore.instance
              .collection('payroll_logs')
              .where('employeeId', whereIn: queryEmpIds)
              .get();
          for (final doc in logsSnap.docs) {
            final m = Map<String, dynamic>.from(doc.data());
            m['id'] = doc.id;
            if ((m['status'] ?? '') == 'rejected') continue;
            final entry = _parsePayrollLogMap(m);
            if (entry.dispatchDate.compareTo(startDate) >= 0 &&
                entry.dispatchDate.compareTo(endDate) <= 0) {
              final key = '${entry.dispatchDate}_${entry.routeNo}_${entry.shiftType}';
              shiftMap.putIfAbsent(key, () => entry);
            }
          }
        }
      } catch (e) {
        debugPrint('[TimesheetRepository] Firestore payroll_logs error: $e');
      }

      try {
        if (queryEmpIds.isNotEmpty) {
          final dpSnap = await FirebaseFirestore.instance
              .collection('dispatch_payrolls')
              .where('employeeId', whereIn: queryEmpIds)
              .get();
          for (final doc in dpSnap.docs) {
            final m = Map<String, dynamic>.from(doc.data());
            m['id'] = doc.id;
            if ((m['status'] ?? '') == 'rejected') continue;
            final entry = _parsePayrollLogMap(m);
            if (entry.dispatchDate.compareTo(startDate) >= 0 &&
                entry.dispatchDate.compareTo(endDate) <= 0) {
              final key = '${entry.dispatchDate}_${entry.routeNo}_${entry.shiftType}';
              shiftMap.putIfAbsent(key, () => entry);
            }
          }
        }
      } catch (e) {
        debugPrint('[TimesheetRepository] Firestore dispatch_payrolls error: $e');
      }

      // 3. Also check Firestore dispatch_shifts for this driver in [startDate, endDate]
      try {
        if (queryEmpIds.isNotEmpty) {
          final shiftsSnap = await FirebaseFirestore.instance
              .collection('dispatch_shifts')
              .where('assignedEmployeeIds', arrayContainsAny: queryEmpIds)
              .get();
          for (final doc in shiftsSnap.docs) {
            final data = Map<String, dynamic>.from(doc.data());
            data['id'] = doc.id;
            final d = (data['dispatchDate'] ?? '').toString();
            if (d.compareTo(startDate) < 0 || d.compareTo(endDate) > 0) continue;

            final shiftDriverId = (data['driverId'] ?? '').toString();
            final shiftDriverName = (data['driverName'] ?? '').toString();
            if (!_matchesCurrentDriver(
              recordEmployeeId: shiftDriverId,
              recordEmployeeName: shiftDriverName,
              driverId: driverId,
              driverName: driverName,
            )) {
              continue;
            }

            final record = DispatchRepository.parseShiftMap(data, d);
            final key = '${record.date}_${record.routeNo}_${record.shiftType}';
            if (!shiftMap.containsKey(key) && record.payOption != 'NP') {
              shiftMap[key] = TimesheetShiftEntry(
                id: record.id,
                dispatchDate: record.date,
                routeNo: record.routeNo,
                routeName: record.routeName,
                shiftType: record.shiftType,
                employeeId: resolvedEmpId,
                employeeName: record.driverName.isNotEmpty ? record.driverName : driverName,
                payAmount: record.payrollRate > 0 ? roundMoney(record.payrollRate) : 0,
                eiHours: _readHours(data['driverEiHours'] ?? data['eiHours']),
                payOption: record.payOption,
                rateSource: 'dispatch_shift',
                checkInTime: record.checkInTime,
                checkOutTime: record.checkOutTime,
                status: record.isCheckedOut
                    ? 'completed'
                    : (record.isCheckedIn ? 'in_progress' : 'scheduled'),
              );
            }
          }
        }
      } catch (e) {
        debugPrint('[TimesheetRepository] Firestore dispatch_shifts error: $e');
      }
    }

    // 4. Merge local cached DispatchRepository shifts in [startDate, endDate]
    if (dispatchRepository != null) {
      for (int i = 0; i < 14; i++) {
        final dateStr = addDays(startDate, i);
        final dt = parseDate(dateStr);
        try {
          final localShifts = dispatchRepository!.getDispatchesForDate(dt, driverId: driverId);
          for (final rec in localShifts) {
            final key = '${rec.date}_${rec.routeNo}_${rec.shiftType}';
            if (!shiftMap.containsKey(key) && rec.payOption != 'NP') {
              shiftMap[key] = TimesheetShiftEntry(
                id: rec.id,
                dispatchDate: rec.date,
                routeNo: rec.routeNo,
                routeName: rec.routeName,
                shiftType: rec.shiftType,
                employeeId: resolvedEmpId,
                employeeName: rec.driverName.isNotEmpty ? rec.driverName : driverName,
                payAmount: rec.payrollRate > 0 ? roundMoney(rec.payrollRate) : 0,
                eiHours: 0,
                payOption: rec.payOption,
                rateSource: 'dispatch_shift',
                checkInTime: rec.checkInTime,
                checkOutTime: rec.checkOutTime,
                status: rec.isCheckedOut
                    ? 'completed'
                    : (rec.isCheckedIn ? 'in_progress' : 'scheduled'),
              );
            }
          }
        } catch (_) {}
      }
    }

    if (apiFailure != null && shiftMap.isEmpty) {
      throw apiFailure;
    }

    final assignedRoute = await routeRepository?.getAssignedRoute(driverId);
    if (assignedRoute != null) {
      _addAssignedHolidayCredits(
        shiftMap: shiftMap,
        route: assignedRoute,
        driverId: resolvedEmpId,
        driverName: driverName,
        startDate: startDate,
        endDate: endDate,
      );
    }

    // 7. Sort shifts chronologically by date, then shift type (AM -> MIDDAY -> PM -> CHARTER)
    const shiftOrder = <String, int>{
      'AM': 1,
      'MIDDAY': 2,
      'PM': 3,
      'EXTRA': 4,
      'CHARTER': 5,
    };

    final allShifts = shiftMap.values.toList()
      ..sort((a, b) {
        final cmpDate = a.dispatchDate.compareTo(b.dispatchDate);
        if (cmpDate != 0) return cmpDate;
        final orderA = shiftOrder[a.shiftType] ?? 99;
        final orderB = shiftOrder[b.shiftType] ?? 99;
        if (orderA != orderB) return orderA.compareTo(orderB);
        return a.routeNo.compareTo(b.routeNo);
      });

    final week1Shifts = <TimesheetShiftEntry>[];
    final week2Shifts = <TimesheetShiftEntry>[];
    double week1Pay = 0;
    double week1Hours = 0;
    double week2Pay = 0;
    double week2Hours = 0;
    int holidayShiftsCount = 0;
    double holidayPay = 0;

    for (final s in allShifts) {
      final pay = roundMoney(s.payAmount);
      final hours = roundMoney(s.eiHours);
      if (s.dispatchDate.compareTo(week1EndDate) <= 0) {
        week1Shifts.add(s);
        week1Pay = roundMoney(week1Pay + pay);
        week1Hours = roundMoney(week1Hours + hours);
      } else {
        week2Shifts.add(s);
        week2Pay = roundMoney(week2Pay + pay);
        week2Hours = roundMoney(week2Hours + hours);
      }
      if (s.isHolidayCredit) {
        holidayShiftsCount += 1;
        holidayPay = roundMoney(holidayPay + pay);
      }
    }

    // 8. Fetch Approved Expense Reimbursements for this 2-week period
    double approvedExpensesAmount = 0.0;
    int approvedExpensesCount = 0;
    if (expenseRepository != null) {
      try {
        final claims = await expenseRepository!.getClaims(employeeId: resolvedEmpId);
        for (final c in claims) {
          if (c.status.name == 'approved' &&
              c.claimDate.compareTo(startDate) >= 0 &&
              c.claimDate.compareTo(endDate) <= 0) {
            approvedExpensesAmount = roundMoney(approvedExpensesAmount + c.totalAmount);
            approvedExpensesCount += 1;
          }
        }
      } catch (_) {}
    }

    final totalPay = roundMoney(week1Pay + week2Pay);
    final totalHours = roundMoney(week1Hours + week2Hours);
    final netTotalPayout = roundMoney(totalPay + approvedExpensesAmount);

    return BiweeklyTimesheetSummary(
      startDate: startDate,
      endDate: endDate,
      week1EndDate: week1EndDate,
      week2StartDate: week2StartDate,
      shifts: allShifts,
      week1Shifts: week1Shifts,
      week2Shifts: week2Shifts,
      week1Pay: week1Pay,
      week1Hours: week1Hours,
      week2Pay: week2Pay,
      week2Hours: week2Hours,
      totalPay: totalPay,
      totalHours: totalHours,
      holidayShiftsCount: holidayShiftsCount,
      holidayPay: holidayPay,
      approvedExpensesAmount: approvedExpensesAmount,
      approvedExpensesCount: approvedExpensesCount,
      netTotalPayout: netTotalPayout,
    );
  }

  static double _readMoney(dynamic raw) {
    if (raw == null) return 0;
    final parsed = raw is num ? raw.toDouble() : double.tryParse(raw.toString());
    return roundMoney(parsed ?? 0);
  }

  static double _readHours(dynamic raw) {
    if (raw == null) return 0;
    final parsed = raw is num ? raw.toDouble() : double.tryParse(raw.toString());
    if (parsed == null || parsed <= 0) return 0;
    return roundMoney(parsed);
  }

  static const _weekdayLetters = <int, String>{
    DateTime.monday: 'M',
    DateTime.tuesday: 'T',
    DateTime.wednesday: 'W',
    DateTime.thursday: 'R',
    DateTime.friday: 'F',
  };

  /// Credits only the assigned shift types that are missing on a weekday holiday.
  void _addAssignedHolidayCredits({
    required Map<String, TimesheetShiftEntry> shiftMap,
    required DriverRouteInfo route,
    required String driverId,
    required String driverName,
    required String startDate,
    required String endDate,
  }) {
    final rate = roundMoney(
      route.schoolBoard.toUpperCase().contains('CEPEO') ? 25 : 44.4,
    );
    predefinedHolidays.forEach((holDate, holName) {
      if (holDate.compareTo(startDate) < 0 || holDate.compareTo(endDate) > 0) return;
      final letter = _weekdayLetters[parseDate(holDate).weekday];
      if (letter == null) return;

      final assignedTypes = route.shifts
          .where((shift) => shift.runDays.toUpperCase().contains(letter))
          .map((shift) => shift.shiftType.toUpperCase())
          .toSet()
          .toList();
      if (assignedTypes.isEmpty) return;

      final loggedCount = shiftMap.values.where((shift) => shift.dispatchDate == holDate).length;
      if (loggedCount >= assignedTypes.length) return;
      final loggedTypes = shiftMap.values
          .where((shift) => shift.dispatchDate == holDate)
          .map((shift) => shift.shiftType.toUpperCase())
          .toSet();
      final missing = assignedTypes.where((type) => !loggedTypes.contains(type)).toList();
      final shiftsNeeded = assignedTypes.length - loggedCount;

      for (final shiftType in missing.take(shiftsNeeded)) {
        final key = '${holDate}_${route.routeNo}_$shiftType';
        shiftMap.putIfAbsent(
          key,
          () => TimesheetShiftEntry(
            id: 'HOLIDAY-$holDate-${route.routeNo}-$shiftType',
            dispatchDate: holDate,
            routeNo: route.routeNo,
            routeName: route.routeName,
            shiftType: shiftType,
            employeeId: driverId,
            employeeName: driverName,
            payAmount: rate,
            eiHours: 3,
            payOption: 'STANDARD',
            rateSource: 'holiday_route_assignment',
            rateDescription: 'Statutory Holiday Credit: $holName',
            status: 'holiday_credit',
            isHolidayCredit: true,
          ),
        );
      }
    });
  }
}
