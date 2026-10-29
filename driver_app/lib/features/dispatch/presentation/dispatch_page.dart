import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../core/feedback_utils.dart';
import '../../../core/widgets/google_route_map_card.dart';
import '../bloc/dispatch_bloc.dart';
import '../bloc/dispatch_event.dart';
import '../bloc/dispatch_state.dart';
import '../models/dispatch_model.dart';
import '../repository/dispatch_repository.dart';
import '../../chat/services/chat_notification_service.dart';
import '../../company_contacts/presentation/company_contacts_page.dart';

class DispatchPage extends StatelessWidget {
  final String driverId;
  final VoidCallback? onOpenChat;

  const DispatchPage({
    super.key,
    this.driverId = 'driver1d',
    this.onOpenChat,
  });

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) {
        final repo = context.read<DispatchRepository>();
        final bloc = DispatchBloc(repository: repo);
        bloc.add(LoadDispatchesForDate(DateTime.now(), driverId: driverId));
        bloc.startAutoSync(interval: const Duration(seconds: 4));
        return bloc;
      },
      child: _DispatchPageView(driverId: driverId, onOpenChat: onOpenChat),
    );
  }
}

class _DispatchPageView extends StatelessWidget {
  final String driverId;
  final VoidCallback? onOpenChat;

  const _DispatchPageView({required this.driverId, this.onOpenChat});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocConsumer<DispatchBloc, DispatchState>(
      listener: (context, state) {
        if (state is DispatchLoaded) {
          if (state.errorMessage != null) {
            AppFeedback.showError(
              context,
              title: 'Dispatch Operation Error',
              message: state.errorMessage!,
            );
          } else if (state.actionFeedback != null) {
            AppFeedback.showSuccess(
              context,
              message: state.actionFeedback!,
            );
          }
        }
      },
      builder: (context, state) {
        return Scaffold(
          appBar: AppBar(
            elevation: 0,
            backgroundColor: isDark ? AppColors.darkCard : Colors.white,
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Daily Dispatch Hub',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: AppColors.success,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'LIVE',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppColors.success,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                Text(
                  state is DispatchLoaded
                      ? DateFormat('EEEE, MMM d, yyyy').format(state.selectedDate)
                      : 'Loading schedule...',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
            actions: [
              if (state is DispatchLoaded) ...[
                IconButton(
                  icon: const Icon(Icons.refresh_rounded),
                  tooltip: 'Sync Dispatch Data',
                  onPressed: () {
                    context.read<DispatchBloc>().add(
                          LoadDispatchesForDate(state.selectedDate, driverId: driverId),
                        );
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.calendar_month_rounded),
                  tooltip: 'Pick date (within 2 weeks)',
                  onPressed: () => _pickCalendarDate(context, state.selectedDate),
                ),
              ],
              IconButton(
                tooltip: 'Company Contacts',
                icon: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primary),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const CompanyContactsPage(),
                    ),
                  );
                },
              ),
              if (onOpenChat != null)
                IconButton(
                  tooltip: 'Operations Chat',
                  onPressed: onOpenChat,
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
                ),
            ],
          ),
          body: _buildBody(context, state, isDark),
        );
      },
    );
  }

  Widget _buildBody(BuildContext context, DispatchState state, bool isDark) {
    if (state is DispatchLoading || state is DispatchInitial) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (state is DispatchError) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.warning_amber_rounded, size: 54, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                state.message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () {
                  context.read<DispatchBloc>().add(LoadDispatchesForDate(DateTime.now(), driverId: driverId));
                },
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Return to Today'),
              ),
            ],
          ),
        ),
      );
    }

    if (state is DispatchLoaded) {
      final active = state.activeDispatch;

      return Column(
        children: [
          // Simplified Operating Days Selector: Today & Next Operating Day (skips weekends)
          _OperatingDaysSelector(
            selectedDate: state.selectedDate,
            onDateSelected: (date) {
              context.read<DispatchBloc>().add(LoadDispatchesForDate(date, driverId: driverId));
            },
            onPickCalendar: () => _pickCalendarDate(context, state.selectedDate),
          ),

          // Read-Only / Status Alert Banner
          _buildStatusBanner(context, state),

          Expanded(
            child: active == null
                ? _buildEmptyState(isDark)
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () async {
                      context.read<DispatchBloc>().add(
                            LoadDispatchesForDate(state.selectedDate, driverId: driverId),
                          );
                    },
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      children: [
                      // Shift Selector, Run Summary & Crew Presence Card
                      _ShiftSelectorCard(
                        state: state,
                        activeDispatch: active,
                        isDark: isDark,
                      ),
                      const SizedBox(height: 14),

                      // Interactive Google Maps Route & Stops Card
                      GoogleRouteMapCard(
                        routeTitle: 'Route ${active.routeNo}',
                        shiftLabel: active.shiftType,
                        stops: active.stops.map((st) {
                          final isSchool = st.isSchoolStop ||
                              st.stopType.toLowerCase().contains('school');
                          final displayTitle = isSchool
                              ? ((st.schoolName != null && st.schoolName!.trim().isNotEmpty)
                                  ? st.schoolName!
                                  : st.stopLocation)
                              : st.stopLocation;
                          return MapStopPin(
                            sequence: st.sequence,
                            title: displayTitle,
                            subtitle: isSchool ? st.stopLocation : (st.schoolName ?? ''),
                            scheduledTime: st.plannedTime,
                            arrivedTime: st.arrivedTime,
                            isSchoolStop: isSchool,
                            isCompleted: st.isArrived,
                            schoolNameHint: st.schoolName ?? active.routeName,
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 18),

                      // Stops and Attendance Manifest Header
                      Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        runSpacing: 6,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.timeline_rounded, size: 16, color: AppColors.primary),
                              const SizedBox(width: 6),
                              Text(
                                'MANIFEST (${active.stops.length} STOPS)',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.8,
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: isDark ? AppColors.darkCard : const Color(0xFFE2E8F0),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              active.isCheckedIn && !active.isCheckedOut
                                  ? '${active.shiftType} · Unfolded'
                                  : '${active.shiftType} · Collapsed',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: active.isCheckedIn && !active.isCheckedOut
                                    ? AppColors.primary
                                    : (isDark ? Colors.white70 : AppColors.textPrimaryLight),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      ...active.stops.map((stop) => _StopCard(
                            key: ValueKey('stop_${stop.stopId}_${stop.isArrived}'),
                            stop: stop,
                            dispatch: active,
                            isReadOnly: state.isReadOnly,
                            isDark: isDark,
                          )),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
          ),
        ],
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildStatusBanner(BuildContext context, DispatchLoaded state) {
    if (!state.isToday) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: const Color(0xFF334155),
        child: const Row(
          children: [
            Icon(Icons.lock_clock_rounded, color: Colors.amber, size: 18),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'ARCHIVED / FUTURE RUN (READ-ONLY) - Dispatches outside today can be inspected but not edited.',
                style: TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      );
    }

    final active = state.activeDispatch;
    if (active != null && active.isCheckedOut) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: const Color(0xFF1E293B),
        child: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 18),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'SHIFT COMPLETED & LOCKED - Checked out at ${active.checkOutTime}. Manifest is finalized.',
                style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      );
    }

    if (active != null && !active.isCheckedIn) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: AppColors.primary.withValues(alpha: 0.15),
        child: const Row(
          children: [
            Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 18),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'DRIVER ACTION REQUIRED - Please check in below before departing the yard.',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.event_busy_rounded, size: 56, color: isDark ? Colors.grey[700] : Colors.grey[400]),
          const SizedBox(height: 14),
          const Text('No dispatches scheduled for this date.', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Select another day within the active window.', style: TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }

  Future<void> _pickCalendarDate(BuildContext context, DateTime currentSelected) async {
    final now = DateTime.now();
    final firstAllowed = now.subtract(const Duration(days: 7));
    final lastAllowed = now.add(const Duration(days: 7));

    final picked = await showDatePicker(
      context: context,
      initialDate: currentSelected,
      firstDate: firstAllowed,
      lastDate: lastAllowed,
      helpText: 'SELECT DATE (2-WEEK LIMIT)',
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.fromSeed(
              seedColor: AppColors.primary,
              brightness: Theme.of(context).brightness,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null && context.mounted) {
      context.read<DispatchBloc>().add(LoadDispatchesForDate(picked, driverId: driverId));
    }
  }
}

/// Compact Operating Days Selector: Today vs Next Operating Day (automatically skips weekend days)
class _OperatingDaysSelector extends StatelessWidget {
  final DateTime selectedDate;
  final ValueChanged<DateTime> onDateSelected;
  final VoidCallback onPickCalendar;

  const _OperatingDaysSelector({
    required this.selectedDate,
    required this.onDateSelected,
    required this.onPickCalendar,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final now = DateTime.now();
    final today = DispatchRepository.normalizeDate(now);
    final nextOperatingDay = DispatchRepository.getNextOperatingDate(today);

    final isSelectedToday = DispatchRepository.normalizeDate(selectedDate).isAtSameMomentAs(today);
    final isSelectedNext = DispatchRepository.normalizeDate(selectedDate).isAtSameMomentAs(nextOperatingDay);
    final isOtherDate = !isSelectedToday && !isSelectedNext;

    final nextLabel = today.weekday == DateTime.friday || today.weekday == DateTime.saturday
        ? 'Monday'
        : 'Tomorrow';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
          ),
        ),
      ),
      child: Row(
        children: [
          // Today Tab
          Expanded(
            child: _buildDayTab(
              title: 'Today',
              dateStr: DateFormat('EEE, MMM d').format(today),
              isSelected: isSelectedToday,
              isDark: isDark,
              onTap: () => onDateSelected(today),
            ),
          ),
          const SizedBox(width: 10),

          // Next Operating Day Tab (auto skips Saturday & Sunday!)
          Expanded(
            child: _buildDayTab(
              title: '$nextLabel Run',
              dateStr: DateFormat('EEE, MMM d').format(nextOperatingDay),
              isSelected: isSelectedNext,
              isDark: isDark,
              onTap: () => onDateSelected(nextOperatingDay),
            ),
          ),
          const SizedBox(width: 10),

          // Calendar picker for archives within 2-week boundary
          InkWell(
            onTap: onPickCalendar,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: isOtherDate
                    ? AppColors.primary
                    : isDark
                        ? const Color(0xFF1E293B)
                        : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isOtherDate
                      ? AppColors.primary
                      : isDark
                          ? AppColors.darkCardBorder
                          : AppColors.lightCardBorder,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.calendar_month_rounded,
                    size: 18,
                    color: isOtherDate
                        ? const Color(0xFF0F172A)
                        : isDark
                            ? Colors.white70
                            : Colors.black87,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isOtherDate ? DateFormat('MMM d').format(selectedDate) : 'Archive',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      color: isOtherDate
                          ? const Color(0xFF0F172A)
                          : isDark
                              ? Colors.grey
                              : Colors.black54,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDayTab({
    required String title,
    required String dateStr,
    required bool isSelected,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary
              : isDark
                  ? const Color(0xFF1E293B)
                  : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.transparent,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              title.toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
                color: isSelected
                    ? const Color(0xFF0F172A)
                    : isDark
                        ? AppColors.textSecondaryDark
                        : AppColors.textSecondaryLight,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              dateStr,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isSelected
                    ? const Color(0xFF0F172A)
                    : isDark
                        ? Colors.white
                        : AppColors.textPrimaryLight,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shift Selector, Run Overview & Attendant Presence Card
class _ShiftSelectorCard extends StatelessWidget {
  final DispatchLoaded state;
  final DispatchRecord activeDispatch;
  final bool isDark;

  const _ShiftSelectorCard({
    required this.state,
    required this.activeDispatch,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final hasAttendant = activeDispatch.attendantName != null && activeDispatch.attendantName!.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Shift Toggle Pills (AM vs PM)
          Row(
            children: state.dispatches.map((disp) {
              final isCurrent = disp.id == activeDispatch.id;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ElevatedButton(
                    onPressed: () {
                      context.read<DispatchBloc>().add(SelectDispatch(disp.id));
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isCurrent ? AppColors.primary : (isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9)),
                      foregroundColor: isCurrent ? const Color(0xFF0F172A) : (isDark ? Colors.white : Colors.black87),
                      elevation: isCurrent ? 2 : 0,
                      minimumSize: const Size(0, 42),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text(
                      '${disp.shiftType} Run (${disp.stops.length} Stops)',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),

          // Direction C: Micro-Stepper Progress Bar for Regular Route Shift
          if (activeDispatch.stops.isNotEmpty) ...[
            Builder(builder: (context) {
              final total = activeDispatch.stops.length;
              final arrivedCount = activeDispatch.stops.where((s) => s.isArrived).length;
              final pct = total > 0 ? ((arrivedCount / total) * 100).toInt() : 0;
              final isComplete = arrivedCount == total;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF141926) : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'MISSION PROGRESS: $arrivedCount / $total STOPS',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                          ),
                        ),
                        Text(
                          isComplete ? 'RUN COMPLETED' : '$pct% EN-ROUTE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: isComplete ? AppColors.success : AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: List.generate(total, (idx) {
                        final isDone = activeDispatch.stops[idx].isArrived;
                        final isCurrent = !isDone && (idx == 0 || activeDispatch.stops[idx - 1].isArrived);
                        return Expanded(
                          child: Container(
                            height: 4,
                            margin: EdgeInsets.only(right: idx == total - 1 ? 0 : 2),
                            decoration: BoxDecoration(
                              color: isDone
                                  ? AppColors.success
                                  : isCurrent
                                      ? AppColors.primary
                                      : (isDark ? Colors.grey.shade800 : Colors.grey.shade300),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              );
            }),
          ],

          // Route Details
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.directions_bus_rounded, color: AppColors.primary, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      activeDispatch.routeName,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Route ${activeDispatch.routeNo} · Bus ${activeDispatch.vehicleUnit} · ${activeDispatch.yardName}',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Attendant Presence & Login Status Section (Clickable to view phone & call)
          if (hasAttendant) ...[
            const SizedBox(height: 12),
            InkWell(
              onTap: () => _showAttendantDetailsModal(context, activeDispatch),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: activeDispatch.attendantStatus == 'online'
                        ? AppColors.success.withValues(alpha: 0.3)
                        : Colors.transparent,
                  ),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 17,
                      backgroundColor: activeDispatch.attendantStatus == 'online'
                          ? AppColors.success.withValues(alpha: 0.2)
                          : Colors.grey.withValues(alpha: 0.2),
                      child: Icon(
                        Icons.person_pin_rounded,
                        size: 20,
                        color: activeDispatch.attendantStatus == 'online'
                            ? AppColors.success
                            : Colors.grey,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                activeDispatch.attendantName!,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: activeDispatch.attendantStatus == 'online'
                                      ? AppColors.success.withValues(alpha: 0.15)
                                      : Colors.grey.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: activeDispatch.attendantStatus == 'online'
                                            ? AppColors.success
                                            : Colors.grey,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      activeDispatch.attendantStatus == 'online' ? 'ONLINE' : 'OFFLINE',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: activeDispatch.attendantStatus == 'online'
                                            ? AppColors.success
                                            : Colors.grey,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Assigned Attendant · Tap to view phone & call',
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'View Phone',
                      icon: const Icon(Icons.phone_rounded, color: AppColors.primary, size: 20),
                      onPressed: () => _showAttendantDetailsModal(context, activeDispatch),
                    ),
                  ],
                ),
              ),
            ),
          ],

          const Divider(height: 24),

          // Lifecycle Action Button (Check-In / Check-Out)
          if (state.isToday) ...[
            if (!activeDispatch.isCheckedIn)
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () {
                    context.read<DispatchBloc>().add(DriverCheckInEvent(activeDispatch.id));
                  },
                  icon: const Icon(Icons.login_rounded, size: 20),
                  label: const Text(
                    'DRIVER CHECK-IN & START RUN',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: const Color(0xFF0F172A),
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              )
            else if (!activeDispatch.isCheckedOut) ...[
              // Shift Payroll Rate Info Card (Prominently displayed near checkout button)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isDark ? Colors.white12 : Colors.black12,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.attach_money_rounded,
                        color: AppColors.primary,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Shift Payroll Rate: \$${activeDispatch.payrollRate.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  activeDispatch.payOption,
                                  style: const TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Unsatisfied with rate/hours? Add dispute comments during check-out.',
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Checked In at ${activeDispatch.checkInTime}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.success,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton.icon(
                    onPressed: () => _confirmCheckOut(context, activeDispatch),
                    icon: const Icon(Icons.logout_rounded, size: 16),
                    label: const Text('Check-Out'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF334155),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(130, 44),
                    ),
                  ),
                ],
              ),
            ] else
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    Text(
                      'Checked In: ${activeDispatch.checkInTime}  |  Checked Out: ${activeDispatch.checkOutTime}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.success),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Payroll Rate: \$${activeDispatch.payrollRate.toStringAsFixed(2)} (${activeDispatch.payOption})',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey),
                    ),
                    if (activeDispatch.driverCheckoutComments != null &&
                        activeDispatch.driverCheckoutComments!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.amber.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.rate_review_rounded, size: 14, color: Colors.amber),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Needs Review (Comments): "${activeDispatch.driverCheckoutComments}"',
                                style: const TextStyle(fontSize: 11, color: Colors.amber, fontWeight: FontWeight.w500),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
          ] else ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  activeDispatch.isCheckedOut
                      ? 'Archived Run: Completed at ${activeDispatch.checkOutTime}'
                      : 'Upcoming Scheduled Run: Unmodified',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showAttendantDetailsModal(BuildContext context, DispatchRecord dispatch) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final phone = dispatch.attendantPhone ?? '+1 (613) 555-0184';
    final isOnline = dispatch.attendantStatus == 'online';

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppColors.darkCard : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (modalCtx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: isOnline
                          ? AppColors.success.withValues(alpha: 0.2)
                          : Colors.grey.withValues(alpha: 0.2),
                      child: Icon(
                        Icons.person_rounded,
                        size: 28,
                        color: isOnline ? AppColors.success : Colors.grey,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            dispatch.attendantName ?? 'Attendant Crew',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: isOnline ? AppColors.success : Colors.grey,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                isOnline ? 'Logged In · Mobile App Active' : 'Currently Offline',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: isOnline ? AppColors.success : Colors.grey,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.of(modalCtx).pop(),
                    ),
                  ],
                ),
                const Divider(height: 28),
                const Text(
                  'STAFF CONTACT PHONE NUMBER',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 0.8),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.phone_iphone_rounded, color: AppColors.primary, size: 22),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          phone,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Copy Number',
                        icon: const Icon(Icons.copy_rounded, size: 18),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: phone));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Attendant phone number copied to clipboard!'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.of(modalCtx).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Calling attendant Claire Dufresne at $phone...'),
                          backgroundColor: AppColors.primaryDark,
                        ),
                      );
                    },
                    icon: const Icon(Icons.call_rounded),
                    label: Text('Call $phone'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: const Color(0xFF0F172A),
                      minimumSize: const Size(double.infinity, 48),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }

  void _confirmCheckOut(BuildContext context, DispatchRecord dispatch) {
    final commentsController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.assignment_turned_in_rounded, color: AppColors.primary, size: 22),
            SizedBox(width: 8),
            Text('Confirm Driver Check-Out'),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Once checked out, attendance for this shift will be finalized and locked from further changes.',
                style: TextStyle(fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 14),
              // Payroll Rate Information Card
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.attach_money_rounded, color: AppColors.primary, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Assigned Payroll Rate: \$${dispatch.payrollRate.toStringAsFixed(2)}',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Pay Option: ${dispatch.payOption}',
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Rate Dispute or Checkout Comments:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              const Text(
                'If unsatisfied with this rate, hours, or experienced delays, enter notes below for Dispatcher Review.',
                style: TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: commentsController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Enter payroll comments or dispute reasons...',
                  hintStyle: const TextStyle(fontSize: 12),
                  contentPadding: const EdgeInsets.all(12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final comments = commentsController.text.trim();
              Navigator.of(dialogCtx).pop();
              context.read<DispatchBloc>().add(
                    DriverCheckOutEvent(
                      dispatch.id,
                      payrollComments: comments.isNotEmpty ? comments : null,
                    ),
                  );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: const Color(0xFF0F172A),
            ),
            child: const Text('Confirm Check-Out'),
          ),
        ],
      ),
    );
  }
}

/// Stop Card containing stop arrival status, school batch actions, and student list
/// Note: Collapsed by default because drivers may have multiple dispatch shifts!
class _StopCard extends StatefulWidget {
  final DispatchStop stop;
  final DispatchRecord dispatch;
  final bool isReadOnly;
  final bool isDark;

  const _StopCard({
    super.key,
    required this.stop,
    required this.dispatch,
    required this.isReadOnly,
    required this.isDark,
  });

  @override
  State<_StopCard> createState() => _StopCardState();
}

class _StopCardState extends State<_StopCard> {
  // Direction C: Only keep the active ongoing stop expanded; keep completed stops collapsed to eliminate cognitive load
  late bool _isExpanded;

  bool get _isCurrentActiveStop {
    final stops = widget.dispatch.stops;
    final activeIdx = stops.indexWhere((s) => !s.isArrived);
    return activeIdx >= 0 && stops[activeIdx].stopId == widget.stop.stopId;
  }

  @override
  void initState() {
    super.initState();
    _isExpanded = _isCurrentActiveStop || (!widget.stop.isArrived && widget.dispatch.isCheckedIn && !widget.dispatch.isCheckedOut);
  }

  @override
  void didUpdateWidget(covariant _StopCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.dispatch.isCheckedIn && widget.dispatch.isCheckedIn) {
      _isExpanded = _isCurrentActiveStop;
    } else if (!oldWidget.dispatch.isCheckedOut && widget.dispatch.isCheckedOut) {
      _isExpanded = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final stop = widget.stop;
    final dispatch = widget.dispatch;
    final isReadOnly = widget.isReadOnly;
    final isDark = widget.isDark;

    final canOperate = !isReadOnly && dispatch.isCheckedIn && !dispatch.isCheckedOut;

    // Student summary counts
    final pickedUpCount = stop.students.where((s) => s.isPickedUp).length;
    final absentCount = stop.students.where((s) => s.isAbsent).length;
    final droppedOffCount = stop.students.where((s) => s.isDroppedOff).length;
    final allRidersAbsent = !stop.isSchoolStop &&
        stop.students.isNotEmpty &&
        stop.students.every((s) => s.isAbsent);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _isCurrentActiveStop
            ? (isDark ? const Color(0xFF1E283D) : Colors.amber.shade50.withValues(alpha: 0.6))
            : (isDark ? AppColors.darkCard : Colors.white),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _isCurrentActiveStop
              ? AppColors.primary
              : (stop.isArrived
                  ? AppColors.success.withValues(alpha: 0.6)
                  : (stop.isSchoolStop
                      ? AppColors.primary.withValues(alpha: 0.5)
                      : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder))),
          width: _isCurrentActiveStop ? 2.0 : (stop.isArrived || stop.isSchoolStop ? 1.5 : 1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Clickable Stop Header (toggles expansion)
          InkWell(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            borderRadius: BorderRadius.vertical(
              top: const Radius.circular(15),
              bottom: Radius.circular(_isExpanded ? 0 : 15),
            ),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _isCurrentActiveStop
                    ? AppColors.primary.withValues(alpha: 0.12)
                    : (stop.isArrived
                        ? AppColors.success.withValues(alpha: 0.08)
                        : (stop.isSchoolStop
                            ? AppColors.primary.withValues(alpha: 0.1)
                            : (isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC)))),
                borderRadius: BorderRadius.vertical(
                  top: const Radius.circular(15),
                  bottom: Radius.circular(_isExpanded ? 0 : 15),
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: _isCurrentActiveStop
                        ? AppColors.primary
                        : (stop.isArrived
                            ? AppColors.success
                            : (stop.isSchoolStop ? AppColors.primary : (isDark ? Colors.white24 : Colors.black12))),
                    child: stop.isArrived
                        ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                        : Text(
                            '${stop.sequence}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: (_isCurrentActiveStop || stop.isSchoolStop) ? const Color(0xFF0F172A) : (isDark ? Colors.white : Colors.black87),
                            ),
                          ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (_isCurrentActiveStop) ...[
                              Container(
                                margin: const EdgeInsets.only(right: 6),
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                  'ACTIVE',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.black,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                            Expanded(
                              child: Text(
                                stop.isSchoolStop && stop.schoolName != null
                                    ? stop.schoolName!
                                    : stop.stopLocation,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: stop.isSchoolStop
                                    ? AppColors.primary.withValues(alpha: 0.2)
                                    : (isDark ? Colors.white10 : Colors.black12),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                _formatStopType(stop.stopType),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: stop.isSchoolStop ? AppColors.primary : Colors.grey,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Wrap(
                          spacing: 8,
                          runSpacing: 2,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              'Planned: ${stop.plannedTime}',
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                              ),
                            ),
                            if (stop.isArrived)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.success.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'Arrived ${stop.arrivedTime}',
                                  style: const TextStyle(fontSize: 10, color: AppColors.success, fontWeight: FontWeight.bold),
                                ),
                              ),
                            if (allRidersAbsent)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.error.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                                ),
                                child: const Text(
                                  'Bypass (All Absent)',
                                  style: TextStyle(fontSize: 10, color: AppColors.error, fontWeight: FontWeight.bold),
                                ),
                              ),
                            if (!_isExpanded)
                              Text(
                                '· ${stop.students.length} Students',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    _isExpanded ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                    color: Colors.grey,
                  ),
                ],
              ),
            ),
          ),

          // If Expanded: reveal School Actions & Student Attendance Manifest
          if (_isExpanded) ...[
            if (stop.isSchoolStop)
              _buildSchoolActionBar(context, canOperate),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (allRidersAbsent)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.error.withValues(alpha: 0.25)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.info_outline_rounded, size: 14, color: AppColors.error),
                          SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'All assigned riders are reported absent. This stop may be bypassed.',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.error),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'STUDENTS (${stop.students.length})',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
                      ),
                      if (pickedUpCount > 0 || absentCount > 0 || droppedOffCount > 0)
                        Text(
                          'P: $pickedUpCount | A: $absentCount | D: $droppedOffCount',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ...stop.students.map((student) => _StudentAttendanceTile(
                        student: student,
                        stop: stop,
                        dispatch: dispatch,
                        canOperate: canOperate,
                        isDark: isDark,
                      )),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSchoolActionBar(BuildContext context, bool canOperate) {
    final isMorningRun = widget.dispatch.shiftType == 'AM';
    final stop = widget.stop;
    final dispatch = widget.dispatch;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        border: Border(
          bottom: BorderSide(
            color: AppColors.primary.withValues(alpha: 0.2),
          ),
        ),
      ),
      child: Wrap(
        spacing: 10,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          // Arrival Button
          if (!stop.isArrived)
            ElevatedButton.icon(
              onPressed: canOperate
                  ? () {
                      context.read<DispatchBloc>().add(
                            RecordStopArrivalEvent(
                              dispatchId: dispatch.id,
                              stopId: stop.stopId,
                            ),
                          );
                    }
                  : null,
              icon: const Icon(Icons.place_rounded, size: 16),
              label: const Text('Arrival at School'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: const Color(0xFF0F172A),
                minimumSize: const Size(0, 36),
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 14),
                  const SizedBox(width: 6),
                  Text(
                    'Arrived at ${stop.arrivedTime}',
                    style: const TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),

          // Batch Action Button (Drop Off All vs Pick Up All)
          if (isMorningRun)
            OutlinedButton.icon(
              onPressed: canOperate
                  ? () {
                      context.read<DispatchBloc>().add(
                            BatchSchoolActionEvent(
                              dispatchId: dispatch.id,
                              stopId: stop.stopId,
                              actionType: 'dropoff_all',
                            ),
                          );
                    }
                  : null,
              icon: const Icon(Icons.people_alt_rounded, size: 16),
              label: const Text('Drop Off All Students'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                minimumSize: const Size(0, 36),
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
            )
          else
            OutlinedButton.icon(
              onPressed: canOperate
                  ? () {
                      context.read<DispatchBloc>().add(
                            BatchSchoolActionEvent(
                              dispatchId: dispatch.id,
                              stopId: stop.stopId,
                              actionType: 'pickup_all',
                            ),
                          );
                    }
                  : null,
              icon: const Icon(Icons.people_alt_rounded, size: 16),
              label: const Text('Pick Up All Students'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                minimumSize: const Size(0, 36),
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
            ),
        ],
      ),
    );
  }

  String _formatStopType(String type) {
    switch (type) {
      case 'home_pickup':
        return 'HOME PICKUP';
      case 'school_dropoff':
        return 'SCHOOL DROPOFF';
      case 'school_pickup':
        return 'SCHOOL PICKUP';
      case 'home_dropoff':
        return 'HOME DROPOFF';
      default:
        return type.toUpperCase();
    }
  }
}

/// Student Attendance Tile with Picked Up / Absent / Dropped Off toggles
class _StudentAttendanceTile extends StatelessWidget {
  final StudentAttendance student;
  final DispatchStop stop;
  final DispatchRecord dispatch;
  final bool canOperate;
  final bool isDark;

  const _StudentAttendanceTile({
    required this.student,
    required this.stop,
    required this.dispatch,
    required this.canOperate,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.black12,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 15,
                backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                child: Text(
                  student.studentName.isNotEmpty ? student.studentName[0] : 'S',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student.studentName,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '${student.studentNo} · ${student.grade} · ${student.homeAddress}',
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Notice banner if student is absent (e.g. reported by parent or dispatcher)
          if (student.isAbsent) ...[
            Container(
              margin: const EdgeInsets.only(top: 2, bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person_off_rounded, size: 14, color: AppColors.error),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      student.notes != null && student.notes!.isNotEmpty
                          ? 'Reported Absent: ${student.notes}'
                          : 'Reported Absent (Parent Notified)',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppColors.error,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Business Rules & Status Action Buttons
          if (stop.stopType == 'home_pickup' || stop.stopType == 'school_pickup') ...[
            // Pickup Stop: Drivers can toggle between Picked Up and Absent before checkout!
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                _buildActionChip(
                  label: student.isPickedUp
                      ? 'Picked Up (${student.pickupTime ?? "Done"})'
                      : 'Pick Up',
                  icon: Icons.check_circle_outline_rounded,
                  isActive: student.isPickedUp,
                  activeColor: AppColors.success,
                  onTap: canOperate
                      ? () {
                          context.read<DispatchBloc>().add(
                                UpdateStudentAttendanceEvent(
                                  dispatchId: dispatch.id,
                                  stopId: stop.stopId,
                                  studentId: student.studentId,
                                  newPickupStatus: 'picked_up',
                                ),
                              );
                        }
                      : null,
                ),
                _buildActionChip(
                  label: student.isAbsent
                      ? (student.notes != null && student.notes!.isNotEmpty
                          ? 'Absent (${student.notes})'
                          : 'Absent (Notified)')
                      : 'Mark Absent',
                  icon: Icons.cancel_outlined,
                  isActive: student.isAbsent,
                  activeColor: AppColors.error,
                  onTap: canOperate
                      ? () {
                          context.read<DispatchBloc>().add(
                                UpdateStudentAttendanceEvent(
                                  dispatchId: dispatch.id,
                                  stopId: stop.stopId,
                                  studentId: student.studentId,
                                  newPickupStatus: 'absent',
                                ),
                              );
                        }
                      : null,
                ),
              ],
            ),
          ] else if (stop.stopType == 'school_dropoff') ...[
            // School Dropoff Stop in Morning Run:
            // Constraint: If absent at home, cannot be dropped off at school!
            if (student.isAbsent || student.dropoffStatus == 'bypassed_absent') ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.block_rounded, size: 14, color: AppColors.error),
                    const SizedBox(width: 6),
                    Text(
                      student.notes != null && student.notes!.isNotEmpty
                          ? 'Absent (${student.notes}) · School Dropoff Blocked'
                          : 'Absent at Pickup · School Dropoff Blocked',
                      style: const TextStyle(fontSize: 11, color: AppColors.error, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ] else ...[
              _buildActionChip(
                label: student.isDroppedOff
                    ? 'Dropped Off (${student.dropoffTime ?? "Done"})'
                    : 'Drop Off at School',
                icon: Icons.school_rounded,
                isActive: student.isDroppedOff,
                activeColor: AppColors.primary,
                onTap: canOperate
                    ? () {
                        context.read<DispatchBloc>().add(
                              UpdateStudentAttendanceEvent(
                                dispatchId: dispatch.id,
                                stopId: stop.stopId,
                                studentId: student.studentId,
                                newPickupStatus: student.pickupStatus == 'pending' ? 'picked_up' : student.pickupStatus,
                                newDropoffStatus: 'dropped_off',
                              ),
                            );
                      }
                    : null,
              ),
            ],
          ] else if (stop.stopType == 'home_dropoff') ...[
            // Home Dropoff Stop in Afternoon Run:
            // Constraint: If student was absent at school pickup, no home dropoff needed!
            if (student.isAbsent || student.dropoffStatus == 'bypassed_absent') ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 14, color: Colors.grey),
                    const SizedBox(width: 6),
                    Text(
                      student.notes != null && student.notes!.isNotEmpty
                          ? 'Absent (${student.notes}) · Home Dropoff Bypassed'
                          : 'Absent at School · Home Dropoff Bypassed',
                      style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ] else ...[
              _buildActionChip(
                label: student.isDroppedOff
                    ? 'Dropped Off (${student.dropoffTime ?? "Done"})'
                    : 'Drop Off at Home',
                icon: Icons.home_rounded,
                isActive: student.isDroppedOff,
                activeColor: AppColors.primary,
                onTap: canOperate
                    ? () {
                        context.read<DispatchBloc>().add(
                              UpdateStudentAttendanceEvent(
                                dispatchId: dispatch.id,
                                stopId: stop.stopId,
                                studentId: student.studentId,
                                newPickupStatus: student.pickupStatus == 'pending' ? 'picked_up' : student.pickupStatus,
                                newDropoffStatus: 'dropped_off',
                              ),
                            );
                      }
                    : null,
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildActionChip({
    required String label,
    required IconData icon,
    required bool isActive,
    required Color activeColor,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isActive ? activeColor.withValues(alpha: 0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isActive ? activeColor : Colors.grey.withValues(alpha: 0.4),
            width: isActive ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: isActive ? activeColor : Colors.grey),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                color: isActive ? activeColor : Colors.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
