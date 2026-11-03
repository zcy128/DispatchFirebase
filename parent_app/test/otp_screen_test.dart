import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/features/auth/bloc/auth_bloc.dart';
import 'package:parent_app/features/auth/presentation/otp_screen.dart';
import 'auth_bloc_test.dart';

void main() {
  group('OtpScreen Widget Tests', () {
    late MockApiClient mockApiClient;
    late AuthBloc authBloc;

    setUp(() {
      mockApiClient = MockApiClient();
      authBloc = AuthBloc(mockApiClient);
    });

    tearDown(() {
      authBloc.close();
    });

    Widget createTestApp({
      required String contact,
      String? devCode,
      int matchedCount = 2,
    }) {
      return MaterialApp(
        home: BlocProvider<AuthBloc>.value(
          value: authBloc,
          child: OtpScreen(
            contact: contact,
            devCode: devCode,
            matchedCount: matchedCount,
          ),
        ),
      );
    }

    testWidgets('renders contact information and matched student badge', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestApp(
        contact: '613-555-0100',
        matchedCount: 2,
      ));
      await tester.pump();

      expect(find.text('Enter Passcode'), findsOneWidget);
      expect(find.textContaining('613-555-0100'), findsOneWidget);
      expect(find.textContaining('2 student(s) linked to this contact'), findsOneWidget);
      expect(find.text('Verify & Open Bus Tracker'), findsOneWidget);
    });

    testWidgets('entering short code triggers warning SnackBar', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestApp(
        contact: '613-555-0100',
        devCode: null, // prevent autofill
      ));
      await tester.pump();

      // Clear any text if present and enter 2 digits
      final textField = find.byType(TextField);
      await tester.enterText(textField, '12');

      final verifyBtn = find.widgetWithText(ElevatedButton, 'Verify & Open Bus Tracker');
      await tester.tap(verifyBtn);
      await tester.pump();

      expect(find.text('Please enter the 6-digit verification passcode'), findsOneWidget);
    });

    testWidgets('entering valid 6-digit passcode dispatches VerifyOtpEvent', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestApp(
        contact: '613-555-0100',
        devCode: '654321',
      ));
      await tester.pump();

      final verifyBtn = find.widgetWithText(ElevatedButton, 'Verify & Open Bus Tracker');
      await tester.tap(verifyBtn);
      await tester.runAsync(() async {
        await Future.delayed(const Duration(milliseconds: 50));
      });
      await tester.pump();

      expect(authBloc.state, isA<AuthenticatedState>());
    });

    testWidgets('back button dispatches LogoutEvent', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestApp(
        contact: '613-555-0100',
      ));
      await tester.pump();

      final backBtn = find.byIcon(Icons.arrow_back_rounded);
      await tester.tap(backBtn);
      await tester.runAsync(() async {
        await Future.delayed(const Duration(milliseconds: 50));
      });
      await tester.pump();

      expect(authBloc.state, isA<AuthInitialState>());
    });
  });
}
