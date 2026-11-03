import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/chat/models/chat_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ChannelType Enum Tests', () {
    test('fromString parses known channel types case-insensitively', () {
      expect(ChannelType.fromString('direct'), equals(ChannelType.direct));
      expect(ChannelType.fromString('DIRECT'), equals(ChannelType.direct));
      expect(ChannelType.fromString('fleet'), equals(ChannelType.fleet));
      expect(ChannelType.fromString('office'), equals(ChannelType.office));
      expect(ChannelType.fromString('broadcast'), equals(ChannelType.broadcast));
    });

    test('fromString falls back to broadcast for unrecognized or null values', () {
      expect(ChannelType.fromString(null), equals(ChannelType.broadcast));
      expect(ChannelType.fromString('unknown_type'), equals(ChannelType.broadcast));
      expect(ChannelType.fromString(''), equals(ChannelType.broadcast));
    });
  });

  group('ChatChannel Tests', () {
    test('fromJson deserializes complete channel data', () {
      final json = {
        'id': 'chan-101',
        'type': 'fleet',
        'name': 'Ottawa South Drivers',
        'description': 'Drivers operating out of the South Yard',
        'yardId': 'yard-01',
        'yardName': 'South Yard',
        'memberIds': ['drv-1', 'drv-2', 'dispatch-1'],
        'lastMessage': {
          'text': 'Road closure on Bank Street',
          'senderName': 'Dispatch Central',
          'senderId': 'dispatch-1',
          'createdAt': '2026-11-02T15:30:00Z',
        },
        'updatedAt': '2026-11-02T15:30:00Z',
      };

      final channel = ChatChannel.fromJson(json);

      expect(channel.id, equals('chan-101'));
      expect(channel.type, equals(ChannelType.fleet));
      expect(channel.name, equals('Ottawa South Drivers'));
      expect(channel.yardId, equals('yard-01'));
      expect(channel.memberIds.length, equals(3));
      expect(channel.memberIds, contains('drv-1'));
      expect(channel.lastMessageText, equals('Road closure on Bank Street'));
      expect(channel.lastMessageSender, equals('Dispatch Central'));
      expect(channel.lastMessageTime, isNotNull);
      expect(channel.lastMessageTime?.hour, equals(15));
    });

    test('fromJson handles empty or partial json gracefully with sensible defaults', () {
      final json = {
        'id': 'chan-empty',
      };

      final channel = ChatChannel.fromJson(json);

      expect(channel.id, equals('chan-empty'));
      expect(channel.type, equals(ChannelType.broadcast));
      expect(channel.name, equals('Channel'));
      expect(channel.memberIds, isEmpty);
      expect(channel.lastMessageText, isNull);
      expect(channel.lastMessageSender, isNull);
      expect(channel.lastMessageTime, isNull);
    });
  });

  group('ChatMessage Tests', () {
    test('fromJson deserializes text message with timestamps', () {
      final json = {
        'id': 'msg-001',
        'channelId': 'chan-101',
        'senderId': 'drv-1',
        'senderName': 'John Driver',
        'text': 'Arrived at Hillcrest High School for drop-off.',
        'createdAt': '2026-11-02T08:15:00Z',
      };

      final message = ChatMessage.fromJson(json);

      expect(message.id, equals('msg-001'));
      expect(message.channelId, equals('chan-101'));
      expect(message.senderName, equals('John Driver'));
      expect(message.text, equals('Arrived at Hillcrest High School for drop-off.'));
      expect(message.mediaUrl, isNull);
      expect(message.mediaType, isNull);
      expect(message.createdAt.hour, equals(8));
      expect(message.createdAt.minute, equals(15));
    });

    test('fromJson parses attachment message with mediaUrl and mediaType', () {
      final json = {
        'id': 'msg-media',
        'channelId': 'chan-101',
        'senderId': 'drv-1',
        'senderName': 'John Driver',
        'text': 'Photo of road construction detour sign',
        'mediaUrl': 'https://firebasestorage.googleapis.com/v0/b/app/detour.jpg',
        'mediaType': 'image/jpeg',
        'createdAt': '2026-11-02T08:20:00Z',
      };

      final message = ChatMessage.fromJson(json);

      expect(message.mediaUrl, equals('https://firebasestorage.googleapis.com/v0/b/app/detour.jpg'));
      expect(message.mediaType, equals('image/jpeg'));
    });
  });

  group('ChatContact Tests', () {
    test('fromJson extracts contact details and falls back for displayName', () {
      final json1 = {
        'id': 'contact-1',
        'empNumber': 'EMP-2001',
        'fullName': 'Alice Wonderland',
        'displayName': 'Alice W.',
        'jobPosition': 'School Bus Driver',
        'role': 'driver',
        'yardId': 'yard-north',
      };
      final contact1 = ChatContact.fromJson(json1);
      expect(contact1.displayName, equals('Alice W.'));
      expect(contact1.jobPosition, equals('School Bus Driver'));

      final json2 = {
        'id': 'contact-2',
        'empNumber': 'EMP-2002',
        'fullName': 'Bob Builder',
        'jobPosition': 'Safety Supervisor',
        'role': 'staff',
      };
      final contact2 = ChatContact.fromJson(json2);
      expect(contact2.displayName, equals('Bob Builder'));
      expect(contact2.role, equals('staff'));
      expect(contact2.yardId, isNull);
    });
  });
}
