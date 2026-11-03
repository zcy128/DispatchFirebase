import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image_picker/image_picker.dart';
import 'package:driver_app/core/services/storage_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('StorageService Resilience & Fallback Tests', () {
    test('returns resolved remote URL when backend upload succeeds', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, contains('/upload'));
        final responsePayload = jsonEncode({
          'success': true,
          'url': 'https://storage.cdn.example.com/receipts/receipt-001.jpg',
        });
        return http.Response(responsePayload, 200);
      });

      final service = StorageService(httpClient: mockClient);
      final testBytes = Uint8List.fromList([1, 2, 3, 4, 5]);

      final resultUrl = await service.uploadBytes(
        bytes: testBytes,
        fileName: 'receipt-001.jpg',
      );

      expect(resultUrl, equals('https://storage.cdn.example.com/receipts/receipt-001.jpg'));
    });

    test('falls back to Base64 Data URI when backend fails, avoiding blocking user flow', () async {
      // Mock client that returns 503 Service Unavailable (or throws network exception)
      final failingClient = MockClient((request) async {
        return http.Response('Service Temporarily Unavailable', 503);
      });

      final service = StorageService(httpClient: failingClient);
      final rawString = 'Hello Driver App Offline Photo!';
      final testBytes = Uint8List.fromList(utf8.encode(rawString));

      final result = await service.uploadBytes(
        bytes: testBytes,
        fileName: 'offline_defect.jpg',
        mimeType: 'image/jpeg',
      );

      expect(result.startsWith('data:image/jpeg;base64,'), isTrue);

      // Verify that decoding the base64 yields the exact original payload
      final encodedPart = result.substring('data:image/jpeg;base64,'.length);
      final decodedBytes = base64Decode(encodedPart);
      expect(utf8.decode(decodedBytes), equals(rawString));
    });

    test('uploadXFile correctly infers MIME types from extensions', () async {
      final failingClient = MockClient((request) async {
        return http.Response('error', 500);
      });
      final service = StorageService(httpClient: failingClient);

      // PNG file with customFileName
      final pngBytes = Uint8List.fromList([0x89, 0x50, 0x4E, 0x47]);
      final pngFile = XFile.fromData(pngBytes);
      final pngResult = await service.uploadXFile(file: pngFile, customFileName: 'proof.png');
      expect(pngResult.startsWith('data:image/png;base64,'), isTrue);

      // WebP file with customFileName
      final webpBytes = Uint8List.fromList([0x52, 0x49, 0x46, 0x46]);
      final webpFile = XFile.fromData(webpBytes);
      final webpResult = await service.uploadXFile(file: webpFile, customFileName: 'photo.webp');
      expect(webpResult.startsWith('data:image/webp;base64,'), isTrue);

      // JPG file with customFileName
      final jpgBytes = Uint8List.fromList([0xFF, 0xD8, 0xFF]);
      final jpgFile = XFile.fromData(jpgBytes);
      final jpgResult = await service.uploadXFile(file: jpgFile, customFileName: 'inspection.jpg');
      expect(jpgResult.startsWith('data:image/jpeg;base64,'), isTrue);
    });
  });
}
