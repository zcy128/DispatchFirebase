import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../route_openings/route_openings_page.dart';
import '../models/chat_model.dart';
import '../repository/chat_repository.dart';
import '../services/chat_notification_service.dart';

class ChatThreadPage extends StatefulWidget {
  final ChatChannel channel;
  final String driverId;
  final String driverName;
  final ChatRepository repository;

  const ChatThreadPage({
    super.key,
    required this.channel,
    required this.driverId,
    required this.driverName,
    required this.repository,
  });

  @override
  State<ChatThreadPage> createState() => _ChatThreadPageState();
}

class _ChatThreadPageState extends State<ChatThreadPage> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;

  StreamSubscription<List<ChatMessage>>? _streamSubscription;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    ChatNotificationService().setActiveChannel(widget.channel.id);
    _initMessageSync();
  }

  @override
  void dispose() {
    ChatNotificationService().setActiveChannel(null);
    _streamSubscription?.cancel();
    _pollingTimer?.cancel();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _initMessageSync() {
    // 1. Initial load
    _fetchLatestMessages();

    // 2. Realtime Stream subscription
    try {
      _streamSubscription = widget.repository
          .streamMessages(widget.channel.id)
          .listen((incoming) {
        if (mounted && incoming.isNotEmpty) {
          _mergeMessages(incoming);
        }
      }, onError: (e) {
        debugPrint('[ChatThreadPage] Stream error: $e');
      });
    } catch (e) {
      debugPrint('[ChatThreadPage] Stream init notice: $e');
    }

    // 3. Periodic sync timer every 2.5s for guaranteed delivery
    _pollingTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) {
      _fetchLatestMessages(silent: true);
    });
  }

  Future<void> _fetchLatestMessages({bool silent = false}) async {
    try {
      final list = await widget.repository.fetchMessages(widget.channel.id);
      if (mounted) {
        _mergeMessages(list);
        if (_isLoading) {
          setState(() => _isLoading = false);
          _scrollToBottom();
        }
      }
    } catch (_) {
      if (mounted && _isLoading) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _mergeMessages(List<ChatMessage> incoming) {
    if (incoming.isEmpty) return;

    final existingIds = <String>{};
    for (final m in _messages) {
      if (!m.id.startsWith('temp-')) {
        existingIds.add(m.id);
      }
    }

    bool hasNew = false;
    for (final inc in incoming) {
      if (!existingIds.contains(inc.id)) {
        // Remove any matching temp message
        _messages.removeWhere((m) =>
            m.id.startsWith('temp-') &&
            m.text == inc.text &&
            (m.senderId == inc.senderId || inc.senderId == widget.driverId));
        _messages.add(inc);
        existingIds.add(inc.id);
        hasNew = true;
      }
    }

    if (hasNew && mounted) {
      _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      setState(() {});
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 60,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _handleSend() async {
    final text = _textController.text.trim();
    if (text.isEmpty || _isSending) return;

    _textController.clear();

    // Optimistic UI update: show message immediately
    final tempMsg = ChatMessage(
      id: 'temp-${DateTime.now().millisecondsSinceEpoch}',
      channelId: widget.channel.id,
      senderId: widget.driverId,
      senderName: 'You',
      text: text,
      createdAt: DateTime.now(),
    );

    setState(() {
      _messages.add(tempMsg);
      _isSending = true;
    });
    _scrollToBottom();

    try {
      final sent = await widget.repository.sendMessage(
        channelId: widget.channel.id,
        driverId: widget.driverId,
        text: text,
      );

      // Replace temp with server confirmed message
      if (mounted) {
        setState(() {
          final index = _messages.indexWhere((m) => m.id == tempMsg.id);
          if (index != -1) {
            _messages[index] = sent;
          }
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to deliver message: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }

  bool _checkIsMe(ChatMessage msg) {
    if (msg.id.startsWith('temp-') || msg.senderName == 'You') return true;
    if (msg.senderId == widget.driverId || msg.senderId == widget.driverName) return true;
    if (widget.driverId.isNotEmpty && msg.senderId.contains(widget.driverId)) return true;
    if (msg.senderId.isNotEmpty && widget.driverId.contains(msg.senderId)) return true;
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        elevation: 0.5,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.channel.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              widget.channel.description ??
                  (widget.channel.type == ChannelType.direct
                      ? 'Direct Message'
                      : 'Channel'),
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Sync Messages',
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: () => _fetchLatestMessages(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Message list
          Expanded(
            child: _isLoading && _messages.isEmpty
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  )
                : _messages.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.chat_bubble_outline_rounded,
                              size: 48,
                              color: isDark ? Colors.grey.shade700 : Colors.grey.shade400,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'No messages yet in this channel.',
                              style: TextStyle(
                                fontSize: 14,
                                color: isDark
                                    ? AppColors.textSecondaryDark
                                    : AppColors.textSecondaryLight,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Send a message to start the conversation.',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? Colors.grey.shade600 : Colors.grey.shade500,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final msg = _messages[index];
                          final isMe = _checkIsMe(msg);
                          return _buildMessageBubble(msg, isMe, isDark);
                        },
                      ),
          ),

          // Composer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkCard : Colors.white,
              border: Border(
                top: BorderSide(
                  color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                  width: 1,
                ),
              ),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      textCapitalization: TextCapitalization.sentences,
                      maxLines: null,
                      keyboardType: TextInputType.multiline,
                      style: TextStyle(
                        fontSize: 14,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Type a message...',
                        hintStyle: TextStyle(
                          fontSize: 13,
                          color: isDark ? Colors.grey.shade500 : Colors.grey.shade400,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        filled: true,
                        fillColor: isDark ? Colors.black26 : Colors.grey.shade100,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      onSubmitted: (_) => _handleSend(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary,
                    ),
                    child: IconButton(
                      icon: _isSending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.black87,
                              ),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              size: 20,
                              color: Colors.black87,
                            ),
                      onPressed: _isSending ? null : _handleSend,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String? _extractRouteNoFromText(String text) {
    final match = RegExp(r'Route:\s*([A-Za-z0-9_-]+)').firstMatch(text);
    if (match != null) return match.group(1);
    final match2 = RegExp(r'Route\s+([A-Za-z0-9_-]+)').firstMatch(text);
    if (match2 != null) return match2.group(1);
    return null;
  }

  void _openRouteOpeningsPage(String msgText) {
    final extractedRouteNo = _extractRouteNoFromText(msgText);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RouteOpeningsPage(
          driverId: widget.driverId,
          driverName: widget.driverName,
          initialRouteNo: extractedRouteNo,
        ),
      ),
    );
  }

  Widget _buildMessageContent(ChatMessage msg, bool isMe, bool isDark) {
    final hasRouteOpeningRef =
        msg.text.toLowerCase().contains('route openings') ||
            msg.text.contains('ROUTE OPENING') ||
            msg.text.contains('ROUTE ASSIGNMENT CONFIRMED');

    final baseTextColor =
        isMe ? Colors.black87 : (isDark ? Colors.white : Colors.black87);

    if (!hasRouteOpeningRef) {
      return Text(
        msg.text,
        style: TextStyle(
          fontSize: 13.5,
          height: 1.35,
          color: baseTextColor,
        ),
      );
    }

    final lines = msg.text.split('\n');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ...lines.map((line) {
          final isLinkLine = line.toLowerCase().contains('route openings');
          if (isLinkLine) {
            return Padding(
              padding: const EdgeInsets.only(top: 6, bottom: 2),
              child: InkWell(
                onTap: () => _openRouteOpeningsPage(msg.text),
                borderRadius: BorderRadius.circular(6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    line,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.35,
                      fontWeight: FontWeight.bold,
                      color: isMe
                          ? Colors.black
                          : (isDark
                              ? AppColors.primary
                              : AppColors.primaryDark),
                      decoration: TextDecoration.underline,
                      decorationColor: isMe
                          ? Colors.black
                          : (isDark
                              ? AppColors.primary
                              : AppColors.primaryDark),
                    ),
                  ),
                ),
              ),
            );
          }
          return Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              line,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.35,
                color: baseTextColor,
              ),
            ),
          );
        }),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: isMe ? Colors.black87 : AppColors.primary,
              foregroundColor: isMe ? Colors.white : const Color(0xFF0F172A),
              minimumSize: const Size(0, 36),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              elevation: 0,
            ),
            icon: const Icon(Icons.open_in_new_rounded, size: 15),
            label: const Text(
              'Open Route Openings & View Stops',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            onPressed: () => _openRouteOpeningsPage(msg.text),
          ),
        ),
      ],
    );
  }

  Widget _buildMessageBubble(ChatMessage msg, bool isMe, bool isDark) {
    final timeStr =
        '${msg.createdAt.hour.toString().padLeft(2, '0')}:${msg.createdAt.minute.toString().padLeft(2, '0')}';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment:
            isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          // Sender badge & time
          Padding(
            padding: const EdgeInsets.only(left: 4, right: 4, bottom: 3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!isMe)
                  Text(
                    msg.senderName,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                if (!isMe) const SizedBox(width: 6),
                Text(
                  timeStr,
                  style: TextStyle(
                    fontSize: 10,
                    color: isDark ? Colors.grey.shade500 : Colors.grey.shade500,
                  ),
                ),
              ],
            ),
          ),

          // Message bubble
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.78,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: isMe
                  ? AppColors.primary
                  : (isDark ? AppColors.darkCard : Colors.grey.shade200),
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isMe ? 16 : 3),
                bottomRight: Radius.circular(isMe ? 3 : 16),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 3,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: _buildMessageContent(msg, isMe, isDark),
          ),
        ],
      ),
    );
  }
}
