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
import '../../route/repository/route_repository.dart';
import '../models/timesheet_model.dart';

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
    final prevSunday = today.subtract(Duration(days: dayOfWeek));
    return prevSunday.subtract(const Duration(days: 7));
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

  static String addDays(String dateStr, int days) {
    final dt = parseDate(dateStr).add(Duration(days: days));
    return formatDate(dt);
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
    final rawPay = m['payAmount'] ?? m['payRate'] ?? m['originalPayRate'] ?? 0;
    final payAmount = rawPay is num
        ? rawPay.toDouble()
        : (double.tryParse(rawPay.toString()) ?? 0.0);
    final rawHours = m['eiHours'] ?? m['originalEiHours'] ?? 2.5;
    final eiHours = rawHours is num
        ? rawHours.toDouble()
        : (double.tryParse(rawHours.toString()) ?? 2.5);
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

    // 1. Fetch from Backend API (/api/public/dispatch/payroll-logs)
    try {
      final uri = Uri.parse(
        '$apiBaseUrl/api/public/dispatch/payroll-logs?startDate=$startDate&endDate=$endDate',
      );
      final res = await _httpClient.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List<dynamic>;
        for (final raw in list) {
          final m = Map<String, dynamic>.from(raw as Map);
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
                entry.dispatchDate.compareTo(endDate) <= 0 &&
                entry.payAmount > 0) {
              final key = '${entry.dispatchDate}_${entry.routeNo}_${entry.shiftType}';
              shiftMap[key] = entry;
            }
          }
        }
      }
    } catch (e) {
      debugPrint('[TimesheetRepository] API payroll-logs fetch fallback: $e');
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
                entry.dispatchDate.compareTo(endDate) <= 0 &&
                entry.payAmount > 0) {
              final key = '${entry.dispatchDate}_${entry.routeNo}_${entry.shiftType}';
              shiftMap[key] = entry;
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
                entry.dispatchDate.compareTo(endDate) <= 0 &&
                entry.payAmount > 0) {
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
              final rawHours = data['driverEiHours'] ?? data['eiHours'] ?? 2.5;
              final eiHours = rawHours is num
                  ? rawHours.toDouble()
                  : (double.tryParse(rawHours.toString()) ?? 2.5);
              shiftMap[key] = TimesheetShiftEntry(
                id: record.id,
                dispatchDate: record.date,
                routeNo: record.routeNo,
                routeName: record.routeName,
                shiftType: record.shiftType,
                employeeId: resolvedEmpId,
                employeeName: record.driverName.isNotEmpty ? record.driverName : driverName,
                payAmount: record.payrollRate > 0 ? record.payrollRate : 28.50,
                eiHours: eiHours,
                payOption: record.payOption,
                rateSource: 'dispatch_shift',
                checkInTime: record.checkInTime,
                checkOutTime: record.checkOutTime,
                status: record.isCheckedOut
                    ? 'approved'
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
                payAmount: rec.payrollRate > 0 ? rec.payrollRate : 28.50,
                eiHours: 2.50,
                payOption: rec.payOption,
                rateSource: 'dispatch_shift',
                checkInTime: rec.checkInTime,
                checkOutTime: rec.checkOutTime,
                status: rec.isCheckedOut
                    ? 'approved'
                    : (rec.isCheckedIn ? 'in_progress' : 'scheduled'),
              );
            }
          }
        } catch (_) {}
      }
    }

    // 5. Fallback / Demo Route Shifts if no shifts found for the 2-week period
    // Ensures synchronized experience with assigned route in demo/offline or historical periods
    final assignedRoute = await routeRepository?.getAssignedRoute(driverId);
    final defaultRouteNo = assignedRoute?.routeNo ?? 'OCDSB-001';
    final defaultRouteName = assignedRoute?.routeName ?? 'Route 001 - Hillcrest High School';

    if (shiftMap.isEmpty) {
      final todayStr = formatDate(DateTime.now());
      for (int i = 0; i < 14; i++) {
        final dateStr = addDays(startDate, i);
        final dt = parseDate(dateStr);
        // Only Monday (1) to Friday (5)
        if (dt.weekday >= DateTime.monday && dt.weekday <= DateTime.friday) {
          if (predefinedHolidays.containsKey(dateStr)) {
            continue; // Handled in step 6 below as statutory holiday credit
          }
          final isPastOrToday = dateStr.compareTo(todayStr) <= 0;
          final amKey = '${dateStr}_${defaultRouteNo}_AM';
          final pmKey = '${dateStr}_${defaultRouteNo}_PM';

          shiftMap[amKey] = TimesheetShiftEntry(
            id: 'TS-$dateStr-AM',
            dispatchDate: dateStr,
            routeNo: defaultRouteNo,
            routeName: defaultRouteName,
            shiftType: 'AM',
            employeeId: resolvedEmpId,
            employeeName: driverName,
            payAmount: 28.50,
            eiHours: 2.50,
            payOption: 'STANDARD',
            rateSource: 'board_base_rate',
            checkInTime: isPastOrToday ? '07:15 AM' : null,
            checkOutTime: isPastOrToday ? '08:45 AM' : null,
            status: isPastOrToday ? 'approved' : 'scheduled',
          );

          shiftMap[pmKey] = TimesheetShiftEntry(
            id: 'TS-$dateStr-PM',
            dispatchDate: dateStr,
            routeNo: defaultRouteNo,
            routeName: defaultRouteName,
            shiftType: 'PM',
            employeeId: resolvedEmpId,
            employeeName: driverName,
            payAmount: 28.50,
            eiHours: 2.50,
            payOption: 'STANDARD',
            rateSource: 'board_base_rate',
            checkInTime: isPastOrToday ? '02:35 PM' : null,
            checkOutTime: isPastOrToday ? '04:05 PM' : null,
            status: isPastOrToday ? 'approved' : 'scheduled',
          );
        }
      }
    }

    // 6. Statutory Holiday Route Assignment Credits (Synchronized with BiweeklyPayrollView.tsx)
    predefinedHolidays.forEach((holDate, holName) {
      if (holDate.compareTo(startDate) >= 0 && holDate.compareTo(endDate) <= 0) {
        final dt = parseDate(holDate);
        if (dt.weekday >= DateTime.monday && dt.weekday <= DateTime.friday) {
          // Determine driver's primary route and rate from period shifts or assigned route
          final existingShift = shiftMap.values.firstOrNull;
          final routeNo = existingShift?.routeNo ?? defaultRouteNo;
          final routeName = existingShift?.routeName ?? defaultRouteName;
          final rate = existingShift?.payAmount ?? 28.50;
          final hrs = existingShift?.eiHours ?? 2.50;

          final amKey = '${holDate}_${routeNo}_AM';
          final pmKey = '${holDate}_${routeNo}_PM';

          if (!shiftMap.containsKey(amKey)) {
            shiftMap[amKey] = TimesheetShiftEntry(
              id: 'HOLIDAY-$holDate-$routeNo-AM',
              dispatchDate: holDate,
              routeNo: routeNo,
              routeName: routeName,
              shiftType: 'AM',
              employeeId: resolvedEmpId,
              employeeName: driverName,
              payAmount: rate,
              eiHours: hrs,
              payOption: 'STANDARD',
              rateSource: 'holiday_route_assignment',
              rateDescription: 'Statutory Holiday Credit: $holName',
              status: 'holiday_credit',
              isHolidayCredit: true,
            );
          }
          if (!shiftMap.containsKey(pmKey)) {
            shiftMap[pmKey] = TimesheetShiftEntry(
              id: 'HOLIDAY-$holDate-$routeNo-PM',
              dispatchDate: holDate,
              routeNo: routeNo,
              routeName: routeName,
              shiftType: 'PM',
              employeeId: resolvedEmpId,
              employeeName: driverName,
              payAmount: rate,
              eiHours: hrs,
              payOption: 'STANDARD',
              rateSource: 'holiday_route_assignment',
              rateDescription: 'Statutory Holiday Credit: $holName',
              status: 'holiday_credit',
              isHolidayCredit: true,
            );
          }
        }
      }
    });

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
      if (s.dispatchDate.compareTo(week1EndDate) <= 0) {
        week1Shifts.add(s);
        week1Pay += s.payAmount;
        week1Hours += s.eiHours;
      } else {
        week2Shifts.add(s);
        week2Pay += s.payAmount;
        week2Hours += s.eiHours;
      }
      if (s.isHolidayCredit) {
        holidayShiftsCount += 1;
        holidayPay += s.payAmount;
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
            approvedExpensesAmount += c.totalAmount;
            approvedExpensesCount += 1;
          }
        }
      } catch (_) {}
    }

    final totalPay = double.parse((week1Pay + week2Pay).toStringAsFixed(2));
    final totalHours = double.parse((week1Hours + week2Hours).toStringAsFixed(2));
    final netTotalPayout = double.parse((totalPay + approvedExpensesAmount).toStringAsFixed(2));

    return BiweeklyTimesheetSummary(
      startDate: startDate,
      endDate: endDate,
      week1EndDate: week1EndDate,
      week2StartDate: week2StartDate,
      shifts: allShifts,
      week1Shifts: week1Shifts,
      week2Shifts: week2Shifts,
      week1Pay: double.parse(week1Pay.toStringAsFixed(2)),
      week1Hours: double.parse(week1Hours.toStringAsFixed(2)),
      week2Pay: double.parse(week2Pay.toStringAsFixed(2)),
      week2Hours: double.parse(week2Hours.toStringAsFixed(2)),
      totalPay: totalPay,
      totalHours: totalHours,
      holidayShiftsCount: holidayShiftsCount,
      holidayPay: double.parse(holidayPay.toStringAsFixed(2)),
      approvedExpensesAmount: double.parse(approvedExpensesAmount.toStringAsFixed(2)),
      approvedExpensesCount: approvedExpensesCount,
      netTotalPayout: netTotalPayout,
    );
  }
}
