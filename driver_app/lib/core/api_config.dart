import 'package:flutter/foundation.dart';

class ApiConfig {
  static const String cloudRunBaseUrl =
      'https://dispatch-api-337919645491.northamerica-northeast1.run.app';

  static String get baseUrl {
    if (kIsWeb) {
      final host = Uri.base.host;
      if (host != 'localhost' && host != '127.0.0.1') {
        return Uri.base.origin;
      }
      return 'http://localhost:8080';
    }
    if (!kDebugMode) {
      return cloudRunBaseUrl;
    }
    return 'http://localhost:8080';
  }

  static String get dispatchApiUrl => '$baseUrl/api/public/dispatch';
  static String get uploadApiUrl => '$baseUrl/api/public/upload';
}
