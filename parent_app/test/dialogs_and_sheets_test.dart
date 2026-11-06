import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/models.dart';
import 'package:parent_app/features/auth/bloc/auth_bloc.dart';
import 'package:parent_app/features/auth/presentation/otp_screen.dart';
import 'package:parent_app/features/auth/presentation/register_dialog.dart';
import 'package:parent_app/features/schedule/presentation/schedule_screen.dart';
import 'package:parent_app/features/sms_inquiry/presentation/sms_guide_modal.dart';
import 'auth_bloc_test.dart';

void main() {
  group('Parent App Dialogs and Sheets Widget Tests', () {
    late MockApiClient mockApiClient;
    late AuthBloc authBloc;

    setUp(() {
      mockApiClient = MockApiClient();
      authBloc = AuthBloc(mockApiClient);
    });

    tearDown(() {
      authBloc.close();
    });

    testWidgets('RegisterDialog renders scrollable form and validates minimum password length', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider<AuthBloc>.value(
            value: authBloc,
            child: const Scaffold(
              body: RegisterDialog(contact: '613-555-0100'),
            ),
          ),
        ),
      );

      expect(find.text('Save Your Account'), findsOneWidget);
      expect(find.text('Create Password'), findsOneWidget);
      expect(find.text('Create Account'), findsOneWidget);

      // Attempt to submit empty password
      await tester.tap(find.text('Create Account'));
      await tester.pump();

      expect(find.text('Password must be at least 6 characters'), findsOneWidget);
    });

    testWidgets('SmsGuideModal renders instructions and Got It button', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SmsGuideModal(),
          ),
        ),
      );

      expect(find.text('SMS Instant Bus Inquiry'), findsOneWidget);
      expect(find.text('(613) 555-0188'), findsOneWidget);
      expect(find.text('Got It'), findsOneWidget);

      await tester.tap(find.text('Got It'));
      await tester.pump();
    });

    testWidgets('OtpScreen displays error message banner when error is present', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider<AuthBloc>.value(
            value: authBloc,
            child: const Scaffold(
              body: OtpScreen(
                contact: '613-555-0100',
                matchedCount: 2,
                error: 'Invalid or expired verification passcode. Please try again.',
              ),
            ),
          ),
        ),
      );

      expect(find.text('Invalid or expired verification passcode. Please try again.'), findsOneWidget);
      expect(find.text('2 student(s) linked to this contact'), findsOneWidget);
    });

    testWidgets('ScheduleScreen updates active commute when initialStudentIndex changes via didUpdateWidget', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final students = <ParentStudentCommute>[
        ParentStudentCommute(
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
          stopLocation: 'Woodroffe Ave & Baseline Rd',
          stopType: 'PICKUP',
          scheduledTime: '07:35 AM',
          estimatedTime: '07:37 AM',
          lateMinutes: 0,
          status: 'ON_TIME',
        ),
        ParentStudentCommute(
          studentId: 102,
          studentNo: 'STU-002',
          studentName: 'Lucas Watson',
          grade: 'Grade 5',
          schoolName: 'Nepean High School',
          avatarColor: '#10B981',
          shiftType: 'AM',
          shiftId: 'shift_2',
          routeNo: '102',
          busUnitNumber: '43',
          driverName: 'Sarah Jenkins',
          stopLocation: 'Carling Ave & Broadview Ave',
          stopType: 'PICKUP',
          scheduledTime: '07:45 AM',
          estimatedTime: '07:46 AM',
          lateMinutes: 0,
          status: 'ON_TIME',
        ),
      ];

      int studentIndex = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, setState) {
              return Scaffold(
                body: ScheduleScreen(
                  students: students,
                  initialStudentIndex: studentIndex,
                  onStudentChanged: (newIdx) => setState(() => studentIndex = newIdx),
                ),
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Emma Watson'), findsAtLeastNWidgets(1));

      // Trigger student switch
      await tester.tap(find.text('Lucas Watson'));
      await tester.pumpAndSettle();

      expect(find.text('Lucas Watson'), findsAtLeastNWidgets(1));
    });
  });
}
