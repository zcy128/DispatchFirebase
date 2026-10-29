import 'package:equatable/equatable.dart';

class TimesheetShiftEntry extends Equatable {
  final String id;
  final String dispatchDate; // yyyy-MM-dd
  final String routeNo;
  final String routeName;
  final String shiftType; // 'AM' | 'PM' | 'MIDDAY' | 'EXTRA' | 'CHARTER'
  final String employeeId;
  final String employeeName;
  final double payAmount;
  final double eiHours;
  final String payOption;
  final String rateSource;
  final String? rateDescription;
  final String? checkInTime;
  final String? checkOutTime;
  final String status; // 'approved' | 'pending_approval' | 'completed' | 'scheduled' | 'holiday_credit'
  final bool isHolidayCredit;
  final bool isCharter;

  const TimesheetShiftEntry({
    required this.id,
    required this.dispatchDate,
    required this.routeNo,
    required this.routeName,
    required this.shiftType,
    required this.employeeId,
    required this.employeeName,
    required this.payAmount,
    required this.eiHours,
    this.payOption = 'STANDARD',
    this.rateSource = 'board_base_rate',
    this.rateDescription,
    this.checkInTime,
    this.checkOutTime,
    this.status = 'approved',
    this.isHolidayCredit = false,
    this.isCharter = false,
  });

  double get hourlyRate => eiHours > 0 ? (payAmount / eiHours) : 0.0;

  @override
  List<Object?> get props => [
        id,
        dispatchDate,
        routeNo,
        routeName,
        shiftType,
        employeeId,
        employeeName,
        payAmount,
        eiHours,
        payOption,
        rateSource,
        rateDescription,
        checkInTime,
        checkOutTime,
        status,
        isHolidayCredit,
        isCharter,
      ];
}

class BiweeklyTimesheetSummary extends Equatable {
  final String startDate; // yyyy-MM-dd
  final String endDate; // yyyy-MM-dd
  final String week1EndDate; // yyyy-MM-dd
  final String week2StartDate; // yyyy-MM-dd
  final List<TimesheetShiftEntry> shifts;
  final List<TimesheetShiftEntry> week1Shifts;
  final List<TimesheetShiftEntry> week2Shifts;
  final double week1Pay;
  final double week1Hours;
  final double week2Pay;
  final double week2Hours;
  final double totalPay;
  final double totalHours;
  final int holidayShiftsCount;
  final double holidayPay;
  final double approvedExpensesAmount;
  final int approvedExpensesCount;
  final double netTotalPayout;

  const BiweeklyTimesheetSummary({
    required this.startDate,
    required this.endDate,
    required this.week1EndDate,
    required this.week2StartDate,
    required this.shifts,
    required this.week1Shifts,
    required this.week2Shifts,
    required this.week1Pay,
    required this.week1Hours,
    required this.week2Pay,
    required this.week2Hours,
    required this.totalPay,
    required this.totalHours,
    this.holidayShiftsCount = 0,
    this.holidayPay = 0.0,
    this.approvedExpensesAmount = 0.0,
    this.approvedExpensesCount = 0,
    required this.netTotalPayout,
  });

  int get totalShiftsCount => shifts.length;
  int get week1ShiftsCount => week1Shifts.length;
  int get week2ShiftsCount => week2Shifts.length;

  /// Groups shifts by date (yyyy-MM-dd) in chronological order.
  Map<String, List<TimesheetShiftEntry>> groupShiftsByDate(List<TimesheetShiftEntry> source) {
    final map = <String, List<TimesheetShiftEntry>>{};
    for (final s in source) {
      map.putIfAbsent(s.dispatchDate, () => []).add(s);
    }
    return map;
  }

  @override
  List<Object?> get props => [
        startDate,
        endDate,
        week1EndDate,
        week2StartDate,
        shifts,
        week1Shifts,
        week2Shifts,
        week1Pay,
        week1Hours,
        week2Pay,
        week2Hours,
        totalPay,
        totalHours,
        holidayShiftsCount,
        holidayPay,
        approvedExpensesAmount,
        approvedExpensesCount,
        netTotalPayout,
      ];
}
