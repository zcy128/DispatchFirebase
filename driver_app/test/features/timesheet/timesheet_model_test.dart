import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/timesheet/models/timesheet_model.dart';
import 'package:driver_app/features/timesheet/repository/timesheet_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('TimesheetShiftEntry Tests', () {
    test('calculates hourlyRate correctly for positive eiHours', () {
      const entry = TimesheetShiftEntry(
        id: 'shift-1',
        dispatchDate: '2026-11-02',
        routeNo: 'R-101',
        routeName: 'Hillcrest High AM',
        shiftType: 'AM',
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        payAmount: 60.0,
        eiHours: 2.5,
      );

      expect(entry.hourlyRate, equals(24.0));
    });

    test('returns 0.0 for hourlyRate when eiHours is zero or negative to prevent divide-by-zero', () {
      const zeroHoursEntry = TimesheetShiftEntry(
        id: 'shift-zero',
        dispatchDate: '2026-11-02',
        routeNo: 'R-101',
        routeName: 'Hillcrest High AM',
        shiftType: 'AM',
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        payAmount: 50.0,
        eiHours: 0.0,
      );
      expect(zeroHoursEntry.hourlyRate, equals(0.0));

      const negativeHoursEntry = TimesheetShiftEntry(
        id: 'shift-neg',
        dispatchDate: '2026-11-02',
        routeNo: 'R-101',
        routeName: 'Hillcrest High AM',
        shiftType: 'AM',
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        payAmount: 50.0,
        eiHours: -1.5,
      );
      expect(negativeHoursEntry.hourlyRate, equals(0.0));
    });

    test('equality and props support comparison', () {
      const entry1 = TimesheetShiftEntry(
        id: 'shift-1',
        dispatchDate: '2026-11-02',
        routeNo: 'R-101',
        routeName: 'Route 101',
        shiftType: 'AM',
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        payAmount: 50.0,
        eiHours: 2.0,
      );

      const entry2 = TimesheetShiftEntry(
        id: 'shift-1',
        dispatchDate: '2026-11-02',
        routeNo: 'R-101',
        routeName: 'Route 101',
        shiftType: 'AM',
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        payAmount: 50.0,
        eiHours: 2.0,
      );

      expect(entry1, equals(entry2));
    });
  });

  group('BiweeklyTimesheetSummary Tests', () {
    const shift1 = TimesheetShiftEntry(
      id: 's-1',
      dispatchDate: '2026-11-02',
      routeNo: 'R-101',
      routeName: 'Route 101 AM',
      shiftType: 'AM',
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      payAmount: 50.0,
      eiHours: 2.0,
    );

    const shift2 = TimesheetShiftEntry(
      id: 's-2',
      dispatchDate: '2026-11-02',
      routeNo: 'R-101',
      routeName: 'Route 101 PM',
      shiftType: 'PM',
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      payAmount: 50.0,
      eiHours: 2.0,
    );

    const shift3 = TimesheetShiftEntry(
      id: 's-3',
      dispatchDate: '2026-11-09',
      routeNo: 'R-101',
      routeName: 'Route 101 AM',
      shiftType: 'AM',
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      payAmount: 50.0,
      eiHours: 2.0,
    );

    test('counts and getters return expected values', () {
      const summary = BiweeklyTimesheetSummary(
        startDate: '2026-11-01',
        endDate: '2026-11-14',
        week1EndDate: '2026-11-07',
        week2StartDate: '2026-11-08',
        shifts: [shift1, shift2, shift3],
        week1Shifts: [shift1, shift2],
        week2Shifts: [shift3],
        week1Pay: 100.0,
        week1Hours: 4.0,
        week2Pay: 50.0,
        week2Hours: 2.0,
        totalPay: 150.0,
        totalHours: 6.0,
        holidayShiftsCount: 1,
        holidayPay: 25.0,
        approvedExpensesAmount: 18.50,
        approvedExpensesCount: 1,
        netTotalPayout: 168.50,
      );

      expect(summary.totalShiftsCount, equals(3));
      expect(summary.week1ShiftsCount, equals(2));
      expect(summary.week2ShiftsCount, equals(1));
      expect(summary.netTotalPayout, equals(168.50));
    });

    test('groupShiftsByDate groups shifts chronologically by date', () {
      const summary = BiweeklyTimesheetSummary(
        startDate: '2026-11-01',
        endDate: '2026-11-14',
        week1EndDate: '2026-11-07',
        week2StartDate: '2026-11-08',
        shifts: [shift1, shift2, shift3],
        week1Shifts: [shift1, shift2],
        week2Shifts: [shift3],
        week1Pay: 100.0,
        week1Hours: 4.0,
        week2Pay: 50.0,
        week2Hours: 2.0,
        totalPay: 150.0,
        totalHours: 6.0,
        netTotalPayout: 150.0,
      );

      final grouped = summary.groupShiftsByDate(summary.shifts);
      expect(grouped.keys.length, equals(2));
      expect(grouped['2026-11-02'], containsAll([shift1, shift2]));
      expect(grouped['2026-11-09'], containsAll([shift3]));
    });
  });

  group('TimesheetRepository Utility Tests', () {
    test('formatDate and parseDate format and parse consistently', () {
      final dt = DateTime(2026, 11, 2);
      final formatted = TimesheetRepository.formatDate(dt);
      expect(formatted, equals('2026-11-02'));

      final parsed = TimesheetRepository.parseDate('2026-11-02');
      expect(parsed.year, equals(2026));
      expect(parsed.month, equals(11));
      expect(parsed.day, equals(2));
    });

    test('addDays adds positive and negative days accurately', () {
      expect(TimesheetRepository.addDays('2026-11-01', 13), equals('2026-11-14'));
      expect(TimesheetRepository.addDays('2026-11-14', -13), equals('2026-11-01'));
      expect(TimesheetRepository.addDays('2026-02-28', 1), equals('2026-03-01'));
    });

    test('predefinedHolidays contains expected Canadian statutory holidays', () {
      expect(TimesheetRepository.predefinedHolidays['2026-01-01'], equals("New Year's Day"));
      expect(TimesheetRepository.predefinedHolidays['2026-07-01'], equals('Canada Day'));
      expect(TimesheetRepository.predefinedHolidays['2026-12-25'], equals('Christmas Day'));
    });
  });
}
