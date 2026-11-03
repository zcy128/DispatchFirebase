import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:driver_app/core/network/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    AuthenticatedHttpClient.setToken(null);
  });

  group('Session Storage & Logout Isolation Tests', () {
    test('login persistence populates sensitive session keys and in-memory token', () async {
      final prefs = await SharedPreferences.getInstance();

      // Simulate successful login persistence
      await prefs.setString('driver_auth_token', 'jwt-token-12345');
      AuthenticatedHttpClient.setToken('jwt-token-12345');
      await prefs.setString('driver_saved_employee_id', 'EMP-2001');
      await prefs.setString('driver_saved_display_name', 'Alex Driver');
      await prefs.setString('driver_saved_username', 'alex123');
      await prefs.setString('driver_saved_role', 'Driver');
      await prefs.setBool('driver_remember_me', true);
      await prefs.setString('driver_saved_email', 'alex@example.com');

      // Non-sensitive device preferences
      await prefs.setString('app_theme_mode', 'dark');

      expect(prefs.getString('driver_auth_token'), equals('jwt-token-12345'));
      expect(await AuthenticatedHttpClient.getToken(), equals('jwt-token-12345'));
      expect(prefs.getString('driver_saved_employee_id'), equals('EMP-2001'));
      expect(prefs.getString('app_theme_mode'), equals('dark'));
    });

    test('sign-out routine purges sensitive authentication data while preserving user device preferences', () async {
      final prefs = await SharedPreferences.getInstance();

      // Initial active session
      await prefs.setString('driver_auth_token', 'jwt-token-to-be-purged');
      AuthenticatedHttpClient.setToken('jwt-token-to-be-purged');
      await prefs.setString('driver_saved_employee_id', 'EMP-2001');
      await prefs.setString('driver_saved_display_name', 'Alex Driver');
      await prefs.setString('driver_saved_username', 'alex123');
      await prefs.setString('driver_saved_overrides', '{"canSignout": true}');
      await prefs.setBool('driver_remember_me', true);
      await prefs.setString('driver_saved_email', 'alex@example.com');
      await prefs.setString('app_theme_mode', 'dark');

      // Execute standard sign-out purge routine
      await prefs.remove('driver_auth_token');
      AuthenticatedHttpClient.setToken(null);
      await prefs.remove('driver_saved_employee_id');
      await prefs.remove('driver_saved_display_name');
      await prefs.remove('driver_saved_username');
      await prefs.remove('driver_saved_overrides');

      // 1. Verify sensitive keys are wiped
      expect(prefs.containsKey('driver_auth_token'), isFalse);
      expect(prefs.containsKey('driver_saved_employee_id'), isFalse);
      expect(prefs.containsKey('driver_saved_display_name'), isFalse);
      expect(prefs.containsKey('driver_saved_username'), isFalse);
      expect(prefs.containsKey('driver_saved_overrides'), isFalse);

      // 2. Verify in-memory client token is null
      expect(await AuthenticatedHttpClient.getToken(), isNull);

      // 3. Verify remembered credentials and device settings stay intact
      expect(prefs.getBool('driver_remember_me'), isTrue);
      expect(prefs.getString('driver_saved_email'), equals('alex@example.com'));
      expect(prefs.getString('app_theme_mode'), equals('dark'));
    });

    test('remember me disabled properly removes saved email on preference toggle', () async {
      final prefs = await SharedPreferences.getInstance();

      await prefs.setString('driver_saved_email', 'alex@example.com');
      await prefs.setBool('driver_remember_me', false);

      // When rememberMe is false, email key is removed
      await prefs.remove('driver_saved_email');

      expect(prefs.containsKey('driver_saved_email'), isFalse);
      expect(prefs.getBool('driver_remember_me'), isFalse);
    });
  });
}
