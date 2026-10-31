import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:driver_app/core/network/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AuthenticatedHttpClient Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      AuthenticatedHttpClient.setToken(null);
    });

    test('Injects Authorization header when token is set', () async {
      AuthenticatedHttpClient.setToken('dsp_mcp_real_token');

      String? capturedAuthHeader;
      final mockInner = MockClient((request) async {
        capturedAuthHeader = request.headers['Authorization'];
        return http.Response('{"ok":true}', 200);
      });

      final client = AuthenticatedHttpClient(mockInner);
      final response = await client.get(Uri.parse('https://example.com/api/shifts'));

      expect(response.statusCode, 200);
      expect(capturedAuthHeader, 'Bearer dsp_mcp_real_token');
    });

    test('Does not overwrite existing Authorization header', () async {
      AuthenticatedHttpClient.setToken('dsp_mcp_real_token');

      String? capturedAuthHeader;
      final mockInner = MockClient((request) async {
        capturedAuthHeader = request.headers['Authorization'];
        return http.Response('{"ok":true}', 200);
      });

      final client = AuthenticatedHttpClient(mockInner);
      final response = await client.get(
        Uri.parse('https://example.com/api/shifts'),
        headers: {'Authorization': 'Bearer custom-token'},
      );

      expect(response.statusCode, 200);
      expect(capturedAuthHeader, 'Bearer custom-token');
    });

    test('Reads token from SharedPreferences if in-memory cache is empty', () async {
      SharedPreferences.setMockInitialValues({'driver_auth_token': 'dsp_mcp_stored_token'});
      AuthenticatedHttpClient.setToken(null);

      String? capturedAuthHeader;
      final mockInner = MockClient((request) async {
        capturedAuthHeader = request.headers['Authorization'];
        return http.Response('{"ok":true}', 200);
      });

      final client = AuthenticatedHttpClient(mockInner);
      final response = await client.get(Uri.parse('https://example.com/api/shifts'));

      expect(response.statusCode, 200);
      expect(capturedAuthHeader, 'Bearer dsp_mcp_stored_token');
    });

    test('Never injects mock-token into Authorization headers', () async {
      AuthenticatedHttpClient.setToken('mock-token-driver1d');

      String? capturedAuthHeader;
      final mockInner = MockClient((request) async {
        capturedAuthHeader = request.headers['Authorization'];
        return http.Response('{"ok":true}', 200);
      });

      final client = AuthenticatedHttpClient(mockInner);
      final response = await client.get(Uri.parse('https://example.com/api/shifts'));

      expect(response.statusCode, 200);
      expect(capturedAuthHeader, isNull);
    });

    test('Sends request without Authorization when no token is present', () async {
      AuthenticatedHttpClient.setToken(null);

      String? capturedAuthHeader;
      final mockInner = MockClient((request) async {
        capturedAuthHeader = request.headers['Authorization'];
        return http.Response('{"ok":true}', 200);
      });

      final client = AuthenticatedHttpClient(mockInner);
      final response = await client.get(Uri.parse('https://example.com/api/shifts'));

      expect(response.statusCode, 200);
      expect(capturedAuthHeader, isNull);
    });
  });
}
