import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/home/presentation/widgets/driver_profile_card.dart';
import 'package:driver_app/features/home/presentation/widgets/shortcut_tile.dart';
import 'package:driver_app/features/home/presentation/widgets/assigned_run_card.dart';
import 'package:driver_app/features/route/bloc/route_bloc.dart';
import 'package:driver_app/features/route/repository/route_repository.dart';

void main() {
  group('Dashboard Component Tests', () {
    testWidgets('DriverProfileCard renders username, role badge, and initial', (tester) async {
      final routeRepository = RouteRepository();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BlocProvider<RouteBloc>(
              create: (_) => RouteBloc(repository: routeRepository),
              child: const DriverProfileCard(
                username: 'Jane Doe',
                role: 'Driver',
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Jane Doe'), findsOneWidget);
      expect(find.text('DRIVER'), findsOneWidget);
      expect(find.text('J'), findsOneWidget);
    });

    testWidgets('ShortcutTile displays title, subtitle and responds to taps', (tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ShortcutTile(
              icon: Icons.receipt_long_rounded,
              iconColor: Colors.amber,
              title: 'Bi-Weekly Timesheet & Payroll',
              subtitle: 'View 2-week wages',
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Bi-Weekly Timesheet & Payroll'), findsOneWidget);
      expect(find.text('View 2-week wages'), findsOneWidget);

      await tester.tap(find.byType(ShortcutTile));
      await tester.pumpAndSettle();

      expect(tapped, isTrue);
    });

    testWidgets('AssignedRunCard shows unassigned state when no route assigned', (tester) async {
      final routeRepository = RouteRepository();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BlocProvider<RouteBloc>(
              create: (_) => RouteBloc(repository: routeRepository),
              child: AssignedRunCard(
                onOpenDispatch: () {},
                onOpenRoute: () {},
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No Route Assigned'), findsOneWidget);
      expect(find.text('Check Assignments'), findsOneWidget);
    });
  });
}
