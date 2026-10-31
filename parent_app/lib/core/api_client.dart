import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';
import 'app_mode.dart';

class ApiClient {
  static const String _tokenKey = 'parent_session_token';
  static const String _contactKey = 'parent_saved_contact';

  // Configurable backend URL via --dart-define=API_BASE_URL=https://your-api-domain.com
  static const String _configuredApiUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');

  // In Flutter web on deployed host, use same origin (rewritten via /api/**); on localhost default to localhost:8080
  String get baseUrl {
    if (_configuredApiUrl.isNotEmpty) {
      return _configuredApiUrl;
    }
    if (kIsWeb) {
      final host = Uri.base.host;
      if (host != 'localhost' && host != '127.0.0.1') {
        return Uri.base.origin;
      }
      return 'http://localhost:8080';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8080';
    }
    return 'http://localhost:8080';
  }

  String? _sessionToken;
  String? _savedContact;

  String? get sessionToken => _sessionToken;
  String? get savedContact => _savedContact;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _sessionToken = prefs.getString(_tokenKey);
    _savedContact = prefs.getString(_contactKey);
  }

  Future<void> saveSession(String token, String contact) async {
    _sessionToken = token;
    _savedContact = contact;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_contactKey, contact);
  }

  Future<void> clearSession() async {
    _sessionToken = null;
    _savedContact = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_contactKey);
  }

  Map<String, String> _headers() {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_sessionToken != null) {
      headers['Authorization'] = 'Bearer $_sessionToken';
    }
    if (_savedContact != null) {
      headers['X-Parent-Contact'] = _savedContact!;
    }
    return headers;
  }

  bool _isDemoContact(String contact) {
    final clean = contact.trim().toLowerCase();
    if (clean.contains('demo') || clean.contains('parent@') || clean.contains('example.com') || clean == 'demo') {
      return true;
    }
    final digits = clean.replaceAll(RegExp(r'\D'), '');
    return digits.endsWith('5550199') || digits.endsWith('5550100') || digits == '1234567890';
  }

  // 1. Request OTP Passcode
  Future<Map<String, dynamic>> requestOtp(String contact) async {
    final url = Uri.parse('$baseUrl/api/parent/auth/request-otp');
    try {
      final resp = await http.post(
        url,
        headers: _headers(),
        body: jsonEncode({'contact': contact}),
      ).timeout(const Duration(seconds: 8));

      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        if (data['success'] == false) {
          if (AppMode.isDemo && _isDemoContact(contact)) {
            return _getDemoOtpResponse(contact);
          }
          throw Exception(data['error'] ?? 'No student profile found with this phone number or email');
        }
        return data;
      }
      if (AppMode.isDemo && _isDemoContact(contact)) {
        return _getDemoOtpResponse(contact);
      }
      throw Exception(data['error'] ?? 'Failed to send passcode');
    } catch (e) {
      if (AppMode.isDemo && _isDemoContact(contact)) {
        return _getDemoOtpResponse(contact);
      }
      rethrow;
    }
  }

  // 2. Verify OTP Passcode
  Future<Map<String, dynamic>> verifyOtp(String contact, String code) async {
    final url = Uri.parse('$baseUrl/api/parent/auth/verify-otp');
    try {
      final resp = await http.post(
        url,
        headers: _headers(),
        body: jsonEncode({'contact': contact, 'code': code}),
      ).timeout(const Duration(seconds: 8));

      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        final token = data['token'] as String?;
        if (token != null) {
          await saveSession(token, contact);
        }
        return data;
      }
      if (AppMode.isDemo && _isDemoContact(contact) && (code == '123456' || code.length >= 4)) {
        final demoResp = _getDemoVerifyResponse(contact);
        await saveSession(demoResp['token'] as String, contact);
        return demoResp;
      }
      throw Exception(data['error'] ?? 'Invalid passcode');
    } catch (e) {
      if (AppMode.isDemo && _isDemoContact(contact) && (code == '123456' || code.length >= 4)) {
        final demoResp = _getDemoVerifyResponse(contact);
        await saveSession(demoResp['token'] as String, contact);
        return demoResp;
      }
      rethrow;
    }
  }

  // 3. Optional Account Registration
  Future<Map<String, dynamic>> register(String contact, String password, String name) async {
    final url = Uri.parse('$baseUrl/api/parent/auth/register');
    final resp = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({
        'contact': contact,
        'password': password,
        'name': name,
      }),
    ).timeout(const Duration(seconds: 8));
    final data = jsonDecode(resp.body) as Map<String, dynamic>;
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final token = data['token']?.toString() ?? '';
      if (token.isNotEmpty) {
        await saveSession(token, contact);
      }
      return data;
    }
    throw Exception(data['error'] ?? 'Failed to register account');
  }

  // 4. Fetch Linked Students & Commutes
  Future<List<ParentStudentCommute>> fetchStudents(String contact) async {
    final url = Uri.parse('$baseUrl/api/parent/students?contact=${Uri.encodeComponent(contact)}');
    try {
      final resp = await http.get(url, headers: _headers()).timeout(const Duration(seconds: 8));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        final list = jsonDecode(resp.body) as List<dynamic>;
        if (list.isNotEmpty) {
          return list.map((e) => ParentStudentCommute.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
      if (AppMode.isDemo && _isDemoContact(contact)) {
        return _getDemoStudentCommutes();
      }
    } catch (_) {
      if (AppMode.isDemo && _isDemoContact(contact)) {
        return _getDemoStudentCommutes();
      }
    }
    if (AppMode.isDemo && _isDemoContact(contact)) {
      return _getDemoStudentCommutes();
    }
    throw Exception('Failed to load student transit data');
  }

  // 5. Fetch Notification Preferences
  Future<ParentNotificationConfig> fetchPreferences() async {
    final url = Uri.parse('$baseUrl/api/parent/preferences');
    try {
      final resp = await http.get(url, headers: _headers()).timeout(const Duration(seconds: 8));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        return ParentNotificationConfig.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
      }
    } catch (e) {
      debugPrint('[ParentApi] preferences request failed: $e');
    }
    return ParentNotificationConfig();
  }

  // 6. Save Notification Preferences
  Future<void> savePreferences(ParentNotificationConfig config) async {
    final url = Uri.parse('$baseUrl/api/parent/preferences');
    final resp = await http.put(
      url,
      headers: _headers(),
      body: jsonEncode(config.toJson()),
    ).timeout(const Duration(seconds: 8));
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw Exception(_errorFromBody(resp.body, 'Failed to save alert preferences'));
    }
  }

  // 6b. Fetch Parent Profile
  Future<ParentUser> fetchProfile(String contact) async {
    final url = Uri.parse('$baseUrl/api/parent/profile?contact=${Uri.encodeComponent(contact)}');
    final resp = await http.get(url, headers: _headers()).timeout(const Duration(seconds: 8));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return ParentUser.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
    }
    throw Exception(_errorFromBody(resp.body, 'Failed to load profile'));
  }

  // 6c. Update Parent Profile (Phone, Email, Home Address, Display Name)
  Future<ParentUser> updateProfile({
    required String contact,
    required String displayName,
    required String phone,
    required String email,
    required String homeAddress,
  }) async {
    final url = Uri.parse('$baseUrl/api/parent/profile?contact=${Uri.encodeComponent(contact)}');
    final resp = await http.put(
      url,
      headers: _headers(),
      body: jsonEncode({
        'displayName': displayName,
        'phone': phone,
        'email': email,
        'homeAddress': homeAddress,
      }),
    ).timeout(const Duration(seconds: 8));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return ParentUser.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
    }
    try {
      final data = jsonDecode(resp.body);
      throw Exception(data['error'] ?? 'Failed to update profile');
    } catch (_) {
      throw Exception('Server returned status ${resp.statusCode}');
    }
  }

  // 7. Get or Create Parent Channel for live chat with dispatch
  Future<Map<String, dynamic>> getOrCreateParentChannel({
    required String parentContact,
    String? parentName,
    int? studentId,
    String? studentName,
    String? busUnitNumber,
    String? routeNo,
    String? schoolName,
    String? grade,
  }) async {
    final url = Uri.parse('$baseUrl/api/parent/chat/channels/parent');
    try {
      final resp = await http.post(
        url,
        headers: _headers(),
        body: jsonEncode({
          'parentContact': parentContact,
          'parentName': parentName ?? 'Parent ($parentContact)',
          'studentId': studentId,
          'studentName': studentName,
          'busUnitNumber': busUnitNumber,
          'routeNo': routeNo,
          'schoolName': schoolName,
          'grade': grade,
        }),
      ).timeout(const Duration(seconds: 4));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        return jsonDecode(resp.body) as Map<String, dynamic>;
      }
    } catch (_) {
      if (AppMode.isDemo || _isDemoContact(parentContact)) {
        return {
          'id': 'channel-demo-${parentContact.replaceAll(RegExp(r'\D'), '')}',
          'name': 'Dispatch Support ($studentName)',
          'status': 'active',
        };
      }
      rethrow;
    }
    if (AppMode.isDemo || _isDemoContact(parentContact)) {
      return {
        'id': 'channel-demo-${parentContact.replaceAll(RegExp(r'\D'), '')}',
        'name': 'Dispatch Support ($studentName)',
        'status': 'active',
      };
    }
    throw Exception('Failed to open chat channel with dispatch');
  }

  // 8. Fetch Messages from channel
  Future<List<Map<String, dynamic>>> fetchChatMessages(String channelId, {int limit = 50}) async {
    if (channelId.startsWith('channel-demo')) {
      return _demoChatMessages();
    }
    final url = Uri.parse('$baseUrl/api/parent/chat/channels/$channelId/messages?limit=$limit');
    try {
      final resp = await http.get(url, headers: _headers()).timeout(const Duration(seconds: 4));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        final list = jsonDecode(resp.body) as List<dynamic>;
        return list.map((e) => e as Map<String, dynamic>).toList();
      }
    } catch (_) {
      if (AppMode.isDemo) {
        return _demoChatMessages();
      }
      rethrow;
    }
    if (AppMode.isDemo) {
      return _demoChatMessages();
    }
    throw Exception('Failed to load chat messages');
  }

  // 9. Send Message to channel
  List<Map<String, dynamic>> _demoChatMessages() {
    return [
      {
        'id': 'msg-welcome',
        'text': 'Hello! Operations Dispatch desk is online. How can we help you regarding your child\'s school bus route today?',
        'senderName': 'Operations Dispatch',
        'senderId': 'dispatch-operator',
        'createdAt': DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String(),
      }
    ];
  }

  Future<Map<String, dynamic>> sendChatMessage({
    required String channelId,
    required String text,
    String? senderName,
    String? senderId,
  }) async {
    final sid = senderId ?? channelId;
    if (channelId.startsWith('channel-demo')) {
      return {
        'id': 'msg-${DateTime.now().millisecondsSinceEpoch}',
        'text': text,
        'senderName': senderName ?? 'Parent',
        'senderId': sid,
        'createdAt': DateTime.now().toIso8601String(),
      };
    }
    final url = Uri.parse('$baseUrl/api/parent/chat/channels/$channelId/messages');
    try {
      final resp = await http.post(
        url,
        headers: _headers(),
        body: jsonEncode({
          'text': text,
          'senderName': senderName ?? 'Parent',
        }),
      ).timeout(const Duration(seconds: 4));
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        return jsonDecode(resp.body) as Map<String, dynamic>;
      }
    } catch (_) {
      if (channelId.startsWith('channel-demo') || AppMode.isDemo) {
        return {
          'id': 'msg-${DateTime.now().millisecondsSinceEpoch}',
          'text': text,
          'senderName': senderName ?? 'Parent',
          'senderId': sid,
          'createdAt': DateTime.now().toIso8601String(),
        };
      }
      rethrow;
    }
    if (channelId.startsWith('channel-demo') || AppMode.isDemo) {
      return {
        'id': 'msg-${DateTime.now().millisecondsSinceEpoch}',
        'text': text,
        'senderName': senderName ?? 'Parent',
        'senderId': sid,
        'createdAt': DateTime.now().toIso8601String(),
      };
    }
    throw Exception('Failed to send chat message');
  }

  // 10. Record Student Absence directly from Parent
  Future<Map<String, dynamic>> recordStudentAbsence({
    required String date,
    required int studentId,
    String? studentName,
    String? schoolName,
    String? routeNo,
    String shiftType = 'ALL',
    required String reason,
    String? reportedBy,
  }) async {
    final url = Uri.parse('$baseUrl/api/parent/absence');
    final resp = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({
        'date': date,
        'studentId': studentId,
        'studentName': studentName,
        'schoolName': schoolName,
        'routeNo': routeNo,
        'shiftType': shiftType,
        'reason': reason,
        'reportedBy': reportedBy ?? 'Parent',
      }),
    ).timeout(const Duration(seconds: 8));
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return jsonDecode(resp.body) as Map<String, dynamic>;
    }
    try {
      final errData = jsonDecode(resp.body);
      throw Exception(errData['error'] ?? 'Failed to record absence');
    } catch (_) {
      throw Exception('Server returned status ${resp.statusCode}');
    }
  }

  String _errorFromBody(String body, String fallback) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map) {
        final message = decoded['error']?.toString().trim() ?? '';
        if (message.isNotEmpty) return message;
      }
    } catch (_) {}
    return fallback;
  }

  Map<String, dynamic> _getDemoOtpResponse(String contact) {
    return {
      'success': true,
      'message': 'Demo temporary passcode generated: 123456',
      'contactType': contact.contains('@') ? 'email' : 'phone',
      'matchedStudentsCount': 2,
      'devCode': '123456',
    };
  }

  Map<String, dynamic> _getDemoVerifyResponse(String contact) {
    return {
      'success': true,
      'token': 'demo-session-token-pcytech',
      'isRegistered': true,
      'parentUser': {
        'id': 'PAR-demo',
        'contactType': contact.contains('@') ? 'email' : 'phone',
        'contactValue': contact,
        'displayName': 'David Watson (Demo Parent)',
        'isRegistered': true,
        'linkedStudentIds': ['STU-1001', 'STU-1002'],
      },
      'students': _demoStudentCommutesJson(),
    };
  }

  List<Map<String, dynamic>> _demoStudentCommutesJson() {
    return [
      {
        'studentId': 1001,
        'studentNo': 'S-1001',
        'studentName': 'Emma Watson',
        'grade': '2',
        'schoolName': 'Broadview Public School',
        'schoolLatitude': 45.36850,
        'schoolLongitude': -75.75720,
        'avatarColor': '#2563EB',
        'shiftType': 'AM',
        'shiftId': 'SHIFT-AM-1',
        'routeNo': 'OCDSB-001',
        'busUnitNumber': '42',
        'driverName': 'Robert Johnson',
        'stopLocation': 'Woodroffe Ave & Baseline Rd, Ottawa, ON',
        'stopLatitude': 45.35125,
        'stopLongitude': -75.76015,
        'stopType': 'HomePickup',
        'scheduledTime': '07:35 AM',
        'estimatedTime': '07:37 AM',
        'lateMinutes': 2,
        'status': 'EN_ROUTE',
        'distanceKm': 0.8,
        'minutesAway': 3,
        'vehicleLocation': {
          'unitNumber': '42',
          'routeNo': 'OCDSB-001',
          'shiftId': 'SHIFT-AM-1',
          'latitude': 45.3530,
          'longitude': -75.7610,
          'heading': 85.0,
          'speedKmh': 35.0,
          'lastUpdated': DateTime.now().toIso8601String(),
          'currentStopSequence': 3,
          'nextStopLocation': 'Woodroffe Ave & Baseline Rd',
          'status': 'EN_ROUTE',
        },
      },
      {
        'studentId': 1002,
        'studentNo': 'S-1002',
        'studentName': 'Lucas Watson',
        'grade': '5',
        'schoolName': 'Nepean High School',
        'schoolLatitude': 45.37800,
        'schoolLongitude': -75.75500,
        'avatarColor': '#7C3AED',
        'shiftType': 'AM',
        'shiftId': 'SHIFT-AM-1',
        'routeNo': 'OCDSB-001',
        'busUnitNumber': '42',
        'driverName': 'Robert Johnson',
        'stopLocation': 'Woodroffe Ave & Richmond Rd, Ottawa, ON',
        'stopLatitude': 45.36850,
        'stopLongitude': -75.75720,
        'stopType': 'HomePickup',
        'scheduledTime': '07:45 AM',
        'estimatedTime': '07:47 AM',
        'lateMinutes': 2,
        'status': 'SCHEDULED',
        'distanceKm': 2.2,
        'minutesAway': 9,
        'vehicleLocation': {
          'unitNumber': '42',
          'routeNo': 'OCDSB-001',
          'shiftId': 'SHIFT-AM-1',
          'latitude': 45.3530,
          'longitude': -75.7610,
          'heading': 85.0,
          'speedKmh': 35.0,
          'lastUpdated': DateTime.now().toIso8601String(),
          'currentStopSequence': 3,
          'nextStopLocation': 'Woodroffe Ave & Baseline Rd',
          'status': 'EN_ROUTE',
        },
      },
    ];
  }

  List<ParentStudentCommute> _getDemoStudentCommutes() {
    return _demoStudentCommutesJson()
        .map((e) => ParentStudentCommute.fromJson(e))
        .toList();
  }
}