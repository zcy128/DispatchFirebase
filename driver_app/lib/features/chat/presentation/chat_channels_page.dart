import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../models/chat_model.dart';
import '../repository/chat_repository.dart';
import '../services/chat_notification_service.dart';
import 'chat_thread_page.dart';
import 'new_chat_contact_page.dart';

class ChatChannelsPage extends StatefulWidget {
  final String driverId;
  final String driverName;
  final ChatRepository repository;

  const ChatChannelsPage({
    super.key,
    required this.driverId,
    required this.driverName,
    required this.repository,
  });

  @override
  State<ChatChannelsPage> createState() => _ChatChannelsPageState();
}

class _ChatChannelsPageState extends State<ChatChannelsPage> {
  late Stream<List<ChatChannel>> _channelsStream;

  @override
  void initState() {
    super.initState();
    _refreshChannels();
  }

  void _refreshChannels() {
    setState(() {
      _channelsStream = widget.repository.streamChannels(widget.driverId);
    });
  }

  void _openChannel(ChatChannel channel) {
    ChatNotificationService().setActiveChannel(channel.id);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatThreadPage(
          channel: channel,
          driverId: widget.driverId,
          driverName: widget.driverName,
          repository: widget.repository,
        ),
      ),
    ).then((_) {
      ChatNotificationService().setActiveChannel(null);
      _refreshChannels();
    });
  }

  void _openNewChat() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => NewChatContactPage(
          driverId: widget.driverId,
          driverName: widget.driverName,
          repository: widget.repository,
        ),
      ),
    ).then((_) => _refreshChannels());
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Operations Chat',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            Text(
              'Fleet Channels & Direct Messages',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refreshChannels,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.black87,
        icon: const Icon(Icons.chat_bubble_outline_rounded, size: 20),
        label: const Text(
          'New Chat',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        onPressed: _openNewChat,
      ),
      body: StreamBuilder<List<ChatChannel>>(
        stream: _channelsStream,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            );
          }

          final channels = snapshot.data ?? [];

          if (channels.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.forum_outlined,
                    size: 48,
                    color: isDark ? Colors.grey.shade700 : Colors.grey.shade400,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No active conversations yet.',
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black87,
                    ),
                    onPressed: _openNewChat,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Start Direct Message'),
                  ),
                ],
              ),
            );
          }

          final groupChannels = channels.where((c) => c.type != ChannelType.direct).toList();
          final directChannels = channels.where((c) => c.type == ChannelType.direct).toList();

          return ListView(
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              // 1. Group / Fleet Channels Section
              if (groupChannels.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                  child: Text(
                    'FLEET & CHANNELS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                    ),
                  ),
                ),
                ...groupChannels.map((c) => _buildChannelTile(c, isDark)),
              ],

              // 2. Direct Messages Section
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'DIRECT MESSAGES',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                        color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                      ),
                    ),
                    GestureDetector(
                      onTap: _openNewChat,
                      child: const Text(
                        '+ New',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              if (directChannels.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkCard : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.chat_outlined,
                          size: 20,
                          color: isDark ? Colors.grey.shade500 : Colors.grey.shade600,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Message your Dispatcher, Payroll, or colleagues directly.',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ...directChannels.map((c) => _buildChannelTile(c, isDark)),

              const SizedBox(height: 80),
            ],
          );
        },
      ),
    );
  }

  Widget _buildChannelTile(ChatChannel channel, bool isDark) {
    IconData icon;
    Color iconColor;

    switch (channel.type) {
      case ChannelType.broadcast:
        icon = Icons.campaign_rounded;
        iconColor = Colors.orange;
        break;
      case ChannelType.office:
        icon = Icons.business_rounded;
        iconColor = Colors.blue;
        break;
      case ChannelType.fleet:
        icon = Icons.directions_bus_rounded;
        iconColor = Colors.green;
        break;
      case ChannelType.direct:
        icon = Icons.person_rounded;
        iconColor = AppColors.primary;
        break;
    }

    final isUnread = ChatNotificationService().isChannelUnread(channel.id);

    return ListTile(
      leading: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: iconColor, size: 22),
      ),
      title: Row(
        children: [
          Expanded(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    channel.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isUnread ? FontWeight.bold : FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (isUnread) ...[
                  const SizedBox(width: 6),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (channel.lastMessageTime != null)
            Text(
              '${channel.lastMessageTime!.hour.toString().padLeft(2, '0')}:${channel.lastMessageTime!.minute.toString().padLeft(2, '0')}',
              style: TextStyle(
                fontSize: 10,
                fontWeight: isUnread ? FontWeight.bold : FontWeight.normal,
                color: isUnread ? AppColors.primary : (isDark ? Colors.grey.shade500 : Colors.grey.shade500),
              ),
            ),
        ],
      ),
      subtitle: Text(
        channel.lastMessageText != null
            ? '${channel.lastMessageSender != null ? "${channel.lastMessageSender}: " : ""}${channel.lastMessageText}'
            : (channel.description ?? 'Tap to view conversation'),
        style: TextStyle(
          fontSize: 12,
          color: channel.lastMessageText != null
              ? (isDark ? Colors.grey.shade300 : Colors.grey.shade700)
              : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      onTap: () => _openChannel(channel),
    );
  }
}
