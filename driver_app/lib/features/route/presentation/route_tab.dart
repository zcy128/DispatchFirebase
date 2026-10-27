import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/google_route_map_card.dart';
import '../bloc/route_bloc.dart';
import '../bloc/route_event.dart';
import '../bloc/route_state.dart';
import '../models/route_model.dart';

class RouteTab extends StatefulWidget {
  final String driverId;

  const RouteTab({super.key, this.driverId = 'DRV-1021'});

  @override
  State<RouteTab> createState() => _RouteTabState();
}

class _RouteTabState extends State<RouteTab> {
  final TextEditingController _searchController = TextEditingController();
  int _viewMode = 0; // 0 = Stops Timeline, 1 = Student Directory
  int? _selectedMapStopIndex;

  @override
  void initState() {
    super.initState();
    context.read<RouteBloc>().add(LoadRouteEvent(widget.driverId));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocBuilder<RouteBloc, RouteState>(
      builder: (context, state) {
        if (state is RouteLoading || state is RouteInitial) {
          return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        }

        if (state is RouteError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline_rounded, size: 54, color: AppColors.error),
                  const SizedBox(height: 16),
                  Text(
                    state.message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      context.read<RouteBloc>().add(LoadRouteEvent(widget.driverId));
                    },
                    child: const Text('Retry Loading Route'),
                  ),
                ],
              ),
            ),
          );
        }

        if (state is RouteLoaded) {
          if (!state.isAssigned || state.route == null) {
            return _buildUnassignedView(context, isDark);
          }

          final route = state.route!;
          final mapStops = state.displayedStops
              .map(
                (stop) => MapStopPin(
                  sequence: stop.sequence,
                  title: stop.isSchoolStop &&
                          stop.schoolName != null &&
                          stop.schoolName!.isNotEmpty
                      ? stop.schoolName!
                      : stop.location,
                  subtitle: stop.isSchoolStop
                      ? stop.location
                      : (stop.instruction ?? 'Student Stop'),
                  scheduledTime: stop.pullawayTime,
                  isSchoolStop: stop.isSchoolStop,
                  schoolNameHint: stop.schoolName ?? route.routeName,
                  latitude: stop.latitude,
                  longitude: stop.longitude,
                ),
              )
              .toList();

          return RefreshIndicator(
            color: AppColors.primary,
            backgroundColor: isDark ? AppColors.darkCard : Colors.white,
            onRefresh: () async {
              context.read<RouteBloc>().add(LoadRouteEvent(widget.driverId));
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Route Master Header Card
                _buildRouteHeaderCard(context, route, isDark),
                const SizedBox(height: 16),

                // Shift Filter Selector (AM / PM / All)
                _buildShiftFilterSelector(context, state, isDark),
                const SizedBox(height: 16),

                // Google Maps Route & Stops Card
                GoogleRouteMapCard(
                  routeTitle: 'Route ${route.routeNo}',
                  shiftLabel: state.selectedShiftType == 'ALL'
                      ? 'FULL'
                      : state.selectedShiftType,
                  stops: mapStops,
                  focusedStopSequence: _selectedMapStopIndex != null &&
                          _selectedMapStopIndex! < mapStops.length
                      ? mapStops[_selectedMapStopIndex!].sequence
                      : null,
                  mapHeight: 260,
                  onStopSelected: (pin) {
                    final idx = mapStops.indexWhere(
                      (s) => s.sequence == pin.sequence,
                    );
                    setState(() => _selectedMapStopIndex = idx >= 0 ? idx : null);
                  },
                ),
                const SizedBox(height: 16),

                // Search Bar & View Mode Toggle (Stops vs Students)
                _buildSearchAndModeToggle(context, state, isDark),
                const SizedBox(height: 16),

                // Content based on View Mode
                if (_viewMode == 0) ...[
                  _buildStopsTimeline(context, state, isDark),
                ] else ...[
                  _buildStudentsDirectory(context, state, isDark),
                ],
                const SizedBox(height: 32),
              ],
            ),
          );
        }

        return const SizedBox.shrink();
      },
    );
  }

  Widget _buildUnassignedView(BuildContext context, bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
                border: Border.all(
                  color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                  width: 2,
                ),
              ),
              child: const Icon(
                Icons.alt_route_rounded,
                size: 46,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No Route Assigned',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : AppColors.textPrimaryLight,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'You are currently not assigned to an active route. When dispatch operations assigns a school line to your driver profile, its schedule, stops, and student manifests will automatically appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () {
                // Allows user to simulate/restore sample route assignment for testing
                context.read<RouteBloc>().add(ToggleRouteAssignmentEvent(
                      driverId: widget.driverId,
                      shouldAssign: true,
                    ));
              },
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Check For Route Assignments'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                minimumSize: const Size(220, 46),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRouteHeaderCard(BuildContext context, DriverRouteInfo route, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Route No & Status Pill
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  route.routeNo,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
                      'ACTIVE',
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
              const Spacer(),
              if (route.schoolBoard.isNotEmpty) ...[
                Flexible(
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 100),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      route.schoolBoard,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
              ],
              InkWell(
                onTap: () {
                  context.read<RouteBloc>().add(LoadRouteEvent(widget.driverId));
                },
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.sync_rounded, size: 14, color: AppColors.primary),
                      SizedBox(width: 3),
                      Text(
                        'SYNC',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Route Name
          Text(
            route.routeName,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            '${route.yardName}  ·  Bus ${route.vehicleUnit} (${route.plateNumber})',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
          ),
          const Divider(height: 24),

          // Attendant presence if assigned
          if (route.attendantName != null) ...[
            InkWell(
              onTap: () => _showAttendantDialog(context, route),
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isDark ? Colors.white12 : Colors.black12,
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shield_rounded, size: 18, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Attendant: ${route.attendantName}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const Icon(Icons.phone_rounded, size: 16, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text(
                      route.attendantPhone ?? '',
                      style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Operational Notes / Instructions
          if (route.instructions != null && route.instructions!.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline_rounded, size: 16, color: Colors.amber),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      route.instructions!,
                      style: const TextStyle(fontSize: 11, height: 1.4, color: Colors.amber),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // KPI Metric Stats
          Row(
            children: [
              Expanded(child: _buildStatPill('Shifts', '${route.shifts.length}', isDark)),
              Expanded(child: _buildStatPill('Total Stops', '${route.totalStops}', isDark)),
              Expanded(child: _buildStatPill('Students', '${route.totalUniqueStudents}', isDark)),
              Expanded(child: _buildStatPill('Op Days', 'MTWRF', isDark)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatPill(String title, String value, bool isDark) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
        ),
        const SizedBox(height: 2),
        Text(
          title,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          ),
        ),
      ],
    );
  }

  Widget _buildShiftFilterSelector(BuildContext context, RouteLoaded state, bool isDark) {
    return Row(
      children: [
        Expanded(
          child: _buildShiftButton(
            label: 'Morning (AM)',
            shiftType: 'AM',
            isSelected: state.selectedShiftType == 'AM',
            context: context,
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildShiftButton(
            label: 'Afternoon (PM)',
            shiftType: 'PM',
            isSelected: state.selectedShiftType == 'PM',
            context: context,
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildShiftButton(
            label: 'All Runs',
            shiftType: 'ALL',
            isSelected: state.selectedShiftType == 'ALL',
            context: context,
            isDark: isDark,
          ),
        ),
      ],
    );
  }

  Widget _buildShiftButton({
    required String label,
    required String shiftType,
    required bool isSelected,
    required BuildContext context,
    required bool isDark,
  }) {
    return ElevatedButton(
      onPressed: () {
        setState(() => _selectedMapStopIndex = null);
        context.read<RouteBloc>().add(FilterRouteShiftEvent(shiftType));
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: isSelected
            ? AppColors.primary
            : (isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9)),
        foregroundColor: isSelected ? const Color(0xFF0F172A) : (isDark ? Colors.white70 : Colors.black87),
        elevation: isSelected ? 2 : 0,
        minimumSize: const Size(0, 42),
        padding: const EdgeInsets.symmetric(horizontal: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildSearchAndModeToggle(BuildContext context, RouteLoaded state, bool isDark) {
    return Column(
      children: [
        // Mode Tabs (Stops Timeline vs Student Directory)
        Container(
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
                child: _buildModeTab(
                  index: 0,
                  icon: Icons.alt_route_rounded,
                  label: 'Stops Timeline (${state.displayedStops.length})',
                  isDark: isDark,
                ),
              ),
              Expanded(
                child: _buildModeTab(
                  index: 1,
                  icon: Icons.people_alt_rounded,
                  label: 'Students Roster (${state.allUniqueStudents.length})',
                  isDark: isDark,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Search Input
        TextField(
          controller: _searchController,
          onChanged: (val) {
            context.read<RouteBloc>().add(SearchRouteStudentsEvent(val));
          },
          decoration: InputDecoration(
            hintText: 'Search student by name, student no, or street...',
            prefixIcon: const Icon(Icons.search_rounded, size: 20),
            suffixIcon: _searchController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear_rounded, size: 18),
                    onPressed: () {
                      _searchController.clear();
                      context.read<RouteBloc>().add(const SearchRouteStudentsEvent(''));
                    },
                  )
                : null,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildModeTab({
    required int index,
    required IconData icon,
    required String label,
    required bool isDark,
  }) {
    final isSelected = _viewMode == index;
    return InkWell(
      onTap: () {
        setState(() {
          _viewMode = index;
        });
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected
                  ? const Color(0xFF0F172A)
                  : isDark
                      ? Colors.grey
                      : Colors.black54,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: isSelected
                      ? const Color(0xFF0F172A)
                      : isDark
                          ? Colors.white
                          : Colors.black87,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStopsTimeline(BuildContext context, RouteLoaded state, bool isDark) {
    final stops = state.displayedStops;
    if (stops.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No stops found for this selection.',
            style: TextStyle(color: isDark ? Colors.grey : Colors.black54),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Direction C: Micro-Stepper Progress Indicator
        Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF141926) : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(12),
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
                    'ROUTE STOPS PROGRESS: ${stops.length} STOPS',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                    ),
                  ),
                  Text(
                    '${state.selectedShiftType} RUN',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: List.generate(stops.length, (idx) {
                  final isFocused = _selectedMapStopIndex == idx;
                  return Expanded(
                    child: Container(
                      height: 4,
                      margin: EdgeInsets.only(right: idx == stops.length - 1 ? 0 : 2),
                      decoration: BoxDecoration(
                        color: isFocused
                            ? AppColors.primary
                            : (idx == 0
                                ? AppColors.success
                                : (isDark ? Colors.grey.shade800 : Colors.grey.shade300)),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  );
                }),
              ),
            ],
          ),
        ),
        ...List.generate(
          stops.length,
          (idx) => _buildStopItem(context, stops[idx], idx, isDark),
        ),
      ],
    );
  }

  Widget _buildStopItem(
    BuildContext context,
    DriverRouteStop stop,
    int stopIndex,
    bool isDark,
  ) {
    final isSelectedOnMap = _selectedMapStopIndex == stopIndex;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelectedOnMap
              ? AppColors.primary
              : stop.isSchoolStop
                  ? AppColors.primary.withValues(alpha: 0.5)
                  : (isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
          width: isSelectedOnMap ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stop Header (Tap to focus stop on Google Map)
          InkWell(
            onTap: () {
              setState(() => _selectedMapStopIndex = stopIndex);
            },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: stop.isSchoolStop
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : (isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC)),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: stop.isSchoolStop ? AppColors.primary : (isDark ? Colors.white24 : Colors.black12),
                    child: Text(
                      '${stop.sequence}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: stop.isSchoolStop ? const Color(0xFF0F172A) : (isDark ? Colors.white : Colors.black87),
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
                          Expanded(
                            child: Text(
                              stop.isSchoolStop && stop.schoolName != null
                                  ? stop.schoolName!
                                  : stop.location,
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
                              stop.stopType.toUpperCase(),
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: stop.isSchoolStop ? AppColors.primary : Colors.grey,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Scheduled Pullaway: ${stop.pullawayTime}',
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
        ),

          // Instructions note if present
          if (stop.instruction != null && stop.instruction!.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded, size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      stop.instruction!,
                      style: const TextStyle(fontSize: 11, color: AppColors.primary, fontStyle: FontStyle.italic),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Students Roster for this stop
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ASSIGNED STUDENTS (${stop.students.length})',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                ...stop.students.map((student) => _buildStudentCard(context, student, isDark)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentsDirectory(BuildContext context, RouteLoaded state, bool isDark) {
    final students = state.allUniqueStudents;
    if (students.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.search_off_rounded, size: 40, color: Colors.grey),
              const SizedBox(height: 10),
              Text(
                'No matching students found.',
                style: TextStyle(color: isDark ? Colors.grey : Colors.black54),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: students.map((s) => _buildStudentCard(context, s, isDark)).toList(),
    );
  }

  Widget _buildStudentCard(BuildContext context, DriverRouteStudent student, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
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
                radius: 16,
                backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                child: Text(
                  student.name.isNotEmpty ? student.name[0] : 'S',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student.name,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '${student.studentNo}  ·  ${student.grade}  ·  ${student.schoolName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Address
          Row(
            children: [
              const Icon(Icons.home_outlined, size: 14, color: Colors.grey),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  student.address,
                  style: TextStyle(fontSize: 11, color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569)),
                ),
              ),
            ],
          ),

          // Special Needs Tag
          if (student.specialNeeds != null && student.specialNeeds!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.medical_services_outlined, size: 12, color: Colors.amber),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      student.specialNeeds!,
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Guardian Contact Info
          if (student.guardianName != null && student.guardianPhone != null) ...[
            const SizedBox(height: 8),
            InkWell(
              onTap: () {
                _callNumber(context, student.guardianPhone!, student.guardianName!);
              },
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? Colors.white10 : Colors.black12,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.phone_rounded, size: 12, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        '${student.guardianName}: ${student.guardianPhone}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _callNumber(BuildContext context, String phone, String contactName) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Calling $contactName at $phone...'),
        backgroundColor: AppColors.primaryDark,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showAttendantDialog(BuildContext context, DriverRouteInfo route) {
    final phone = route.attendantPhone ?? '+1 (613) 555-0184';
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(route.attendantName ?? 'Attendant Details'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Assigned Route Attendant / Monitor:'),
            const SizedBox(height: 8),
            Text(
              phone,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: phone));
              Navigator.of(dialogCtx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Phone number copied to clipboard!')),
              );
            },
            child: const Text('Copy Number'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(dialogCtx).pop();
              _callNumber(context, phone, route.attendantName ?? 'Attendant');
            },
            child: const Text('Call'),
          ),
        ],
      ),
    );
  }
}
