import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Transparent Authenticated HTTP Client for Driver App.
/// Intercepts all outgoing HTTP requests and automatically injects
/// `Authorization: Bearer <driver_auth_token>` if a driver session is active.
class AuthenticatedHttpClient extends http.BaseClient {
  static final AuthenticatedHttpClient instance = AuthenticatedHttpClient._internal();

  final http.Client _inner;
  static String? _cachedToken;

  factory AuthenticatedHttpClient([http.Client? inner]) {
    if (inner != null) {
      return AuthenticatedHttpClient._internal(inner);
    }
    return instance;
  }

  AuthenticatedHttpClient._internal([http.Client? inner])
      : _inner = inner ?? http.Client();

  /// Updates the in-memory token cache (e.g. upon login or logout).
  static void setToken(String? token) {
    if (token != null && token.trim().isNotEmpty && !token.startsWith('mock-token-')) {
      _cachedToken = token.trim();
    } else {
      _cachedToken = null;
    }
  }

  /// Gets the current token (from memory or SharedPreferences).
  static Future<String?> getToken() async {
    if (_cachedToken != null && _cachedToken!.isNotEmpty && !_cachedToken!.startsWith('mock-token-')) {
      return _cachedToken;
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('driver_auth_token');
      if (token != null && token.trim().isNotEmpty && !token.startsWith('mock-token-')) {
        _cachedToken = token.trim();
        return _cachedToken;
      }
    } catch (e) {
      debugPrint('[AuthenticatedHttpClient] Failed to read auth token: $e');
    }
    return null;
  }

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    // Only inject Authorization header if not already explicitly provided
    if (!request.headers.containsKey('Authorization')) {
      final token = await getToken();
      if (token != null && token.isNotEmpty && !token.startsWith('mock-token-')) {
        request.headers['Authorization'] = 'Bearer $token';
      }
    }
    return _inner.send(request);
  }

  @override
  void close() {
    _inner.close();
    super.close();
  }
}

/// Static helper for quick top-level requests with automatic authentication.
class ApiClient {
  static http.Client get client => AuthenticatedHttpClient.instance;

  static Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
    return client.get(url, headers: headers);
  }

  static Future<http.Response> post(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    Encoding? encoding,
  }) async {
    return client.post(url, headers: headers, body: body, encoding: encoding);
  }

  static Future<http.Response> put(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    Encoding? encoding,
  }) async {
    return client.put(url, headers: headers, body: body, encoding: encoding);
  }

  static Future<http.Response> delete(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    Encoding? encoding,
  }) async {
    return client.delete(url, headers: headers, body: body, encoding: encoding);
  }
}
