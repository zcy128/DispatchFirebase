import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/vehicle_signout_bloc.dart';
import '../bloc/vehicle_signout_event.dart';
import '../bloc/vehicle_signout_state.dart';
import '../models/vehicle_signout_model.dart';
import 'vehicle_signout_detail_page.dart';
import 'vehicle_signout_form_page.dart';

class VehicleSignoutHistoryPage extends StatefulWidget {
  final String driverId;
  final String driverName;

  const VehicleSignoutHistoryPage({
    super.key,
    required this.driverId,
    required this.driverName,
  });

  @override
  State<VehicleSignoutHistoryPage> createState() => _VehicleSignoutHistoryPageState();
}

class _VehicleSignoutHistoryPageState extends State<VehicleSignoutHistoryPage> {
  String _selectedFilter = 'All';
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    context.read<VehicleSignoutBloc>().add(const LoadVehicleSignouts());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Handover Records'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () {
              context.read<VehicleSignoutBloc>().add(const LoadVehicleSignouts());
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (ctx) => BlocProvider.value(
                value: context.read<VehicleSignoutBloc>(),
                child: VehicleSignoutFormPage(
                  driverId: widget.driverId,
                  driverName: widget.driverName,
                ),
              ),
            ),
          );
        },
        backgroundColor: AppColors.primary,
        foregroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Handover', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Search & Filter Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search by Unit #, Driver, or Route...',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              setState(() {
                                _searchController.clear();
                                _searchQuery = '';
                              });
                            },
                          )
                        : null,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onChanged: (val) => setState(() => _searchQuery = val.trim().toLowerCase()),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _buildFilterChip('All'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Signed Out'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Signed In'),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Record List
          Expanded(
            child: BlocBuilder<VehicleSignoutBloc, VehicleSignoutState>(
              builder: (context, state) {
                if (state is VehicleSignoutLoading) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }

                if (state is VehicleSignoutFailure) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, size: 40, color: Colors.red),
                        const SizedBox(height: 12),
                        Text(
                          'Failed to load handovers\n${state.error}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 13, color: Colors.grey),
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton(
                          onPressed: () {
                            context.read<VehicleSignoutBloc>().add(const LoadVehicleSignouts());
                          },
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  );
                }

                final allRecords = state is VehicleSignoutLoaded ? state.records : <VehicleSignoutModel>[];

                final filtered = allRecords.where((r) {
                  if (_selectedFilter == 'Signed Out' && r.isSignIn) return false;
                  if (_selectedFilter == 'Signed In' && !r.isSignIn) return false;
                  if (_searchQuery.isNotEmpty) {
                    final matchUnit = r.unitNumber.toLowerCase().contains(_searchQuery);
                    final matchDriver = r.employeeName.toLowerCase().contains(_searchQuery);
                    final matchRoute = (r.routeId ?? '').toLowerCase().contains(_searchQuery);
                    if (!matchUnit && !matchDriver && !matchRoute) return false;
                  }
                  return true;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.assignment_turned_in_outlined, size: 48, color: Colors.grey),
                        const SizedBox(height: 12),
                        const Text(
                          'No handover records found',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Completed vehicle handovers will appear here.',
                          style: TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = filtered[index];
                    return _buildRecordCard(context, item, isDark);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedFilter == label;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.grey[700]!,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: isSelected ? const Color(0xFF0F172A) : Colors.grey[400],
          ),
        ),
      ),
    );
  }

  Widget _buildRecordCard(BuildContext context, VehicleSignoutModel item, bool isDark) {
    return InkWell(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => VehicleSignoutDetailPage(record: item),
          ),
        );
      },
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[900] : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: item.isSignIn
                        ? Colors.green.withValues(alpha: 0.15)
                        : Colors.blue.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.isSignIn ? 'SIGN IN' : 'SIGN OUT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: item.isSignIn ? Colors.green : Colors.blue[400],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Unit #${item.unitNumber}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const Spacer(),
                Text(
                  item.signDate,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.person_outline_rounded, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  item.employeeName,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                ),
                if (item.routeId != null && item.routeId!.isNotEmpty) ...[
                  const SizedBox(width: 12),
                  const Icon(Icons.alt_route_rounded, size: 14, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    item.routeId!,
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${item.odometer.toStringAsFixed(1)} km · ${item.fuelLevelDescription ?? "Full"}',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
                if (item.attachments.isNotEmpty)
                  Row(
                    children: [
                      const Icon(Icons.photo_camera_outlined, size: 12, color: AppColors.primary),
                      const SizedBox(width: 3),
                      Text(
                        '${item.attachments.length}',
                        style: const TextStyle(fontSize: 11, color: AppColors.primary),
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
