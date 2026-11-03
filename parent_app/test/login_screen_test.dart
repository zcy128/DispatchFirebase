import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/features/auth/bloc/auth_bloc.dart';
import 'package:parent_app/features/auth/presentation/login_screen.dart';
import 'auth_bloc_test.dart';

void main() {
  group('LoginScreen Widget Tests', () {
    late MockApiClient mockApiClient;
    late AuthBloc authBloc;

    setUp(() {
      mockApiClient = MockApiClient();
      authBloc = AuthBloc(mockApiClient);
    });

    tearDown(() {
      authBloc.close();
    });

    Widget createTestApp() {
      return MaterialApp(
        home: BlocProvider<AuthBloc>.value(
          value: authBloc,
          child: const LoginScreen(),
        ),
      );
    }

    testWidgets('renders login screen layout and zero-friction banner', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestApp());
      await tester.pump();

      expect(find.text('PCY Bus Tracker'), findsOneWidget);
      expect(find.text('Mobile Phone or Email'), findsOneWidget);
      expect(find.text('Send Verification Passcode'), findsOneWidget);
      expect(find.text('Demo Phone'), findsOneWidget);
      expect(find.text('Demo Email'), findsOneWidget);
    });

    testWidgets('shows validation error when submitting empty input', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestApp());
      await tester.pump();

      final submitBtn = find.widgetWithText(ElevatedButton, 'Send Verification Passcode');
      await tester.tap(submitBtn);
      await tester.pump();

      expect(find.text('Please enter your phone number or email'), findsOneWidget);
    });

    testWidgets('clicking Demo Phone fills 613-555-0100 and dispatches RequestOtpEvent', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestApp());
      await tester.pump();

      final demoPhoneBtn = find.widgetWithText(OutlinedButton, 'Demo Phone');
      await tester.tap(demoPhoneBtn);
      await tester.runAsync(() async {
        await Future.delayed(const Duration(milliseconds: 50));
      });
      await tester.pump();

      expect(find.text('613-555-0100'), findsOneWidget);
      expect(authBloc.state, isA<OtpSentState>());
    });

    testWidgets('clicking Demo Email fills parent@example.com and dispatches RequestOtpEvent', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(createTestApp());
      await tester.pump();

      final demoEmailBtn = find.widgetWithText(OutlinedButton, 'Demo Email');
      await tester.tap(demoEmailBtn);
      await tester.runAsync(() async {
        await Future.delayed(const Duration(milliseconds: 50));
      });
      await tester.pump();

      expect(find.text('parent@example.com'), findsOneWidget);
      expect(authBloc.state, isA<OtpSentState>());
    });
  });
}
