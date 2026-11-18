/// Pure Dart domain rules for dispatch schedule windows and operating dates.
class DispatchScheduleRules {
  const DispatchScheduleRules._();

  /// Strips time components so date comparisons operate on calendar days.
  static DateTime normalizeDate(DateTime dt) {
    return DateTime(dt.year, dt.month, dt.day);
  }

  /// Returns true when [targetDate] falls within the 2-week rolling window
  /// (`referenceToday - 7 days` through `referenceToday + 7 days`).
  static bool isWithinAllowedWindow(
    DateTime targetDate, {
    DateTime? referenceToday,
  }) {
    final today = normalizeDate(referenceToday ?? DateTime.now());
    final target = normalizeDate(targetDate);
    final minDate = DateTime(today.year, today.month, today.day - 7);
    final maxDate = DateTime(today.year, today.month, today.day + 7);
    return !target.isBefore(minDate) && !target.isAfter(maxDate);
  }

  /// Returns true when [targetDate] is the same calendar day as [referenceToday].
  static bool isToday(
    DateTime targetDate, {
    DateTime? referenceToday,
  }) {
    final today = normalizeDate(referenceToday ?? DateTime.now());
    final target = normalizeDate(targetDate);
    return today.isAtSameMomentAs(target);
  }

  /// Advances [fromDate] to the next school bus operating weekday, skipping weekends.
  static DateTime getNextOperatingDate(DateTime fromDate) {
    final norm = normalizeDate(fromDate);
    if (norm.weekday == DateTime.friday) {
      return norm.add(const Duration(days: 3));
    }
    if (norm.weekday == DateTime.saturday) {
      return norm.add(const Duration(days: 2));
    }
    return norm.add(const Duration(days: 1));
  }
}
