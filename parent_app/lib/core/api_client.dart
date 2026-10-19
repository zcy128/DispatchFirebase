import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';

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

  // 1. Request OTP Passcode
  Future<Map<String, dynamic>> requestOtp(String contact) async {
    final url = Uri.parse('$baseUrl/api/parent/auth/request-otp');
    final resp = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({'contact': contact}),
    );
    final data = jsonDecode(resp.body) as Map<String, dynamic>;
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      if (data['success'] == false) {
        throw Exception(data['error'] ?? 'No student profile found with this phone number or email');
      }
      return data;
    }
    throw Exception(data['error'] ?? 'Failed to send passcode');
  }

  // 2. Verify OTP Passcode
  Future<Map<String, dynamic>> verifyOtp(String contact, String code) async {
    final url = Uri.parse('$baseUrl/api/parent/auth/verify-otp');
    final resp = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({'contact': contact, 'code': code}),
    );
    final data = jsonDecode(resp.body) as Map<String, dynamic>;
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final token = data['token'] as String?;
      if (token != null) {
        await saveSession(token, contact);
      }
      return data;
    }
    throw Exception(data['error'] ?? 'Invalid passcode');
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
    );
    final data = jsonDecode(resp.body) as Map<String, dynamic>;
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return data;
    }
    throw Exception(data['error'] ?? 'Failed to register account');
  }

  // 4. Fetch Linked Students & Commutes
  Future<List<ParentStudentCommute>> fetchStudents(String contact) async {
    final url = Uri.parse('$baseUrl/api/parent/students?contact=${Uri.encodeComponent(contact)}');
    final resp = await http.get(url, headers: _headers());
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final list = jsonDecode(resp.body) as List<dynamic>;
      return list.map((e) => ParentStudentCommute.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to load student transit data');
  }

  // 5. Fetch Notification Preferences
  Future<ParentNotificationConfig> fetchPreferences() async {
    final url = Uri.parse('$baseUrl/api/parent/preferences');
    final resp = await http.get(url, headers: _headers());
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return ParentNotificationConfig.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
    }
    return ParentNotificationConfig();
  }

  // 6. Save Notification Preferences
  Future<void> savePreferences(ParentNotificationConfig config) async {
    final url = Uri.parse('$baseUrl/api/parent/preferences');
    await http.put(
      url,
      headers: _headers(),
      body: jsonEncode(config.toJson()),
    );
  }

  // 6b. Fetch Parent Profile
  Future<ParentUser> fetchProfile(String contact) async {
    final url = Uri.parse('$baseUrl/api/parent/profile?contact=${Uri.encodeComponent(contact)}');
    final resp = await http.get(url, headers: _headers());
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return ParentUser.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
    }
    throw Exception('Failed to load profile');
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
    );
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
    final url = Uri.parse('$baseUrl/api/public/chat/channels/parent');
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
    );
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return jsonDecode(resp.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to open chat channel with dispatch');
  }

  // 8. Fetch Messages from channel
  Future<List<Map<String, dynamic>>> fetchChatMessages(String channelId, {int limit = 50}) async {
    final url = Uri.parse('$baseUrl/api/public/chat/channels/$channelId/messages?limit=$limit');
    final resp = await http.get(url, headers: _headers());
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final list = jsonDecode(resp.body) as List<dynamic>;
      return list.map((e) => e as Map<String, dynamic>).toList();
    }
    throw Exception('Failed to load chat messages');
  }

  // 9. Send Message to channel
  Future<Map<String, dynamic>> sendChatMessage({
    required String channelId,
    required String text,
    String? senderName,
    String? senderId,
  }) async {
    final sid = senderId ?? channelId;
    final url = Uri.parse('$baseUrl/api/public/chat/channels/$channelId/messages?userId=${Uri.encodeComponent(sid)}');
    final resp = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({
        'text': text,
        'senderName': senderName ?? 'Parent',
      }),
    );
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return jsonDecode(resp.body) as Map<String, dynamic>;
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
    final url = Uri.parse('$baseUrl/api/public/dispatch/students/absence');
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
    );
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
}
