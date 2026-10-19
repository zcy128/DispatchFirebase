import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../main.dart';
import '../models/chat_model.dart';
import '../presentation/chat_thread_page.dart';
import '../repository/chat_repository.dart';

class ChatNotificationService {
  static final ChatNotificationService _instance = ChatNotificationService._internal();
  factory ChatNotificationService() => _instance;
  ChatNotificationService._internal();

  final ValueNotifier<int> unreadCountNotifier = ValueNotifier<int>(0);
  final Set<String> _unreadChannelIds = {};
  final Map<String, DateTime> _lastSeenTimes = {};
  
  StreamSubscription<List<ChatChannel>>? _subscription;
  String? _currentDriverId;
  String? _activeChannelId;
  bool _isInitialSync = true;

  void setActiveChannel(String? channelId) {
    _activeChannelId = channelId;
    if (channelId != null) {
      markChannelAsRead(channelId);
    }
  }

  bool isChannelUnread(String channelId) {
    return _unreadChannelIds.contains(channelId);
  }

  void markChannelAsRead(String channelId) {
    if (_unreadChannelIds.remove(channelId)) {
      unreadCountNotifier.value = _unreadChannelIds.length;
    }
  }

  void clearAllUnread() {
    _unreadChannelIds.clear();
    unreadCountNotifier.value = 0;
  }

  void startListening({
    required String driverId,
    required ChatRepository repository,
  }) {
    if (_currentDriverId == driverId && _subscription != null) {
      return;
    }

    stopListening();
    _currentDriverId = driverId;
    _isInitialSync = true;

    _subscription = repository.streamChannels(driverId).listen((channels) {
      _processChannelsUpdate(channels, driverId, repository);
    });
  }

  void stopListening() {
    _subscription?.cancel();
    _subscription = null;
    _currentDriverId = null;
    _isInitialSync = true;
    _unreadChannelIds.clear();
    _lastSeenTimes.clear();
    unreadCountNotifier.value = 0;
  }

  bool _isSentByCurrentDriver(String? senderId, String driverId) {
    if (senderId == null || senderId.isEmpty) return false;
    if (senderId.toLowerCase() == driverId.toLowerCase()) return true;

    final cleanSender = senderId.replaceAll(RegExp(r'^EMP-?', caseSensitive: false), '').trim();
    final cleanDriver = driverId.replaceAll(RegExp(r'^EMP-?', caseSensitive: false), '').trim();

    return cleanSender.isNotEmpty && cleanSender == cleanDriver;
  }

  void _processChannelsUpdate(
    List<ChatChannel> channels,
    String driverId,
    ChatRepository repository,
  ) {
    if (_isInitialSync) {
      for (final ch in channels) {
        if (ch.lastMessageTime != null) {
          _lastSeenTimes[ch.id] = ch.lastMessageTime!;
        }
      }
      _isInitialSync = false;
      return;
    }

    for (final ch in channels) {
      final msgTime = ch.lastMessageTime;
      if (msgTime == null || ch.lastMessageText == null) continue;

      final previousTime = _lastSeenTimes[ch.id];
      final isNewer = previousTime == null || msgTime.isAfter(previousTime);

      if (isNewer) {
        _lastSeenTimes[ch.id] = msgTime;

        // Skip if sender is the driver themselves
        if (_isSentByCurrentDriver(ch.lastMessageSenderId, driverId)) {
          continue;
        }

        // If driver is currently viewing this exact chat, do not pop banner
        if (_activeChannelId == ch.id) {
          continue;
        }

        // Mark as unread
        _unreadChannelIds.add(ch.id);
        unreadCountNotifier.value = _unreadChannelIds.length;

        // Trigger vibration
        HapticFeedback.mediumImpact();

        // Show floating in-app notification banner
        showInAppBanner(
          channel: ch,
          senderName: ch.lastMessageSender ?? 'Dispatch',
          messageText: ch.lastMessageText ?? '',
          driverId: driverId,
          repository: repository,
        );
      }
    }
  }

  void showInAppBanner({
    required ChatChannel channel,
    required String senderName,
    required String messageText,
    required String driverId,
    required ChatRepository repository,
  }) {
    final messenger = rootScaffoldMessengerKey.currentState;
    if (messenger == null) return;

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF0F172A), // Dark slate
        elevation: 8,
        margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        duration: const Duration(seconds: 5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFFF59E0B), width: 1.2), // Amber border
        ),
        content: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.chat_bubble_rounded,
                color: Color(0xFFF59E0B),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          senderName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '(${channel.name})',
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 11,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    messageText,
                    style: const TextStyle(
                      color: Color(0xFFCBD5E1),
                      fontSize: 12,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        action: SnackBarAction(
          label: 'OPEN',
          textColor: const Color(0xFFF59E0B),
          onPressed: () {
            markChannelAsRead(channel.id);
            final navigator = rootNavigatorKey.currentState;
            if (navigator != null) {
              navigator.push(
                MaterialPageRoute(
                  builder: (_) => ChatThreadPage(
                    channel: channel,
                    driverId: driverId,
                    driverName: driverId,
                    repository: repository,
                  ),
                ),
              );
            }
          },
        ),
      ),
    );
  }
}
