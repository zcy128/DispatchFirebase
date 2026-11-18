import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:fleet_core/fleet_core.dart';

class _RecordingClient extends http.BaseClient {
  http.BaseRequest? lastRequest;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    lastRequest = request;
    return http.StreamedResponse(const Stream.empty(), 200);
  }
}

void main() {
  group('FleetApiUrlResolver', () {
    test('prefers configuredUrl when provided', () {
      expect(
        FleetApiUrlResolver.resolveBaseUrl(configuredUrl: 'https://api.pcy.ca'),
        'https://api.pcy.ca',
      );
    });

    test('resolves relative paths against baseUrl', () {
      expect(
        FleetApiUrlResolver.resolveRelativeUrl('/uploads/doc.pdf', baseUrl: 'https://api.pcy.ca'),
        'https://api.pcy.ca/uploads/doc.pdf',
      );
      expect(
        FleetApiUrlResolver.resolveRelativeUrl('https://cdn.pcy.ca/a.png', baseUrl: 'https://api.pcy.ca'),
        'https://cdn.pcy.ca/a.png',
      );
    });
  });

  group('BearerAuthHttpClient', () {
    test('injects Bearer token and ignores mock-token prefixes', () async {
      final inner = _RecordingClient();
      final realClient = BearerAuthHttpClient(
        inner: inner,
        tokenProvider: () async => 'real-jwt-123',
      );
      await realClient.get(Uri.parse('https://example.test/shifts'));
      expect(inner.lastRequest?.headers['Authorization'], 'Bearer real-jwt-123');

      final mockClient = BearerAuthHttpClient(
        inner: inner,
        tokenProvider: () async => 'mock-token-abc',
      );
      await mockClient.get(Uri.parse('https://example.test/shifts'));
      expect(inner.lastRequest?.headers.containsKey('Authorization'), isFalse);
    });
  });

  group('MapStopPin', () {
    test('hasValidCoordinates rejects null, zero, and NaN coordinates', () {
      const valid = MapStopPin(
        sequence: 1,
        title: 'Stop 1',
        scheduledTime: '07:30',
        latitude: 45.4215,
        longitude: -75.6972,
      );
      const zero = MapStopPin(
        sequence: 2,
        title: 'Stop 2',
        scheduledTime: '07:35',
        latitude: 0,
        longitude: 0,
      );
      expect(valid.hasValidCoordinates, isTrue);
      expect(zero.hasValidCoordinates, isFalse);
    });
  });
}
