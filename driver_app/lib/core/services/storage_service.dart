import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../network/api_client.dart';
import 'package:image_picker/image_picker.dart';
import '../api_config.dart';

/// Service for picking images from camera or gallery and uploading to backend server or Firebase Storage.
class StorageService {
  static String get _defaultUploadUrl => ApiConfig.uploadApiUrl;

  final FirebaseStorage? _storageOverride;
  final ImagePicker _picker;
  final http.Client _httpClient;

  StorageService({
    FirebaseStorage? storage,
    ImagePicker? picker,
    http.Client? httpClient,
  })  : _storageOverride = storage,
        _picker = picker ?? ImagePicker(),
        _httpClient = httpClient ?? AuthenticatedHttpClient.instance;

  /// Singleton instance for convenience.
  static final StorageService instance = StorageService();

  /// Checks whether Firebase has been initialized in the current environment.
  bool get isStorageAvailable {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Lazily retrieves FirebaseStorage instance if Firebase app exists.
  FirebaseStorage? get _storage {
    if (_storageOverride != null) return _storageOverride;
    if (!isStorageAvailable) return null;
    try {
      return FirebaseStorage.instance;
    } catch (_) {
      return null;
    }
  }

  /// Picks a single image from either the device camera or local photo gallery.
  Future<XFile?> pickImage({
    required ImageSource source,
    double maxWidth = 1920,
    double maxHeight = 1920,
    int imageQuality = 80,
  }) async {
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageQuality: imageQuality,
      );
      return file;
    } catch (e) {
      debugPrint('Error picking image: $e');
      rethrow;
    }
  }

  /// Picks multiple images from the local photo gallery.
  Future<List<XFile>> pickMultiImage({
    double maxWidth = 1920,
    double maxHeight = 1920,
    int imageQuality = 80,
  }) async {
    try {
      final files = await _picker.pickMultiImage(
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageQuality: imageQuality,
      );
      return files;
    } catch (e) {
      debugPrint('Error picking multiple images: $e');
      rethrow;
    }
  }

  /// Uploads binary data and returns an accessible URL.
  /// 1. Primary: uploads to backend server (/api/public/upload) with zero CORS issues.
  /// 2. Secondary: attempts Firebase Storage with strict timeout.
  /// 3. Fallback: returns data URI for zero user blockage.
  Future<String> uploadBytes({
    required Uint8List bytes,
    required String fileName,
    String folder = 'attachments',
    String mimeType = 'image/jpeg',
  }) async {
    // 1. Primary: Direct backend server upload (Zero CORS/auth issues)
    try {
      final uri = Uri.parse(_defaultUploadUrl);
      final request = http.MultipartRequest('POST', uri);
      request.files.add(
        http.MultipartFile.fromBytes(
          'file',
          bytes,
          filename: fileName,
        ),
      );
      final streamedResponse = await _httpClient.send(request).timeout(const Duration(seconds: 5));
      final response = await http.Response.fromStream(streamedResponse);
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final url = data['url']?.toString();
        if (url != null && url.isNotEmpty) {
          return url;
        }
      }
    } catch (err) {
      debugPrint('[StorageService] Server upload skipped or failed: $err');
    }

    // 2. Secondary: Firebase Storage with timeout guard
    final storage = _storage;
    if (storage != null) {
      try {
        final cleanFolder = folder.replaceAll(RegExp(r'^/|/$'), '');
        final fullPath = '$cleanFolder/$fileName';
        final ref = storage.ref().child(fullPath);

        final metadata = SettableMetadata(
          contentType: mimeType,
          customMetadata: {
            'uploadedAt': DateTime.now().toIso8601String(),
          },
        );

        final uploadTask = ref.putData(bytes, metadata);
        final snapshot = await uploadTask.timeout(const Duration(seconds: 5));
        final downloadUrl = await snapshot.ref.getDownloadURL().timeout(const Duration(seconds: 4));
        return downloadUrl;
      } catch (e) {
        debugPrint('[StorageService] Firebase Storage upload skipped: $e');
      }
    }

    // 3. Resilient fallback: base64 data URI so user flow is never interrupted
    final b64 = base64Encode(bytes);
    return 'data:$mimeType;base64,$b64';
  }

  /// Uploads an [XFile] and returns the accessible URL.
  Future<String> uploadXFile({
    required XFile file,
    String folder = 'attachments',
    String? customFileName,
  }) async {
    final bytes = await file.readAsBytes();
    final ext = file.name.contains('.') ? file.name.split('.').last : 'jpg';
    final fileName = customFileName ??
        'att_${DateTime.now().millisecondsSinceEpoch}_${file.name.hashCode.abs()}.$ext';

    final mimeType = ext.toLowerCase() == 'png'
        ? 'image/png'
        : ext.toLowerCase() == 'webp'
            ? 'image/webp'
            : 'image/jpeg';

    return uploadBytes(
      bytes: bytes,
      fileName: fileName,
      folder: folder,
      mimeType: mimeType,
    );
  }
}
