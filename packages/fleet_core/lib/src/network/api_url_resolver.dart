import 'package:flutter/foundation.dart';

/// Resolves the backend API base URL and relative asset URLs across
/// Flutter Web, Android emulator, iOS/desktop debug, and production Cloud Run.
class FleetApiUrlResolver {
  const FleetApiUrlResolver._();

  static const String defaultCloudRunBaseUrl =
      'https://dispatch-api-337919645491.northamerica-northeast1.run.app';

  /// Resolves the base URL for API requests.
  static String resolveBaseUrl({
    String configuredUrl = '',
    String? releaseBaseUrl,
    bool useAndroidEmulatorLoopback = false,
  }) {
    final trimmed = configuredUrl.trim();
    if (trimmed.isNotEmpty) {
      return trimmed;
    }
    if (kIsWeb) {
      final host = Uri.base.host;
      if (host != 'localhost' && host != '127.0.0.1') {
        return Uri.base.origin;
      }
      return 'http://localhost:8080';
    }
    if (!kDebugMode && releaseBaseUrl != null && releaseBaseUrl.isNotEmpty) {
      return releaseBaseUrl;
    }
    if (useAndroidEmulatorLoopback && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8080';
    }
    return 'http://localhost:8080';
  }

  /// Resolves a potentially relative path (e.g. `/uploads/a.png`) against [baseUrl].
  static String resolveRelativeUrl(String url, {required String baseUrl}) {
    final trimmed = url.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return '$baseUrl$trimmed';
    }
    return trimmed;
  }
}
