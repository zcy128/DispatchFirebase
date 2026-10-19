import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/core/services/device_token_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('DeviceTokenService Tests', () {
    test('singleton returns same instance', () {
      final service1 = DeviceTokenService();
      final service2 = DeviceTokenService();
      expect(identical(service1, service2), isTrue);
    });

    test('defaultApiBase is defined', () {
      expect(DeviceTokenService.defaultApiBase, 'http://localhost:8080');
    });

    test('dispose completes without error', () {
      final service = DeviceTokenService();
      expect(() => service.dispose(), returnsNormally);
    });
  });
}
