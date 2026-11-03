import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/models.dart';
import 'package:parent_app/features/notifications/presentation/notification_settings_sheet.dart';
import 'auth_bloc_test.dart';

void main() {
  group('NotificationSettingsSheet Widget Tests', () {
    late MockApiClient mockApiClient;

    setUp(() {
      mockApiClient = MockApiClient();
      mockApiClient.mockPreferences = ParentNotificationConfig(
        notifyApproaching: true,
        approachingMinutes: 5,
        notifyDelay: true,
        notifyBoarding: true,
        channelPush: true,
        channelSms: true,
        channelEmail: false,
      );
    });

    testWidgets('loads and renders notification alert toggles and delivery channels', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationSettingsSheet(apiClient: mockApiClient),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Notification Alerts'), findsOneWidget);
      expect(find.text('Approaching Stop Alert'), findsOneWidget);
      expect(find.text('Delay & Traffic Alert'), findsOneWidget);
      expect(find.text('Boarding & Dropoff Scan'), findsOneWidget);
      expect(find.text('Push Notification (App)'), findsOneWidget);
      expect(find.text('SMS Text Message (Twilio)'), findsOneWidget);
      expect(find.text('Save Alert Settings'), findsOneWidget);
    });

    testWidgets('saving preferences calls savePreferences on ApiClient', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NotificationSettingsSheet(apiClient: mockApiClient),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final saveBtn = find.widgetWithText(ElevatedButton, 'Save Alert Settings');
      await tester.tap(saveBtn);
      await tester.runAsync(() async {
        await Future.delayed(const Duration(milliseconds: 50));
      });
      await tester.pumpAndSettle();

      expect(mockApiClient.savePreferencesCalled, isTrue);
    });
  });
}
