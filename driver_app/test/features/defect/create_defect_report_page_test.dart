import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/defect/bloc/defect_bloc.dart';
import 'package:driver_app/features/defect/presentation/create_defect_report_page.dart';
import 'package:driver_app/features/defect/repository/defect_repository.dart';

void main() {
  testWidgets(
      'CreateDefectReportPage renders successfully when defaultVehicleUnit is not in fleetVehicles',
      (WidgetTester tester) async {
    final defectRepository = DefectRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider<DefectBloc>(
          create: (_) => DefectBloc(repository: defectRepository),
          child: const CreateDefectReportPage(
            defaultVehicleUnit: '1021',
            driverId: 'driver-1',
            driverName: 'John Doe',
            fleetVehicles: ['1001', '1002', '1003'],
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify page title and dropdown value
    expect(find.text('Report Vehicle Defect'), findsOneWidget);
    expect(find.text('Unit #1021'), findsOneWidget);
    expect(find.text('Daily Check (12)'), findsOneWidget);
    expect(find.text('Periodic Check (7)'), findsOneWidget);
  });

  testWidgets(
      'CreateDefectReportPage self-provides DefectBloc from RepositoryProvider when none in context',
      (WidgetTester tester) async {
    final defectRepository = DefectRepository();

    await tester.pumpWidget(
      RepositoryProvider<DefectRepository>.value(
        value: defectRepository,
        child: const MaterialApp(
          home: CreateDefectReportPage(
            defaultVehicleUnit: '1021',
            driverId: 'driver-1',
            driverName: 'John Doe',
            fleetVehicles: ['1001', '1002'],
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Report Vehicle Defect'), findsOneWidget);
    expect(find.text('Unit #1021'), findsOneWidget);
  });
}
