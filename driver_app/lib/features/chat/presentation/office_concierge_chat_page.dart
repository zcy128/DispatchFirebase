import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/api_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme.dart';

class OfficeConciergeCardModel {
  final String type;
  final String title;
  final String? requestId;
  final Map<String, dynamic> data;

  const OfficeConciergeCardModel({
    required this.type,
    required this.title,
    this.requestId,
    this.data = const {},
  });

  factory OfficeConciergeCardModel.fromJson(Map<String, dynamic> json) {
    return OfficeConciergeCardModel(
      type: json['type']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      requestId: json['requestId']?.toString(),
      data: (json['data'] is Map<String, dynamic>)
          ? (json['data'] as Map<String, dynamic>)
          : const {},
    );
  }
}

class OfficeConciergeMessageModel {
  final String id;
  final String employeeId;
  final String senderRole;
  final String senderName;
  final String department;
  final String text;
  final OfficeConciergeCardModel? card;

  const OfficeConciergeMessageModel({
    required this.id,
    required this.employeeId,
    required this.senderRole,
    required this.senderName,
    this.department = 'HR · Dispatch',
    required this.text,
    this.card,
  });

  factory OfficeConciergeMessageModel.fromJson(Map<String, dynamic> json) {
    return OfficeConciergeMessageModel(
      id: json['id']?.toString() ?? '',
      employeeId: json['employeeId']?.toString() ?? '',
      senderRole: json['senderRole']?.toString() ?? 'office_ai',
      senderName: json['senderName']?.toString() ?? 'Company Office Assistant',
      department: json['department']?.toString() ?? 'HR · Dispatch',
      text: json['text']?.toString() ?? '',
      card: json['card'] is Map<String, dynamic>
          ? OfficeConciergeCardModel.fromJson(json['card'] as Map<String, dynamic>)
          : null,
    );
  }
}

class OfficeConciergeChatPage extends StatefulWidget {
  final String driverId;
  final String driverName;
  final http.Client? httpClient;

  const OfficeConciergeChatPage({
    super.key,
    required this.driverId,
    required this.driverName,
    this.httpClient,
  });

  @override
  State<OfficeConciergeChatPage> createState() => _OfficeConciergeChatPageState();
}

class _OfficeConciergeChatPageState extends State<OfficeConciergeChatPage> {
  static const Color _officeBrandColor = Color(0xFF0D9488);
  late final http.Client _client;
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<OfficeConciergeMessageModel> _messages = [];
  bool _loading = true;
  bool _sending = false;

  static const List<Map<String, String>> _leaveTypes = [
    {'value': 'personal_days', 'label': 'Personal Days'},
    {'value': 'sick_leave', 'label': 'Sick Leave'},
    {'value': 'vacation', 'label': 'Vacation'},
    {'value': 'bereavement_leave', 'label': 'Bereavement Leave'},
    {'value': 'jury_duty', 'label': 'Jury Duty'},
    {'value': 'other', 'label': 'Other'},
  ];

  @override
  void initState() {
    super.initState();
    _client = widget.httpClient ?? AuthenticatedHttpClient.instance;
    _loadMessages();
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    try {
      final uri = Uri.parse(
        '${ApiConfig.dispatchApiUrl}/office-concierge/messages?employeeId=${Uri.encodeComponent(widget.driverId)}',
      );
      final res = await _client.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final rawList = jsonDecode(res.body) as List<dynamic>;
        if (!mounted) return;
        setState(() {
          _messages = rawList
              .map((e) => OfficeConciergeMessageModel.fromJson(e as Map<String, dynamic>))
              .toList();
          _loading = false;
        });
        _scrollToBottom();
        return;
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _messages = [
        OfficeConciergeMessageModel(
          id: 'welcome-local',
          employeeId: widget.driverId,
          senderRole: 'office_ai',
          senderName: 'Company Office Assistant',
          department: 'HR · Dispatch · Fleet · Payroll',
          text:
              'Welcome to Company Office Chat! Tell us what you need (e.g. "I want to take tomorrow off"), and we will automatically check your route schedule, verify substitute coverage, and route your request to the right department.',
        ),
      ];
      _loading = false;
    });
  }

  Future<void> _sendMessage({
    String? textOverride,
    String? action,
    String? leaveType,
  }) async {
    final text = (textOverride ?? _inputController.text).trim();
    if (text.isEmpty && action == null) return;
    if (textOverride == null) {
      _inputController.clear();
    }

    setState(() {
      _sending = true;
    });

    try {
      final uri = Uri.parse('${ApiConfig.dispatchApiUrl}/office-concierge/chat');
      final isFr = mounted &&
          Localizations.maybeLocaleOf(context)?.languageCode.toLowerCase() == 'fr';
      final payload = <String, dynamic>{
        'employeeId': widget.driverId,
        'employeeName': widget.driverName,
        'message': text,
        'lang': isFr ? 'fr' : 'en',
      };
      if (action != null) {
        payload['action'] = action;
      }
      if (leaveType != null) {
        payload['leaveType'] = leaveType;
      }
      final res = await _client
          .post(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body) as Map<String, dynamic>;
        final rawMsgs = decoded['messages'] as List<dynamic>?;
        if (rawMsgs != null && mounted) {
          setState(() {
            _messages = rawMsgs
                .map((e) => OfficeConciergeMessageModel.fromJson(e as Map<String, dynamic>))
                .toList();
          });
          _scrollToBottom();
        }
      }
    } catch (_) {
      if (mounted && text.isNotEmpty) {
        setState(() {
          _messages = [
            ..._messages,
            OfficeConciergeMessageModel(
              id: 'local-emp-${DateTime.now().millisecondsSinceEpoch}',
              employeeId: widget.driverId,
              senderRole: 'employee',
              senderName: widget.driverName,
              text: text,
            ),
          ];
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  Future<void> _respondToPeerCover(String requestId, bool accepted) async {
    setState(() {
      _sending = true;
    });
    try {
      final uri = Uri.parse(
        '${ApiConfig.dispatchApiUrl}/time-off-requests/${Uri.encodeComponent(requestId)}/confirm-peer-cover',
      );
      await _client
          .post(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'driverId': widget.driverId,
              'driverName': widget.driverName,
              'accepted': accepted,
            }),
          )
          .timeout(const Duration(seconds: 5));
      await _loadMessages();
    } catch (_) {
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: isDark ? AppColors.darkCard : Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Company Office Assistant',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              'Auto-routed to HR · Dispatch · Fleet · Payroll',
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
            onPressed: _loadMessages,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(14),
                    itemCount: _messages.length,
                    itemBuilder: (context, idx) {
                      return _buildMessageBubble(_messages[idx], isDark);
                    },
                  ),
          ),
          _buildQuickPromptsBar(isDark),
          _buildInputBar(isDark),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(OfficeConciergeMessageModel msg, bool isDark) {
    final isEmployee = msg.senderRole == 'employee';
    final card = msg.card;

    return Align(
      alignment: isEmployee ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        constraints: const BoxConstraints(maxWidth: 320),
        decoration: BoxDecoration(
          color: isEmployee
              ? _officeBrandColor
              : (isDark ? AppColors.darkCard : Colors.white),
          borderRadius: BorderRadius.circular(14),
          border: isEmployee
              ? null
              : Border.all(
                  color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
                ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isEmployee)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        msg.senderName,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _officeBrandColor,
                        ),
                      ),
                    ),
                    if (msg.department.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: _officeBrandColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          msg.department,
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w600,
                            color: _officeBrandColor,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            Text(
              msg.text,
              style: TextStyle(
                fontSize: 13,
                height: 1.35,
                color: isEmployee
                    ? Colors.white
                    : (isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight),
              ),
            ),
            if (card != null) ...[
              const SizedBox(height: 10),
              _buildInteractiveCard(card, isDark),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInteractiveCard(OfficeConciergeCardModel card, bool isDark) {
    if (card.type == 'leave_type_selector') {
      return Wrap(
        spacing: 6,
        runSpacing: 6,
        children: _leaveTypes.map((lt) {
          return ActionChip(
            label: Text(
              lt['label']!,
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
            ),
            onPressed: _sending
                ? null
                : () => _sendMessage(
                      textOverride: lt['label'],
                      action: 'select_leave_type',
                      leaveType: lt['value'],
                    ),
          );
        }).toList(),
      );
    }

    if (card.type == 'time_off_preview') {
      final d = card.data;
      return Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: _officeBrandColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _officeBrandColor.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              card.title,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.bold,
                color: _officeBrandColor,
              ),
            ),
            const SizedBox(height: 6),
            Text('Route: ${d['routeNo'] ?? ''} (${d['yardName'] ?? ''})',
                style: const TextStyle(fontSize: 12)),
            Text('Date: ${d['startDate'] ?? ''} to ${d['endDate'] ?? ''} (${d['shiftType'] ?? 'ALL'})',
                style: const TextStyle(fontSize: 12)),
            Text('Leave Type: ${d['leaveTypeLabel'] ?? ''}',
                style: const TextStyle(fontSize: 12)),
            Text('Coverage: ${d['coverageSummary'] ?? ''}',
                style: const TextStyle(fontSize: 12)),
            const SizedBox(height: 10),
            Row(
              children: [
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  ),
                  onPressed: _sending
                      ? null
                      : () => _sendMessage(
                            textOverride: 'Confirm & Submit',
                            action: 'confirm_preview',
                          ),
                  child: const Text('Confirm & Submit', style: TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: _sending
                      ? null
                      : () => _sendMessage(
                            textOverride: 'Cancel',
                            action: 'cancel_draft',
                          ),
                  child: const Text('Cancel', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ],
        ),
      );
    }

    if (card.type == 'peer_cover_invite' && card.requestId != null) {
      return Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFF0284C7).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              card.title,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0284C7),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                  ),
                  onPressed: _sending
                      ? null
                      : () => _respondToPeerCover(card.requestId!, true),
                  child: const Text('Accept Cover', style: TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: _sending
                      ? null
                      : () => _respondToPeerCover(card.requestId!, false),
                  child: const Text('Decline', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _officeBrandColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        card.title,
        style: const TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.bold,
          color: _officeBrandColor,
        ),
      ),
    );
  }

  Widget _buildQuickPromptsBar(bool isDark) {
    final isFr =
        Localizations.maybeLocaleOf(context)?.languageCode.toLowerCase() == 'fr';
    final prompts = isFr
        ? const [
            'Je veux prendre congé demain',
            'Oui',
            'driver22',
            'driver41',
            'Aucun remplaçant',
          ]
        : const [
            'I want to take tomorrow off',
            'Yes',
            'driver22',
            'driver41',
            'No substitute',
          ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: prompts.map((p) {
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: ActionChip(
              label: Text(p, style: const TextStyle(fontSize: 11.5)),
              onPressed: _sending ? null : () => _sendMessage(textOverride: p),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildInputBar(bool isDark) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCard : Colors.white,
          border: Border(
            top: BorderSide(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inputController,
                onSubmitted: (_) => _sendMessage(),
                decoration: InputDecoration(
                  hintText: 'Message Company Office (leave, cover, expenses)...',
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: _sending ? null : () => _sendMessage(),
              icon: const Icon(Icons.send_rounded, color: _officeBrandColor),
              tooltip: 'Send to Office',
            ),
          ],
        ),
      ),
    );
  }
}
