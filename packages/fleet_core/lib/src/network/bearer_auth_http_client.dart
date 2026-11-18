import 'package:http/http.dart' as http;

typedef FleetTokenProvider = Future<String?> Function();

/// Reusable [http.BaseClient] that injects `Authorization: Bearer <token>`
/// when a valid non-mock token is available and not already set on the request.
class BearerAuthHttpClient extends http.BaseClient {
  final http.Client _inner;
  final FleetTokenProvider _tokenProvider;

  BearerAuthHttpClient({
    required FleetTokenProvider tokenProvider,
    http.Client? inner,
  })  : _tokenProvider = tokenProvider,
        _inner = inner ?? http.Client();

  /// Returns true when [token] is a non-empty real token (never a mock placeholder).
  static bool isValidToken(String? token) {
    if (token == null) return false;
    final trimmed = token.trim();
    return trimmed.isNotEmpty && !trimmed.startsWith('mock-token-');
  }

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (!request.headers.containsKey('Authorization')) {
      final token = await _tokenProvider();
      if (isValidToken(token)) {
        request.headers['Authorization'] = 'Bearer ${token!.trim()}';
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
