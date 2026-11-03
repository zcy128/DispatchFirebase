import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/models.dart';
import 'package:parent_app/features/profile/presentation/edit_profile_sheet.dart';
import 'auth_bloc_test.dart';

void main() {
  group('EditProfileSheet Widget Tests', () {
    late MockApiClient mockApiClient;

    setUp(() {
      mockApiClient = MockApiClient();
      mockApiClient.mockProfileUser = ParentUser(
        id: 'p_101',
        contactType: 'phone',
        contactValue: '613-555-0100',
        displayName: 'David Watson',
        phone: '613-555-0100',
        email: 'david@example.com',
        homeAddress: '123 Richmond Rd, Ottawa',
        isRegistered: true,
        linkedStudentIds: ['101'],
      );
    });

    testWidgets('renders profile fields pre-populated with user data', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EditProfileSheet(
              apiClient: mockApiClient,
              parentContact: '613-555-0100',
              initialUser: mockApiClient.mockProfileUser,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Personal Information'), findsOneWidget);
      expect(find.text('David Watson'), findsOneWidget);
      expect(find.text('613-555-0100'), findsOneWidget);
      expect(find.text('david@example.com'), findsOneWidget);
      expect(find.text('123 Richmond Rd, Ottawa'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
    });

    testWidgets('submitting profile update triggers apiClient.updateProfile', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      ParentUser? updatedResult;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EditProfileSheet(
              apiClient: mockApiClient,
              parentContact: '613-555-0100',
              initialUser: mockApiClient.mockProfileUser,
              onProfileUpdated: (user) => updatedResult = user,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final saveBtn = find.widgetWithText(ElevatedButton, 'Save Changes');
      await tester.tap(saveBtn);
      await tester.runAsync(() async {
        await Future.delayed(const Duration(milliseconds: 50));
      });
      await tester.pumpAndSettle();

      expect(mockApiClient.updateProfileCalled, isTrue);
      expect(updatedResult?.displayName, equals('David Watson'));
    });
  });
}
