import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/pretrip_bloc.dart';
import '../bloc/pretrip_event.dart';
import '../bloc/pretrip_state.dart';
import '../models/pretrip_model.dart';
import 'pretrip_checklist_page.dart';

/// A compact card displayed in the Forms tab (and optionally the Dashboard)
/// that shows today's pre-trip status for the selected vehicle.
/// Includes a dropdown to change the vehicle.
class PreTripStatusCard extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String? defaultVehicleUnit;
  final String currentDate; // YYYY-MM-DD

  const PreTripStatusCard({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultVehicleUnit,
    required this.currentDate,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocConsumer<PreTripBloc, PreTripState>(
      listener: (context, state) {
        if (state is PreTripSubmitSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Pre-trip inspection submitted successfully!'),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
          // Reload status after success
          context.read<PreTripBloc>().add(LoadPreTripStatusEvent(
                vehicleUnit: state.record.vehicleUnit,
                date: currentDate,
              ));
        }
        if (state is PreTripError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      builder: (context, state) {
        // Show checklist page as a full screen overlay when in-progress
        if (state is PreTripInProgress) {
          return const SizedBox.shrink(); // Handled via route push in _startInspection
        }

        // Auto-load status if state is initial and we have a vehicle unit
        if (state is PreTripInitial && defaultVehicleUnit != null &&
            defaultVehicleUnit!.isNotEmpty) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            context.read<PreTripBloc>().add(LoadPreTripStatusEvent(
                  vehicleUnit: defaultVehicleUnit!,
                  date: currentDate,
                ));
          });
        }

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: _borderColor(state, isDark),
              width: state is PreTripStatusLoaded && state.isInspectedToday
                  ? 1.5
                  : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _iconBgColor(state).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.checklist_rounded,
                      color: _iconBgColor(state),
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Daily Pre-Trip Inspection',
                          style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Ontario Reg. 199/07 — Schedule 5',
                          style: const TextStyle(
                              fontSize: 11, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                  _buildStatusBadge(state, isDark),
                ],
              ),

              const SizedBox(height: 14),

              // Vehicle Picker
              if (state is PreTripStatusLoaded) ...[
                _buildVehiclePicker(context, state, isDark),
                const SizedBox(height: 12),
                _buildStatusRow(state, isDark),
                const SizedBox(height: 14),
                _buildActionButton(context, state, isDark),
              ] else if (state is PreTripLoading) ...[
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                ),
              ] else ...[
                _buildInitButton(context, isDark),
              ],
            ],
          ),
        );
      },
    );
  }

  Color _iconBgColor(PreTripState state) {
    if (state is PreTripStatusLoaded) {
      if (state.isInspectedToday) {
        final s = state.completedInspection?.overallStatus;
        if (s == OverallInspectionStatus.failedMajorDefects) {
          return AppColors.error;
        }
        if (s == OverallInspectionStatus.passedWithMinorDefects) {
          return AppColors.warning;
        }
        return AppColors.success;
      }
      return AppColors.warning;
    }
    return AppColors.primary;
  }

  Color _borderColor(PreTripState state, bool isDark) {
    if (state is PreTripStatusLoaded && state.isInspectedToday) {
      final s = state.completedInspection?.overallStatus;
      if (s == OverallInspectionStatus.failedMajorDefects) {
        return AppColors.error.withValues(alpha: 0.4);
      }
      if (s == OverallInspectionStatus.passedWithMinorDefects) {
        return AppColors.warning.withValues(alpha: 0.5);
      }
      return AppColors.success.withValues(alpha: 0.4);
    }
    return isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder;
  }

  Widget _buildStatusBadge(PreTripState state, bool isDark) {
    if (state is PreTripStatusLoaded && state.isInspectedToday) {
      final s = state.completedInspection?.overallStatus;
      Color color;
      String label;
      if (s == OverallInspectionStatus.failedMajorDefects) {
        color = AppColors.error;
        label = 'FAILED';
      } else if (s == OverallInspectionStatus.passedWithMinorDefects) {
        color = AppColors.warning;
        label = 'MINOR';
      } else {
        color = AppColors.success;
        label = 'PASSED';
      }
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.bold, color: color),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildVehiclePicker(BuildContext context, PreTripStatusLoaded state,
      bool isDark) {
    final vehicles = state.fleetVehicles.isEmpty
        ? [state.selectedVehicleUnit]
        : state.fleetVehicles;
    final currentValue = vehicles.contains(state.selectedVehicleUnit)
        ? state.selectedVehicleUnit
        : vehicles.first;

    return Row(
      children: [
        Icon(Icons.directions_bus_rounded,
            size: 16,
            color: isDark ? AppColors.textSecondaryDark : Colors.grey),
        const SizedBox(width: 6),
        const Text('Vehicle:', style: TextStyle(fontSize: 13)),
        const SizedBox(width: 8),
        Expanded(
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: currentValue,
              isDense: true,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
              dropdownColor: isDark ? AppColors.darkCard : Colors.white,
              items: vehicles
                  .map((u) => DropdownMenuItem(
                        value: u,
                        child: Text('Bus #$u'),
                      ))
                  .toList(),
              onChanged: (v) {
                if (v != null && v != state.selectedVehicleUnit) {
                  context
                      .read<PreTripBloc>()
                      .add(ChangePreTripVehicleEvent(v));
                }
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusRow(PreTripStatusLoaded state, bool isDark) {
    if (state.isInspectedToday && state.completedInspection != null) {
      final rec = state.completedInspection!;
      return Row(
        children: [
          Icon(Icons.check_circle_rounded, color: AppColors.success, size: 16),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              'Inspected at ${rec.inspectionTime} by ${rec.inspectorName}${rec.odometer > 0 ? " · ${rec.odometer} km" : ""}',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ),
        ],
      );
    }
    return Row(
      children: [
        Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 16),
        const SizedBox(width: 6),
        const Expanded(
          child: Text(
            'No inspection recorded for today.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton(
      BuildContext context, PreTripStatusLoaded state, bool isDark) {
    if (state.isInspectedToday) {
      return OutlinedButton.icon(
        onPressed: () => _startInspection(context, state),
        icon: const Icon(Icons.edit_note_rounded, size: 16),
        label: const Text('Inspect Another Vehicle'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: const BorderSide(color: AppColors.primary),
          padding: const EdgeInsets.symmetric(vertical: 10),
          minimumSize: const Size(double.infinity, 0),
        ),
      );
    }
    return ElevatedButton.icon(
      onPressed: () => _startInspection(context, state),
      icon: const Icon(Icons.checklist_rounded, size: 16),
      label: const Text('Start Pre-Trip Inspection'),
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.warning,
        foregroundColor: Colors.black87,
        padding: const EdgeInsets.symmetric(vertical: 12),
        minimumSize: const Size(double.infinity, 0),
      ),
    );
  }

  Widget _buildInitButton(BuildContext context, bool isDark) {
    return OutlinedButton.icon(
      onPressed: () {
        final vehicleUnit = defaultVehicleUnit ?? '';
        if (vehicleUnit.isEmpty) return;
        context.read<PreTripBloc>().add(LoadPreTripStatusEvent(
              vehicleUnit: vehicleUnit,
              date: currentDate,
            ));
      },
      icon: const Icon(Icons.refresh_rounded, size: 16),
      label: const Text('Load Inspection Status'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: const BorderSide(color: AppColors.primary),
        minimumSize: const Size(double.infinity, 0),
      ),
    );
  }

  void _startInspection(BuildContext context, PreTripStatusLoaded state) {
    context.read<PreTripBloc>().add(StartPreTripInspectionEvent(
          vehicleUnit: state.selectedVehicleUnit,
          inspectorId: driverId,
          inspectorName: driverName,
          date: currentDate,
        ));
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => BlocProvider.value(
        value: context.read<PreTripBloc>(),
        child: PreTripChecklistPage(
          vehicleUnit: state.selectedVehicleUnit,
          driverId: driverId,
          driverName: driverName,
          currentDate: currentDate,
        ),
      ),
    ));
  }
}
