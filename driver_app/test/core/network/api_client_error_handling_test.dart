import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:driver_app/core/network/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    AuthenticatedHttpClient.setToken(null);
  });

  group('AuthenticatedHttpClient Token Lifecycle Tests', () {
    test('setToken ignores mock-token- prefixes to prevent fake tokens being sent to server', () async {
      AuthenticatedHttpClient.setToken('mock-token-driver-999');
      final token = await AuthenticatedHttpClient.getToken();
      expect(token, isNull);
    });

    test('setToken sets real token and clearing with null works', () async {
      AuthenticatedHttpClient.setToken('real-jwt-token-xyz');
      expect(await AuthenticatedHttpClient.getToken(), equals('real-jwt-token-xyz'));

      AuthenticatedHttpClient.setToken(null);
      expect(await AuthenticatedHttpClient.getToken(), isNull);
    });

    test('injects Authorization header when valid token is cached', () async {
      AuthenticatedHttpClient.setToken('auth-bearer-token-123');

      final mockClient = MockClient((request) async {
        expect(request.headers['Authorization'], equals('Bearer auth-bearer-token-123'));
        return http.Response('{"success": true}', 200);
      });

      final client = AuthenticatedHttpClient(mockClient);
      final response = await client.get(Uri.parse('https://example.com/api/test'));
      expect(response.statusCode, equals(200));
    });

    test('preserves existing custom Authorization header', () async {
      AuthenticatedHttpClient.setToken('auth-bearer-token-123');

      final mockClient = MockClient((request) async {
        expect(request.headers['Authorization'], equals('CustomApiKey 99999'));
        return http.Response('{"ok": true}', 200);
      });

      final client = AuthenticatedHttpClient(mockClient);
      final response = await client.get(
        Uri.parse('https://example.com/api/test'),
        headers: {'Authorization': 'CustomApiKey 99999'},
      );
      expect(response.statusCode, equals(200));
    });
  });

  group('HTTP Status Code & Error Response Handling', () {
    test('handles 401 Unauthorized response status correctly', () async {
      final mockClient = MockClient((request) async {
        return http.Response('{"error": "Session expired", "code": 401}', 401);
      });

      final client = AuthenticatedHttpClient(mockClient);
      final response = await client.get(Uri.parse('https://example.com/api/protected'));

      expect(response.statusCode, equals(401));
      expect(response.body, contains('Session expired'));
    });

    test('handles 403 Forbidden response status for deactivated drivers', () async {
      final mockClient = MockClient((request) async {
        return http.Response('{"error": "Driver deactivated by dispatch", "code": 403}', 403);
      });

      final client = AuthenticatedHttpClient(mockClient);
      final response = await client.get(Uri.parse('https://example.com/api/shifts'));

      expect(response.statusCode, equals(403));
      expect(response.body, contains('Driver deactivated'));
    });

    test('handles 500 Internal Server Error without throwing uncaught exceptions', () async {
      final mockClient = MockClient((request) async {
        return http.Response('Internal Server Error', 500);
      });

      final client = AuthenticatedHttpClient(mockClient);
      final response = await client.post(
        Uri.parse('https://example.com/api/reports'),
        body: {'key': 'value'},
      );

      expect(response.statusCode, equals(500));
      expect(response.body, equals('Internal Server Error'));
    });
  });
}
