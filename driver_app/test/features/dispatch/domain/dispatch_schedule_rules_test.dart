import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/dispatch/domain/dispatch_schedule_rules.dart';

void main() {
  group('DispatchScheduleRules', () {
    test('normalizeDate strips hour, minute, and second components', () {
      final normalized = DispatchScheduleRules.normalizeDate(
        DateTime(2026, 11, 18, 14, 35, 22),
      );
      expect(normalized, DateTime(2026, 11, 18));
    });

    test('isWithinAllowedWindow enforces 7-day past and future bounds', () {
      final ref = DateTime(2026, 11, 18, 9, 0);
      expect(
        DispatchScheduleRules.isWithinAllowedWindow(DateTime(2026, 11, 11), referenceToday: ref),
        isTrue,
      );
      expect(
        DispatchScheduleRules.isWithinAllowedWindow(DateTime(2026, 11, 25), referenceToday: ref),
        isTrue,
      );
      expect(
        DispatchScheduleRules.isWithinAllowedWindow(DateTime(2026, 11, 10), referenceToday: ref),
        isFalse,
      );
      expect(
        DispatchScheduleRules.isWithinAllowedWindow(DateTime(2026, 11, 26), referenceToday: ref),
        isFalse,
      );
    });

    test('getNextOperatingDate skips weekends', () {
      // 2026-11-20 is Friday -> Monday 2026-11-23
      expect(
        DispatchScheduleRules.getNextOperatingDate(DateTime(2026, 11, 20)),
        DateTime(2026, 11, 23),
      );
      // 2026-11-21 is Saturday -> Monday 2026-11-23
      expect(
        DispatchScheduleRules.getNextOperatingDate(DateTime(2026, 11, 21)),
        DateTime(2026, 11, 23),
      );
      // 2026-11-18 is Wednesday -> Thursday 2026-11-19
      expect(
        DispatchScheduleRules.getNextOperatingDate(DateTime(2026, 11, 18)),
        DateTime(2026, 11, 19),
      );
    });
  });
}
