import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
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
    for (final base in _endpointsToTry) {
      try {
        final uri = Uri.parse('$base/api/public/chat/channels?userId=$driverId');
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

    // Direct Firestore fallback
    final fs = _firestore;
    if (fs != null) {
      try {
        final snap = await fs.collection('chat_channels').get();
        final list = snap.docs.map((d) => ChatChannel.fromFirestore(d)).toList();
        return _filterChannelsForDriver(list, driverId);
      } catch (e) {
        debugPrint('[ChatRepository] Firestore fetchChannels notice: $e');
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

  List<ChatChannel> _filterChannelsForDriver(List<ChatChannel> channels, String driverId) {
    final cleanDriverId = driverId.replaceAll(RegExp(r'^EMP-?', caseSensitive: false), '').trim();
    return channels.where((c) {
      if (c.type == ChannelType.broadcast) return true;
      if (c.type == ChannelType.direct) {
        return c.memberIds.any((m) {
          if (m.toLowerCase() == driverId.toLowerCase()) return true;
          final cleanM = m.replaceAll(RegExp(r'^EMP-?', caseSensitive: false), '').trim();
          return cleanDriverId.isNotEmpty && cleanDriverId == cleanM;
        });
      }
      return true;
    }).toList();
  }

  Stream<List<ChatChannel>> streamChannels(String driverId) {
    final fs = _firestore;
    if (fs != null) {
      return fs.collection('chat_channels').snapshots().map((snap) {
        final list = snap.docs.map((d) => ChatChannel.fromFirestore(d)).toList();
        return _filterChannelsForDriver(list, driverId);
      });
    }

    return Stream.periodic(const Duration(seconds: 3))
        .asyncMap((_) => fetchChannels(driverId));
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  Stream<List<ChatMessage>> streamMessages(String channelId) {
    final fs = _firestore;
    if (fs != null) {
      return fs
          .collection('chat_channels')
          .doc(channelId)
          .collection('messages')
          .orderBy('createdAt', descending: false)
          .limitToLast(100)
          .snapshots()
          .map((snap) => snap.docs.map((d) => ChatMessage.fromFirestore(d)).toList());
    }

    return Stream.periodic(const Duration(seconds: 3))
        .asyncMap((_) => fetchMessages(channelId));
  }

  Future<List<ChatMessage>> fetchMessages(String channelId, {int limit = 50}) async {
    for (final base in _endpointsToTry) {
      try {
        final uri = Uri.parse('$base/api/public/chat/channels/$channelId/messages?limit=$limit');
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
        final snap = await fs
            .collection('chat_channels')
            .doc(channelId)
            .collection('messages')
            .orderBy('createdAt', descending: false)
            .limitToLast(limit)
            .get();
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
        final uri = Uri.parse('$base/api/public/chat/channels/$channelId/messages?userId=$driverId');
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
      final msgDoc = fs.collection('chat_channels').doc(channelId).collection('messages').doc();
      final msgData = {
        'id': msgDoc.id,
        'channelId': channelId,
        'senderId': driverId,
        'senderName': 'You',
        'text': text,
        'createdAt': Timestamp.fromDate(now),
      };
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
    for (final base in _endpointsToTry) {
      try {
        final uri = Uri.parse('$base/api/public/chat/contacts?userId=$driverId');
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
        final uri = Uri.parse('$base/api/public/chat/channels/direct?userId=$driverId');
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
