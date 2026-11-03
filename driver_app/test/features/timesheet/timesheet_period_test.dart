import 'package:driver_app/features/timesheet/repository/timesheet_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('biweekly period keeps 14 calendar days across daylight saving time', () {
    final start = TimesheetRepository.getDefaultBiweeklyStartDate(
      DateTime(2026, 11, 2, 21),
    );

    expect(TimesheetRepository.formatDate(start), '2026-10-25');
    expect(TimesheetRepository.addDays('2026-10-25', 6), '2026-10-31');
    expect(TimesheetRepository.addDays('2026-10-25', 7), '2026-11-01');
    expect(TimesheetRepository.addDays('2026-10-25', 13), '2026-11-07');
    expect(TimesheetRepository.addDays('2026-03-07', 2), '2026-03-09');
  });
}
