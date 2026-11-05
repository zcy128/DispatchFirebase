import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme.dart';
import '../../../pretrip/bloc/pretrip_bloc.dart';
import '../../../pretrip/bloc/pretrip_event.dart';
import '../../../pretrip/bloc/pretrip_state.dart';
import '../../../route/bloc/route_bloc.dart';
import '../../../route/bloc/route_state.dart';

class PreTripReminderBanner extends StatefulWidget {
  final VoidCallback onOpenPreTrip;

  const PreTripReminderBanner({
    super.key,
    required this.onOpenPreTrip,
  });

  @override
  State<PreTripReminderBanner> createState() => _PreTripReminderBannerState();
}

class _PreTripReminderBannerState extends State<PreTripReminderBanner> {
  String _lastCheckedUnit = '';

  @override
  void initState() {
    super.initState();
    _checkAndLoadPreTrip(context.read<RouteBloc>().state);
  }

  void _checkAndLoadPreTrip(RouteState routeState) {
    if (routeState is RouteLoaded &&
        routeState.isAssigned &&
        routeState.route != null) {
      final unit = routeState.route!.vehicleUnit.trim();
      if (unit.isNotEmpty && unit != _lastCheckedUnit) {
        _lastCheckedUnit = unit;
        final preTripBloc = context.read<PreTripBloc>();
        if (preTripBloc.state is PreTripInitial) {
          final today = DateTime.now();
          final dateStr =
              '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
          preTripBloc.add(LoadPreTripStatusEvent(
            vehicleUnit: unit,
            date: dateStr,
          ));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocListener<RouteBloc, RouteState>(
      listener: (context, routeState) {
        _checkAndLoadPreTrip(routeState);
      },
      child: BlocBuilder<RouteBloc, RouteState>(
        builder: (context, routeState) {
          if (routeState is! RouteLoaded ||
              !routeState.isAssigned ||
              routeState.route == null) {
            return const SizedBox.shrink();
          }

          final vehicleUnit = routeState.route!.vehicleUnit.trim();
          if (vehicleUnit.isEmpty) return const SizedBox.shrink();

          return BlocBuilder<PreTripBloc, PreTripState>(
            builder: (context, preTripState) {
              if (preTripState is PreTripLoading) {
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkCard : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark
                          ? AppColors.darkCardBorder
                          : AppColors.lightCardBorder,
                    ),
                  ),
                  child: const Row(
                    children: [
                      SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        ),
                      ),
                      SizedBox(width: 10),
                      Text(
                        'Checking pre-trip inspection status...',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                );
              }

              if (preTripState is PreTripStatusLoaded) {
                if (preTripState.isInspectedToday) {
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.success.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          color: AppColors.success,
                          size: 18,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Pre-trip inspection complete for Bus #$vehicleUnit',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: AppColors.success,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                } else {
                  return InkWell(
                    onTap: widget.onOpenPreTrip,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.warning.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.warning.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.warning_amber_rounded,
                            color: AppColors.warning,
                            size: 18,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Pre-trip inspection required for Bus #$vehicleUnit',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.warning,
                                  ),
                                ),
                                const Text(
                                  'Tap to complete inspection in Forms tab',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: Colors.grey,
                            size: 18,
                          ),
                        ],
                      ),
                    ),
                  );
                }
              }

              return const SizedBox.shrink();
            },
          );
        },
      ),
    );
  }
}
