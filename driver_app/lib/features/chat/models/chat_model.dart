import 'package:cloud_firestore/cloud_firestore.dart';

enum ChannelType {
  direct,
  fleet,
  office,
  broadcast;

  static ChannelType fromString(String? val) {
    switch (val?.toLowerCase()) {
      case 'direct':
        return ChannelType.direct;
      case 'fleet':
        return ChannelType.fleet;
      case 'office':
        return ChannelType.office;
      case 'broadcast':
      default:
        return ChannelType.broadcast;
    }
  }

  String toValue() => name;
}

class ChatChannel {
  final String id;
  final ChannelType type;
  final String name;
  final String? description;
  final String? yardId;
  final String? yardName;
  final List<String> memberIds;
  final String? lastMessageText;
  final String? lastMessageSender;
  final String? lastMessageSenderId;
  final DateTime? lastMessageTime;
  final DateTime updatedAt;

  ChatChannel({
    required this.id,
    required this.type,
    required this.name,
    this.description,
    this.yardId,
    this.yardName,
    this.memberIds = const [],
    this.lastMessageText,
    this.lastMessageSender,
    this.lastMessageSenderId,
    this.lastMessageTime,
    required this.updatedAt,
  });

  factory ChatChannel.fromJson(Map<String, dynamic> json) {
    DateTime? lastMsgTime;
    if (json['lastMessage'] != null && json['lastMessage']['createdAt'] != null) {
      lastMsgTime = DateTime.tryParse(json['lastMessage']['createdAt'].toString());
    }

    DateTime updated = DateTime.now();
    if (json['updatedAt'] != null) {
      updated = DateTime.tryParse(json['updatedAt'].toString()) ?? DateTime.now();
    }

    final membersRaw = json['memberIds'];
    List<String> members = [];
    if (membersRaw is List) {
      members = membersRaw.map((e) => e.toString()).toList();
    }

    return ChatChannel(
      id: json['id']?.toString() ?? '',
      type: ChannelType.fromString(json['type']?.toString()),
      name: json['name']?.toString() ?? 'Channel',
      description: json['description']?.toString(),
      yardId: json['yardId']?.toString(),
      yardName: json['yardName']?.toString(),
      memberIds: members,
      lastMessageText: json['lastMessage'] != null ? json['lastMessage']['text']?.toString() : null,
      lastMessageSender: json['lastMessage'] != null ? json['lastMessage']['senderName']?.toString() : null,
      lastMessageSenderId: json['lastMessage'] != null ? json['lastMessage']['senderId']?.toString() : null,
      lastMessageTime: lastMsgTime,
      updatedAt: updated,
    );
  }

  factory ChatChannel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final lastMsg = data['lastMessage'] as Map<String, dynamic>?;

    DateTime? lastMsgTime;
    if (lastMsg != null && lastMsg['createdAt'] != null) {
      final t = lastMsg['createdAt'];
      if (t is Timestamp) {
        lastMsgTime = t.toDate();
      } else if (t is String) {
        lastMsgTime = DateTime.tryParse(t);
      }
    }

    DateTime updated = DateTime.now();
    if (data['updatedAt'] != null) {
      final u = data['updatedAt'];
      if (u is Timestamp) {
        updated = u.toDate();
      } else if (u is String) {
        updated = DateTime.tryParse(u) ?? DateTime.now();
      }
    }

    final membersRaw = data['memberIds'];
    List<String> members = [];
    if (membersRaw is List) {
      members = membersRaw.map((e) => e.toString()).toList();
    }

    return ChatChannel(
      id: doc.id,
      type: ChannelType.fromString(data['type']?.toString()),
      name: data['name']?.toString() ?? 'Channel',
      description: data['description']?.toString(),
      yardId: data['yardId']?.toString(),
      yardName: data['yardName']?.toString(),
      memberIds: members,
      lastMessageText: lastMsg?['text']?.toString(),
      lastMessageSender: lastMsg?['senderName']?.toString(),
      lastMessageSenderId: lastMsg?['senderId']?.toString(),
      lastMessageTime: lastMsgTime,
      updatedAt: updated,
    );
  }
}

class ChatMessage {
  final String id;
  final String channelId;
  final String senderId;
  final String senderName;
  final String text;
  final String? mediaUrl;
  final String? mediaType;
  final DateTime createdAt;

  ChatMessage({
    required this.id,
    required this.channelId,
    required this.senderId,
    required this.senderName,
    required this.text,
    this.mediaUrl,
    this.mediaType,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    DateTime created = DateTime.now();
    if (json['createdAt'] != null) {
      created = DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now();
    }

    return ChatMessage(
      id: json['id']?.toString() ?? '',
      channelId: json['channelId']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? '',
      senderName: json['senderName']?.toString() ?? 'User',
      text: json['text']?.toString() ?? '',
      mediaUrl: json['mediaUrl']?.toString(),
      mediaType: json['mediaType']?.toString(),
      createdAt: created,
    );
  }

  factory ChatMessage.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    DateTime created = DateTime.now();
    if (data['createdAt'] != null) {
      final t = data['createdAt'];
      if (t is Timestamp) {
        created = t.toDate();
      } else if (t is String) {
        created = DateTime.tryParse(t) ?? DateTime.now();
      }
    }

    return ChatMessage(
      id: doc.id,
      channelId: data['channelId']?.toString() ?? '',
      senderId: data['senderId']?.toString() ?? '',
      senderName: data['senderName']?.toString() ?? 'User',
      text: data['text']?.toString() ?? '',
      mediaUrl: data['mediaUrl']?.toString(),
      mediaType: data['mediaType']?.toString(),
      createdAt: created,
    );
  }
}

class ChatContact {
  final String id;
  final String empNumber;
  final String fullName;
  final String displayName;
  final String jobPosition;
  final String role;
  final String? yardId;

  ChatContact({
    required this.id,
    required this.empNumber,
    required this.fullName,
    required this.displayName,
    required this.jobPosition,
    required this.role,
    this.yardId,
  });

  factory ChatContact.fromJson(Map<String, dynamic> json) {
    return ChatContact(
      id: json['id']?.toString() ?? '',
      empNumber: json['empNumber']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? json['fullName']?.toString() ?? 'User',
      jobPosition: json['jobPosition']?.toString() ?? '',
      role: json['role']?.toString() ?? 'staff',
      yardId: json['yardId']?.toString(),
    );
  }
}
