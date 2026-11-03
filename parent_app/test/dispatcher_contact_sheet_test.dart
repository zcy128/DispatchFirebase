import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/models.dart';
import 'package:parent_app/features/dispatcher/presentation/dispatcher_contact_sheet.dart';
import 'auth_bloc_test.dart';

void main() {
  group('DispatcherContactSheet Widget Tests', () {
    late MockApiClient mockApiClient;

    setUp(() {
      mockApiClient = MockApiClient();
    });

    final testCommute = ParentStudentCommute(
      studentId: 101,
      studentNo: 'STU-001',
      studentName: 'Emma Watson',
      grade: 'Grade 2',
      schoolName: 'Broadview Public School',
      avatarColor: '#2563EB',
      shiftType: 'AM',
      shiftId: 'shift_1',
      routeNo: '101',
      busUnitNumber: '42',
      driverName: 'Robert Smith',
      stopLocation: 'Woodroffe Ave',
      stopType: 'PICKUP',
      scheduledTime: '07:35 AM',
      estimatedTime: '07:38 AM',
      lateMinutes: 3,
      status: 'EN_ROUTE',
    );

    testWidgets('renders tabs for Live Chat and Call / SMS', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DispatcherContactSheet(
              commute: testCommute,
              parentContact: '613-555-0100',
              apiClient: mockApiClient,
              isTabMode: true,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Live Chat'), findsOneWidget);
      expect(find.text('Call / SMS'), findsOneWidget);
      expect(find.text('Dispatch Operations Desk'), findsOneWidget);
    });

    testWidgets('switching to Call / SMS tab displays dispatch phone and SMS numbers', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DispatcherContactSheet(
              commute: testCommute,
              parentContact: '613-555-0100',
              apiClient: mockApiClient,
              isTabMode: true,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      // Switch to Call / SMS tab
      await tester.tap(find.text('Call / SMS'));
      await tester.pumpAndSettle();

      expect(find.textContaining('(613) 555-0100'), findsWidgets);
      expect(find.textContaining('(613) 555-0188'), findsWidgets);
    });
  });
}
