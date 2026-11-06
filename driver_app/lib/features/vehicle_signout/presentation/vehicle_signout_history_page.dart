import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/theme.dart';
import '../bloc/vehicle_signout_bloc.dart';
import '../bloc/vehicle_signout_event.dart';
import '../bloc/vehicle_signout_state.dart';
import '../models/vehicle_signout_model.dart';
import 'vehicle_signout_detail_page.dart';
import 'vehicle_signout_form_page.dart';
import 'widgets/vehicle_signout_empty_state.dart';
import 'widgets/vehicle_signout_filter_pills.dart';
import 'widgets/vehicle_signout_record_card.dart';

/// Handover history screen displaying all past vehicle sign-out / return records.
class VehicleSignoutHistoryPage extends StatefulWidget {
  final String driverId;
  final String driverName;
  final bool isReadOnly;

  const VehicleSignoutHistoryPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.isReadOnly = false,
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
      floatingActionButton: widget.isReadOnly
          ? null
          : FloatingActionButton.extended(
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
              crossAxisAlignment: CrossAxisAlignment.start,
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
                VehicleSignoutFilterPills(
                  selectedFilter: _selectedFilter,
                  onFilterSelected: (filter) => setState(() => _selectedFilter = filter),
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
                  final hasFilter = _selectedFilter != 'All' || _searchQuery.isNotEmpty;
                  return VehicleSignoutEmptyState(hasFilter: hasFilter);
                }

                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = filtered[index];
                    return VehicleSignoutRecordCard(
                      item: item,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => VehicleSignoutDetailPage(record: item),
                          ),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
