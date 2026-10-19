import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/vehicle_signout_bloc.dart';
import '../bloc/vehicle_signout_state.dart';
import 'vehicle_signout_form_page.dart';
import 'vehicle_signout_history_page.dart';

class VehicleSignoutSummaryCard extends StatelessWidget {
  final String driverId;
  final String driverName;
  final String? defaultVehicleUnit;
  final bool isReadOnly;

  const VehicleSignoutSummaryCard({
    super.key,
    required this.driverId,
    required this.driverName,
    this.defaultVehicleUnit,
    this.isReadOnly = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Card(
      elevation: 0,
      color: isDark ? Colors.grey[900] : Colors.grey[50],
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.assignment_turned_in_rounded,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text(
                            'Vehicle Sign-Out & Handover',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isReadOnly ? 'READ-ONLY' : 'FLEET',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: isReadOnly ? Colors.amber[300] : AppColors.primary,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        'Custody transfer, safety gear & condition logs',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            BlocBuilder<VehicleSignoutBloc, VehicleSignoutState>(
              builder: (context, state) {
                final total = state is VehicleSignoutLoaded ? state.records.length : 0;
                final signedOut = state is VehicleSignoutLoaded
                    ? state.records.where((r) => !r.isSignIn).length
                    : 0;
                final signedIn = state is VehicleSignoutLoaded
                    ? state.records.where((r) => r.isSignIn).length
                    : 0;

                return Row(
                  children: [
                    _buildStatCol('Total', '$total', isDark),
                    _buildStatCol('Signed Out', '$signedOut', isDark, color: Colors.blue[400]),
                    _buildStatCol('Signed In', '$signedIn', isDark, color: Colors.green),
                  ],
                );
              },
            ),
            const SizedBox(height: 14),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (ctx) => BlocProvider.value(
                            value: context.read<VehicleSignoutBloc>(),
                            child: VehicleSignoutHistoryPage(
                              driverId: driverId,
                              driverName: driverName,
                            ),
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.history_rounded, size: 16),
                    label: Text(isReadOnly ? 'View Handover Records' : 'History'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: isDark ? Colors.white70 : Colors.black87,
                      side: BorderSide(
                        color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
                if (!isReadOnly) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (ctx) => BlocProvider.value(
                              value: context.read<VehicleSignoutBloc>(),
                              child: VehicleSignoutFormPage(
                                driverId: driverId,
                                driverName: driverName,
                                initialUnitNumber: defaultVehicleUnit,
                              ),
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.add_rounded, size: 16),
                      label: const Text('New Handover'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: const Color(0xFF0F172A),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCol(String label, String value, bool isDark, {Color? color}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[850] : Colors.white,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: color ?? (isDark ? Colors.white : Colors.black87),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
