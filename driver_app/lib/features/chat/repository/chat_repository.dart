import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../../core/network/api_client.dart';
import '../models/chat_model.dart';

class ChatRepository {
  static const String _defaultCloudRunUrl =
      'https://dispatch-api-337919645491.northamerica-northeast1.run.app';
  static const String _localDevUrl = 'http://localhost:8080';

  final String apiBaseUrl;
  final http.Client _httpClient;
  final FirebaseFirestore? _firestoreOverride;

  ChatRepository({
    String? apiBaseUrl,
    http.Client? httpClient,
    FirebaseFirestore? firestore,
  })  : apiBaseUrl = apiBaseUrl ?? (kDebugMode ? _localDevUrl : _defaultCloudRunUrl),
        _httpClient = httpClient ?? AuthenticatedHttpClient.instance,
        _firestoreOverride = firestore;

  bool get isFirestoreAvailable {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  FirebaseFirestore? get _firestore {
    if (_firestoreOverride != null) return _firestoreOverride;
    if (!isFirestoreAvailable) return null;
    try {
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  List<String> get _endpointsToTry {
    if (apiBaseUrl == _defaultCloudRunUrl) {
      return [_defaultCloudRunUrl];
    }
    return [apiBaseUrl, _defaultCloudRunUrl];
  }

  // ---------------------------------------------------------------------------
  // Channels
  // ---------------------------------------------------------------------------

  Future<List<ChatChannel>> fetchChannels(String driverId) async {
    if (driverId.trim().isEmpty) return [];
    for (final base in _endpointsToTry) {
      try {
        final uri = Uri.parse('$base/api/chat/channels');
        final resp = await _httpClient.get(uri).timeout(const Duration(seconds: 4));
        if (resp.statusCode == 200) {
          final decoded = json.decode(resp.body);
          if (decoded is List) {
            return decoded.map((c) => ChatChannel.fromJson(c as Map<String, dynamic>)).toList();
          }
        }
      } catch (e) {
        debugPrint('[ChatRepository] fetchChannels via $base notice: $e');
      }
    }

    return [
      ChatChannel(
        id: 'channel-broadcast',
        type: ChannelType.broadcast,
        name: 'All Fleet Announcements',
        description: 'Company-wide dispatch bulletins and urgent notices',
        updatedAt: DateTime.now(),
      ),
      ChatChannel(
        id: 'channel-office',
        type: ChannelType.office,
        name: 'Office Staff & Dispatch',
        description: 'Direct contact with dispatchers and supervisors',
        updatedAt: DateTime.now(),
      ),
    ];
  }

  Stream<List<ChatChannel>> streamChannels(String driverId) async* {
    yield await fetchChannels(driverId);
    yield* Stream.periodic(const Duration(seconds: 8))
        .asyncMap((_) => fetchChannels(driverId));
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  Stream<List<ChatMessage>> streamMessages(String channelId, {String? memberId}) async* {
    final listenerId = await resolveChatListenerId(memberId ?? '');
    final fs = _firestore;
    if (fs != null) {
      yield* _messageQuery(fs, channelId, memberId: listenerId, limit: 100)
          .snapshots()
          .map((snap) => snap.docs.map((d) => ChatMessage.fromFirestore(d)).toList());
      return;
    }

    yield* _pollMessages(channelId, memberId: listenerId);
  }

  Stream<List<ChatMessage>> _pollMessages(String channelId, {String? memberId}) async* {
    yield await fetchMessages(channelId, memberId: memberId);
    yield* Stream.periodic(const Duration(seconds: 3))
        .asyncMap((_) => fetchMessages(channelId, memberId: memberId));
  }

  Query<Map<String, dynamic>> _messageQuery(
    FirebaseFirestore fs,
    String channelId, {
    String? memberId,
    required int limit,
  }) {
    Query<Map<String, dynamic>> query =
        fs.collection('chat_channels').doc(channelId).collection('messages');
    final listenerId = memberId?.trim() ?? '';
    if (listenerId.isNotEmpty &&
        (channelId.startsWith('dm-') || channelId.startsWith('parent-'))) {
      query = query.where('memberIds', arrayContains: listenerId);
    }
    return query.orderBy('createdAt', descending: false).limitToLast(limit);
  }

  Future<List<ChatMessage>> fetchMessages(String channelId, {int limit = 50, String? memberId}) async {
    for (final base in _endpointsToTry) {
      try {
        final uri = Uri.parse('$base/api/chat/channels/$channelId/messages?limit=$limit');
        final resp = await _httpClient.get(uri).timeout(const Duration(seconds: 4));
        if (resp.statusCode == 200) {
          final decoded = json.decode(resp.body);
          if (decoded is List) {
            return decoded.map((m) => ChatMessage.fromJson(m as Map<String, dynamic>)).toList();
          }
        }
      } catch (e) {
        debugPrint('[ChatRepository] fetchMessages via $base notice: $e');
      }
    }

    final fs = _firestore;
    if (fs != null) {
      try {
        final listenerId = await resolveChatListenerId(memberId ?? '');
        final snap = await _messageQuery(fs, channelId, memberId: listenerId, limit: limit).get();
        return snap.docs.map((d) => ChatMessage.fromFirestore(d)).toList();
      } catch (e) {
        debugPrint('[ChatRepository] Firestore fetchMessages notice: $e');
      }
    }

    return [];
  }

  Future<ChatMessage> sendMessage({
    required String channelId,
    required String driverId,
    required String text,
  }) async {
    // 1. Try sending via REST API (which automatically resolves dynamic name & sends FCM push)
    for (final base in _endpointsToTry) {
      try {
        final uri = Uri.parse('$base/api/chat/channels/$channelId/messages');
        final resp = await _httpClient
            .post(
              uri,
              headers: {'Content-Type': 'application/json'},
              body: json.encode({'text': text}),
            )
            .timeout(const Duration(seconds: 5));

        if (resp.statusCode == 200 || resp.statusCode == 201) {
          final decoded = json.decode(resp.body) as Map<String, dynamic>;
          return ChatMessage.fromJson(decoded);
        }
      } catch (e) {
        debugPrint('[ChatRepository] REST sendMessage to $base notice: $e');
      }
    }

    // 2. Direct Firestore fallback
    final fs = _firestore;
    final now = DateTime.now().toUtc();
    if (fs != null) {
      final listenerId = await resolveChatListenerId(driverId);
      final channelRef = fs.collection('chat_channels').doc(channelId);
      final channelSnap = await channelRef.get();
      final memberIds = <String>[];
      final rawMembers = channelSnap.data()?['memberIds'];
      if (rawMembers is List) {
        for (final item in rawMembers) {
          final id = item.toString().trim();
          if (id.isNotEmpty && !memberIds.contains(id)) {
            memberIds.add(id);
          }
        }
      }
      if ((channelId.startsWith('dm-') || channelId.startsWith('parent-')) &&
          listenerId.isNotEmpty &&
          !memberIds.contains(listenerId)) {
        memberIds.add(listenerId);
      }
      final msgDoc = channelRef.collection('messages').doc();
      final msgData = <String, dynamic>{
        'id': msgDoc.id,
        'channelId': channelId,
        'senderId': driverId,
        'senderName': 'You',
        'text': text,
        'createdAt': Timestamp.fromDate(now),
      };
      if (memberIds.isNotEmpty) {
        msgData['memberIds'] = memberIds;
      }
      await msgDoc.set(msgData);

      // Update lastMessage on channel
      await fs.collection('chat_channels').doc(channelId).set({
        'lastMessage': {
          'text': text,
          'senderId': driverId,
          'senderName': 'You',
          'createdAt': Timestamp.fromDate(now),
        },
        'updatedAt': Timestamp.fromDate(now),
      }, SetOptions(merge: true));

      return ChatMessage(
        id: msgDoc.id,
        channelId: channelId,
        senderId: driverId,
        senderName: 'You',
        text: text,
        createdAt: now,
      );
    }

    throw Exception('Failed to send message: network unavailable');
  }

  // ---------------------------------------------------------------------------
  // Contacts & Direct Messages
  // ---------------------------------------------------------------------------

  Future<List<ChatContact>> fetchContacts(String driverId) async {
    if (driverId.trim().isEmpty) return [];
    for (final base in _endpointsToTry) {
      try {
        final uri = Uri.parse('$base/api/chat/contacts');
        final resp = await _httpClient.get(uri).timeout(const Duration(seconds: 5));
        if (resp.statusCode == 200) {
          final decoded = json.decode(resp.body);
          if (decoded is List) {
            return decoded.map((c) => ChatContact.fromJson(c as Map<String, dynamic>)).toList();
          }
        }
      } catch (e) {
        debugPrint('[ChatRepository] fetchContacts via $base notice: $e');
      }
    }

    return [];
  }

  Future<ChatChannel> createOrGetDirectChannel({
    required String driverId,
    required String targetUserId,
  }) async {
    for (final base in _endpointsToTry) {
      try {
        final uri = Uri.parse('$base/api/chat/channels/direct');
        final resp = await _httpClient
            .post(
              uri,
              headers: {'Content-Type': 'application/json'},
              body: json.encode({'targetUserId': targetUserId}),
            )
            .timeout(const Duration(seconds: 5));

        if (resp.statusCode == 200 || resp.statusCode == 201) {
          final decoded = json.decode(resp.body) as Map<String, dynamic>;
          return ChatChannel.fromJson(decoded);
        }
      } catch (e) {
        debugPrint('[ChatRepository] createOrGetDirectChannel via $base notice: $e');
      }
    }

    // Direct deterministic ID fallback
    final u1 = driverId.compareTo(targetUserId) < 0 ? driverId : targetUserId;
    final u2 = driverId.compareTo(targetUserId) < 0 ? targetUserId : driverId;
    final dmId = 'dm-$u1-$u2';

    return ChatChannel(
      id: dmId,
      type: ChannelType.direct,
      name: 'Direct Message',
      memberIds: [driverId, targetUserId],
      updatedAt: DateTime.now(),
    );
  }
}

Future<String> resolveChatListenerId(String driverId) async {
  final fallback = driverId.trim();
  try {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return fallback;
    final token = await user.getIdTokenResult();
    final claim = token.claims?['employeeId'];
    if (claim is String && claim.trim().isNotEmpty) {
      return claim.trim();
    }
    if (user.uid.isNotEmpty) return user.uid;
  } catch (_) {}
  return fallback;
}
