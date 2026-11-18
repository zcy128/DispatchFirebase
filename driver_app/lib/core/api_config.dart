import 'package:fleet_core/fleet_core.dart';

class ApiConfig {
  static const String cloudRunBaseUrl = FleetApiUrlResolver.defaultCloudRunBaseUrl;

  static String get baseUrl => FleetApiUrlResolver.resolveBaseUrl(
        releaseBaseUrl: cloudRunBaseUrl,
      );

  static String get dispatchApiUrl => '$baseUrl/api/dispatch';
  static String get uploadApiUrl => '$baseUrl/api/upload';

  static String resolveUrl(String url) {
    return FleetApiUrlResolver.resolveRelativeUrl(url, baseUrl: baseUrl);
  }
}
