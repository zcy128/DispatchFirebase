import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme.dart';
import '../../../charter/presentation/available_charters_sheet.dart';
import '../../../charter/repository/charter_repository.dart';
import '../../../route/bloc/route_bloc.dart';
import '../../../route/bloc/route_state.dart';
import '../../../route_openings/route_openings_page.dart';
import 'assigned_charter_section.dart';
import 'assigned_run_card.dart';
import 'driver_profile_card.dart';
import 'pre_trip_reminder_banner.dart';
import 'shortcut_tile.dart';

class DashboardTab extends StatelessWidget {
  final String driverId;
  final String username;
  final String role;
  final ValueChanged<int> onTabSelected;
  final ValueChanged<int> onOpenFormsSection;
  final VoidCallback onOpenChat;
  final VoidCallback onOpenCompanyContacts;

  const DashboardTab({
    super.key,
    required this.driverId,
    required this.username,
    required this.role,
    required this.onTabSelected,
    required this.onOpenFormsSection,
    required this.onOpenChat,
    required this.onOpenCompanyContacts,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Driver Profile Card
          DriverProfileCard(
            username: username,
            role: role,
          ),
          const SizedBox(height: 24),

          // Assigned Charter Trips Section (Live Stream)
          AssignedCharterSection(
            driverId: driverId,
            username: username,
            role: role,
          ),

          // Active Shift / Route Card Header
          Row(
            children: [
              const Text(
                'TODAY\'S ASSIGNED RUN',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: AppColors.primary,
                ),
              ),
              const Spacer(),
              BlocBuilder<RouteBloc, RouteState>(
                builder: (context, state) {
                  if (state is RouteLoaded && state.isAssigned && state.route != null) {
                    return Container(
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
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Assigned Run Card
          AssignedRunCard(
            onOpenDispatch: () => onTabSelected(1),
            onOpenRoute: () => onTabSelected(2),
          ),
          const SizedBox(height: 12),

          // Pre-Trip Inspection Reminder Banner
          PreTripReminderBanner(
            onOpenPreTrip: () => onOpenFormsSection(0),
          ),
          const SizedBox(height: 24),

          // Quick Access Navigation Tiles
          const Text(
            'QUICK SHORTCUTS',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 10),

          ShortcutTile(
            icon: Icons.receipt_long_rounded,
            iconColor: AppColors.primary,
            title: 'Bi-Weekly Timesheet & Payroll',
            subtitle: 'View 2-week wages, EI hours & daily dispatch shift breakdown',
            onTap: () => onOpenFormsSection(1),
          ),
          const SizedBox(height: 12),

          ShortcutTile(
            icon: Icons.alt_route_rounded,
            iconColor: AppColors.primary,
            title: 'Assigned Route & Stops',
            subtitle: 'View turn-by-turn stop sequence, pullaway times & roster',
            onTap: () => onTabSelected(2),
          ),
          const SizedBox(height: 12),

          ShortcutTile(
            icon: Icons.event_available_rounded,
            iconColor: AppColors.success,
            title: 'Daily Attendance & Check-in',
            subtitle: 'Mark student pickups, drop-offs, absences & bulk arrival',
            onTap: () => onTabSelected(1),
          ),
          const SizedBox(height: 12),

          ShortcutTile(
            icon: Icons.chat_bubble_rounded,
            iconColor: Colors.amber,
            title: 'Fleet & Dispatch Chat',
            subtitle: 'Real-time communication with Dispatch, Payroll & Yard Crew',
            onTap: onOpenChat,
          ),
          const SizedBox(height: 12),

          ShortcutTile(
            icon: Icons.phone_in_talk_rounded,
            iconColor: const Color(0xFFF59E0B),
            title: 'Company Contacts',
            subtitle: 'Dispatch 24/7 desk, safety emergency hotline, fleet mechanic & HR',
            onTap: onOpenCompanyContacts,
          ),
          const SizedBox(height: 12),

          ShortcutTile(
            icon: Icons.campaign_rounded,
            iconColor: AppColors.info,
            title: 'Route Openings & Shift Bidding',
            subtitle: 'Preview sanitized route stops and apply for open runs',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => RouteOpeningsPage(
                    driverId: driverId,
                    driverName: username,
                    role: role,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),

          ShortcutTile(
            icon: Icons.airport_shuttle_rounded,
            iconColor: Colors.deepOrangeAccent,
            title: 'Charter & Field Trips',
            subtitle: 'Browse and self-assign available charter runs or view assignments',
            onTap: () {
              AvailableChartersSheet.show(
                context,
                driverId: driverId,
                username: username,
                role: role,
                repository: context.read<CharterRepository>(),
              );
            },
          ),
        ],
      ),
    );
  }
}
