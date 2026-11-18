import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../api_config.dart';
import '../network/api_client.dart';
import 'offline_outbox.dart';

/// Executes queued [OutboxMutation] entries against the Dispatch REST API.
class HttpOutboxSyncService {
  final OfflineOutbox _outbox;
  final http.Client _httpClient;
  final String _apiBaseUrl;

  HttpOutboxSyncService({
    OfflineOutbox? outbox,
    http.Client? httpClient,
    String? apiBaseUrl,
  })  : _outbox = outbox ?? OfflineOutbox(),
        _httpClient = httpClient ?? AuthenticatedHttpClient.instance,
        _apiBaseUrl = apiBaseUrl ?? ApiConfig.baseUrl;

  /// Enqueues an offline mutation into the persistent outbox.
  Future<void> enqueueMutation(OutboxMutation mutation) {
    return _outbox.enqueue(mutation);
  }

  /// Lists all pending offline mutations ordered oldest-first.
  Future<List<OutboxMutation>> listPending() {
    return _outbox.listPending();
  }

  /// Flushes all pending mutations over HTTP until empty or a transient failure occurs.
  Future<OutboxFlushResult> flushPending() {
    return _outbox.flush(_deliver);
  }

  Future<OutboxDeliveryOutcome> _deliver(OutboxMutation mutation) async {
    final uri = Uri.parse('$_apiBaseUrl${mutation.endpoint}');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'X-Idempotency-Key': mutation.id,
    };
    final body = jsonEncode(mutation.payload);

    final http.Response res;
    try {
      switch (mutation.method.toUpperCase()) {
        case 'PUT':
          res = await _httpClient
              .put(uri, headers: headers, body: body)
              .timeout(const Duration(seconds: 10));
          break;
        case 'PATCH':
          res = await _httpClient
              .patch(uri, headers: headers, body: body)
              .timeout(const Duration(seconds: 10));
          break;
        case 'DELETE':
          res = await _httpClient
              .delete(uri, headers: headers, body: body)
              .timeout(const Duration(seconds: 10));
          break;
        case 'POST':
        default:
          res = await _httpClient
              .post(uri, headers: headers, body: body)
              .timeout(const Duration(seconds: 10));
          break;
      }
    } on TimeoutException {
      return OutboxDeliveryOutcome.transientFailure;
    } on http.ClientException {
      return OutboxDeliveryOutcome.transientFailure;
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return OutboxDeliveryOutcome.succeeded;
    }
    if (res.statusCode == 408 || res.statusCode == 429 || res.statusCode >= 500) {
      return OutboxDeliveryOutcome.transientFailure;
    }
    return OutboxDeliveryOutcome.permanentFailure;
  }
}
