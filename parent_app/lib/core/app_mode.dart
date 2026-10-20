class AppMode {
  static const String mode = String.fromEnvironment('APP_MODE', defaultValue: 'demo');
  static const bool isProduction = mode == 'production';
  static const bool isDemo = !isProduction;
}
