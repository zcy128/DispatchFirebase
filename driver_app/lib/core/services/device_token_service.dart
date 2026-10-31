import 'dart:async';
import 'dart:convert';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../network/api_client.dart';
import '../../main.dart';
import '../api_config.dart';

class DeviceTokenService {
  static final DeviceTokenService _instance = DeviceTokenService._internal();
  factory DeviceTokenService() => _instance;
  DeviceTokenService._internal();

  FirebaseMessaging? _customMessaging;
  FirebaseMessaging? get _messaging {
    if (_customMessaging != null) return _customMessaging;
    try {
      return FirebaseMessaging.instance;
    } catch (_) {
      return null;
    }
  }

  final http.Client _httpClient = AuthenticatedHttpClient.instance;
  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _messageSub;
  String? _currentEmployeeId;
  String? _registeredToken;

  static String get defaultApiBase => ApiConfig.baseUrl;
  static String webVapidKey = '';

  Future<NotificationSettings?> requestPermission() async {
    final msg = _messaging;
    if (msg == null) return null;
    try {
      final settings = await msg.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      return settings;
    } catch (e) {
      debugPrint('DeviceTokenService requestPermission notice: $e');
      return null;
    }
  }

  Future<AuthorizationStatus> getPermissionStatus() async {
    final msg = _messaging;
    if (msg == null) return AuthorizationStatus.notDetermined;
    try {
      final settings = await msg.getNotificationSettings();
      return settings.authorizationStatus;
    } catch (_) {
      return AuthorizationStatus.notDetermined;
    }
  }

  Future<void> initializeForEmployee({
    required String employeeId,
    String? apiBaseUrl,
  }) async {
    _currentEmployeeId = employeeId;
    final resolvedBaseUrl = apiBaseUrl ?? defaultApiBase;

    try {
      final msg = _messaging;
      if (msg == null) {
        debugPrint('DeviceTokenService notice: FirebaseMessaging not initialized');
        return;
      }

      final settings = await msg.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        String? token;
        try {
          token = await msg.getToken(
            vapidKey: kIsWeb && webVapidKey.isNotEmpty ? webVapidKey : null,
          );
        } catch (tokenErr) {
          debugPrint('DeviceTokenService getToken notice: $tokenErr');
        }

        if (token != null && token.isNotEmpty) {
          await _registerTokenWithBackend(
            employeeId: employeeId,
            token: token,
            apiBaseUrl: resolvedBaseUrl,
          );
        }
      }

      _tokenRefreshSub?.cancel();
      _tokenRefreshSub = msg.onTokenRefresh.listen((newToken) {
        if (_currentEmployeeId != null && newToken.isNotEmpty) {
          _registerTokenWithBackend(
            employeeId: _currentEmployeeId!,
            token: newToken,
            apiBaseUrl: resolvedBaseUrl,
          );
        }
      });

      _messageSub?.cancel();
      _messageSub = FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('FCM foreground notification: ${message.notification?.title} - ${message.notification?.body}');
        final title = message.notification?.title ?? 'Dispatch Notice';
        final body = message.notification?.body ?? '';
        if (title.isNotEmpty || body.isNotEmpty) {
          final messenger = rootScaffoldMessengerKey.currentState;
          if (messenger != null) {
            messenger.showSnackBar(
              SnackBar(
                behavior: SnackBarBehavior.floating,
                backgroundColor: const Color(0xFF0F172A),
                elevation: 8,
                margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                duration: const Duration(seconds: 5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: const BorderSide(color: Color(0xFFF59E0B), width: 1.2),
                ),
                content: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.notifications_active_rounded,
                        color: Color(0xFFF59E0B),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            body,
                            style: const TextStyle(
                              color: Color(0xFFCBD5E1),
                              fontSize: 12,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }
        }
      });
    } catch (e) {
      debugPrint('DeviceTokenService initialization notice: $e');
    }
  }

  Future<void> _registerTokenWithBackend({
    required String employeeId,
    required String token,
    required String apiBaseUrl,
  }) async {
    if (_registeredToken == token) {
      return;
    }

    try {
      final platform = kIsWeb
          ? 'web'
          : defaultTargetPlatform == TargetPlatform.android
              ? 'android'
              : 'ios';

      final deviceName = kIsWeb
          ? 'Web Browser'
          : defaultTargetPlatform == TargetPlatform.android
              ? 'Android Device'
              : 'iOS Device';

      final uri = Uri.parse('$apiBaseUrl/api/public/devices/register');
      final response = await _httpClient.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'employeeId': employeeId,
          'token': token,
          'platform': platform,
          'deviceName': deviceName,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _registeredToken = token;
        debugPrint('FCM device token registered successfully for $employeeId');
      } else {
        debugPrint('FCM device token registration failed with status ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('FCM device registration request failed: $e');
    }
  }

  void dispose() {
    _tokenRefreshSub?.cancel();
    _messageSub?.cancel();
  }
}
