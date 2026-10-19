import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/api_client.dart';
import '../../../core/models.dart';
import '../../../core/theme.dart';

/// Message model for Live Dispatcher Chat session
class _ChatMessage {
  final String id;
  final String text;
  final String senderName;
  final bool isFromDispatcher;
  final DateTime time;

  _ChatMessage({
    required this.id,
    required this.text,
    required this.senderName,
    required this.isFromDispatcher,
    required this.time,
  });
}

/// Comprehensive Dispatcher Contact Hub:
/// Allows parents to Call, SMS, or Live Chat with Fleet Dispatchers.
class DispatcherContactSheet extends StatefulWidget {
  final ParentStudentCommute? commute;
  final List<ParentStudentCommute>? allStudents;
  final String parentContact;
  final ApiClient apiClient;
  final bool autoOpenCustomAbsence;

  const DispatcherContactSheet({
    super.key,
    required this.commute,
    this.allStudents,
    required this.parentContact,
    required this.apiClient,
    this.autoOpenCustomAbsence = false,
  });

  @override
  State<DispatcherContactSheet> createState() => _DispatcherContactSheetState();
}

class _DispatcherContactSheetState extends State<DispatcherContactSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _textController = TextEditingController();
  final ScrollController _chatScrollController = ScrollController();
  final ScrollController _chipScrollController = ScrollController();

  static const String dispatchPhone = '+16135550100';
  static const String dispatchDisplayPhone = '(613) 555-0100';
  static const String dispatchSmsNumber = '+16135550188';
  static const String dispatchDisplaySms = '(613) 555-0188';

  final List<_ChatMessage> _messages = [];
  String? _channelId;
  bool _isLoadingChannel = true;
  bool _isSending = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _initChannel();
    if (widget.autoOpenCustomAbsence) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleCustomAbsence();
      });
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tabController.dispose();
    _textController.dispose();
    _chatScrollController.dispose();
    _chipScrollController.dispose();
    super.dispose();
  }

  void _scrollChips(double offset) {
    if (_chipScrollController.hasClients) {
      final target = (_chipScrollController.offset + offset)
          .clamp(0.0, _chipScrollController.position.maxScrollExtent);
      _chipScrollController.animateTo(
        target,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _initChannel() async {
    setState(() => _isLoadingChannel = true);
    try {
      final channelData = await widget.apiClient.getOrCreateParentChannel(
        parentContact: widget.parentContact,
        parentName: 'Parent (${widget.parentContact})',
        studentId: widget.commute?.studentId,
        studentName: widget.commute?.studentName,
        busUnitNumber: widget.commute?.busUnitNumber,
        routeNo: widget.commute?.routeNo,
        schoolName: widget.commute?.schoolName,
        grade: widget.commute?.grade,
      );
      _channelId = channelData['id'] as String?;
      if (_channelId != null) {
        await _fetchMessages(initial: true);
        _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) => _fetchMessages());
      }
    } catch (e) {
      debugPrint('Error creating/joining parent chat channel: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoadingChannel = false);
      }
    }
  }

  Future<void> _fetchMessages({bool initial = false}) async {
    if (_channelId == null) return;
    try {
      final rawList = await widget.apiClient.fetchChatMessages(_channelId!);
      final clean = widget.parentContact.replaceAll(RegExp(r'[^0-9]'), '');
      final mySenderId = clean.isNotEmpty ? 'parent-$clean' : 'parent';

      final parsed = rawList.map((m) {
        final senderId = (m['senderId'] ?? '').toString();
        final isFromDispatcher = senderId != mySenderId &&
            senderId != _channelId &&
            senderId != widget.parentContact &&
            !senderId.startsWith('parent-');
        DateTime time = DateTime.now();
        if (m['createdAt'] != null) {
          time = DateTime.tryParse(m['createdAt'].toString())?.toLocal() ?? DateTime.now();
        }
        return _ChatMessage(
          id: (m['id'] ?? '').toString(),
          text: (m['text'] ?? '').toString(),
          senderName: (m['senderName'] ?? (isFromDispatcher ? 'Dispatch Desk' : 'Parent')).toString(),
          isFromDispatcher: isFromDispatcher,
          time: time,
        );
      }).toList();

      if (parsed.isEmpty) {
        final studentName = widget.commute?.studentName ?? 'Student';
        final busNo = widget.commute?.busUnitNumber.isNotEmpty == true ? widget.commute!.busUnitNumber : '42';
        parsed.add(
          _ChatMessage(
            id: 'system_welcome',
            text: 'Hello! You are connected with the Fleet Operations Dispatch Desk for $studentName (Bus #$busNo). How can we assist you today?',
            senderName: 'Fleet Dispatch Desk',
            isFromDispatcher: true,
            time: DateTime.now(),
          ),
        );
      }

      if (!mounted) return;

      final countChanged = parsed.length != _messages.length;
      final lastChanged = parsed.isNotEmpty && _messages.isNotEmpty && parsed.last.id != _messages.last.id;

      setState(() {
        _messages
          ..clear()
          ..addAll(parsed);
      });

      if (initial || countChanged || lastChanged) {
        _scrollToBottom();
      }
    } catch (e) {
      debugPrint('Error polling chat messages: $e');
    }
  }

  Future<void> _makePhoneCall() async {
    final uri = Uri.parse('tel:$dispatchPhone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _copyToClipboard(dispatchPhone, 'Dispatch phone copied to clipboard: $dispatchDisplayPhone');
    }
  }

  Future<void> _sendSms({String? customBody}) async {
    final studentName = widget.commute?.studentName ?? 'Student';
    final busNo = widget.commute?.busUnitNumber.isNotEmpty == true ? widget.commute!.busUnitNumber : '42';
    final body = customBody ?? 'Student: $studentName, Bus: #$busNo. Inquiry: ';

    final uri = Uri.parse('sms:$dispatchSmsNumber?body=${Uri.encodeComponent(body)}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _copyToClipboard(dispatchSmsNumber, 'SMS hotline copied to clipboard: $dispatchDisplaySms');
    }
  }

  void _copyToClipboard(String text, String message) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.secondary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _sendChatMessage(String text) async {
    if (text.trim().isEmpty || _channelId == null || _isSending) return;

    final trimmed = text.trim();
    _textController.clear();

    final clean = widget.parentContact.replaceAll(RegExp(r'[^0-9]'), '');
    final mySenderId = clean.isNotEmpty ? 'parent-$clean' : 'parent';
    final parentName = 'Parent (${widget.parentContact})';

    setState(() {
      _isSending = true;
      _messages.add(
        _ChatMessage(
          id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
          text: trimmed,
          senderName: parentName,
          isFromDispatcher: false,
          time: DateTime.now(),
        ),
      );
    });

    _scrollToBottom();

    try {
      await widget.apiClient.sendChatMessage(
        channelId: _channelId!,
        text: trimmed,
        senderName: parentName,
        senderId: mySenderId,
      );
      await _fetchMessages();
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

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScrollController.hasClients) {
        _chatScrollController.animateTo(
          _chatScrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _handleAbsentTomorrow() {
    final students = widget.allStudents != null && widget.allStudents!.isNotEmpty
        ? widget.allStudents!
        : (widget.commute != null ? [widget.commute!] : <ParentStudentCommute>[]);

    if (students.isEmpty) {
      _sendChatMessage('Absent Tomorrow');
      return;
    }

    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final tomorrowStr = '${tomorrow.year.toString().padLeft(4, '0')}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}';

    if (students.length == 1) {
      _confirmAndProcessAbsence(students.first, date: tomorrowStr, shiftType: 'ALL', dateLabel: 'tomorrow');
    } else {
      _showStudentSelectionDialog(students, onSelected: (stu) {
        _confirmAndProcessAbsence(stu, date: tomorrowStr, shiftType: 'ALL', dateLabel: 'tomorrow');
      }, titleText: 'Report Absence for Tomorrow');
    }
  }

  void _handleAbsentToday() {
    final students = widget.allStudents != null && widget.allStudents!.isNotEmpty
        ? widget.allStudents!
        : (widget.commute != null ? [widget.commute!] : <ParentStudentCommute>[]);

    if (students.isEmpty) {
      _sendChatMessage('Absent Today');
      return;
    }

    final now = DateTime.now();
    final todayStr = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

    if (students.length == 1) {
      _confirmAndProcessAbsence(students.first, date: todayStr, shiftType: 'ALL', dateLabel: 'today');
    } else {
      _showStudentSelectionDialog(students, onSelected: (stu) {
        _confirmAndProcessAbsence(stu, date: todayStr, shiftType: 'ALL', dateLabel: 'today');
      }, titleText: 'Report Absence for Today');
    }
  }

  void _confirmAndProcessAbsence(
    ParentStudentCommute student, {
    required String date,
    String shiftType = 'ALL',
    required String dateLabel,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 24),
            SizedBox(width: 8),
            Text('Confirm Absence', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'Are you sure you want to report ${student.studentName} as absent for $dateLabel ($date)?\n\nThis will notify the bus driver and dispatcher not to pick up your child.',
          style: const TextStyle(fontSize: 14, height: 1.4, color: AppColors.textPrimary),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          OutlinedButton(
            onPressed: () => Navigator.pop(ctx),
            style: OutlinedButton.styleFrom(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _processStudentAbsence(student, date: date, shiftType: shiftType, dateLabel: dateLabel);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _handleCustomAbsence() {
    final students = widget.allStudents != null && widget.allStudents!.isNotEmpty
        ? widget.allStudents!
        : (widget.commute != null ? [widget.commute!] : <ParentStudentCommute>[]);

    if (students.isEmpty) {
      _sendChatMessage('Absent');
      return;
    }

    _showCustomAbsenceSheet(students);
  }

  void _showStudentSelectionDialog(
    List<ParentStudentCommute> students, {
    required Function(ParentStudentCommute selected) onSelected,
    String titleText = 'Report Student Absence',
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.event_busy_rounded, color: AppColors.error, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      titleText,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Select which student will not be riding the school bus:',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                ...students.map((stu) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                      leading: CircleAvatar(
                        backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                        child: Text(
                          stu.studentName.isNotEmpty ? stu.studentName[0] : 'S',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ),
                      title: Text(
                        stu.studentName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      subtitle: Text(
                        '${stu.schoolName} • Grade ${stu.grade}\nRoute ${stu.routeNo} (Bus #${stu.busUnitNumber})',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
                      onTap: () {
                        Navigator.pop(ctx);
                        onSelected(stu);
                      },
                    ),
                  );
                }),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showCustomAbsenceSheet(List<ParentStudentCommute> students) {
    ParentStudentCommute selectedStudent = widget.commute ?? students.first;
    DateTime selectedDate = DateTime.now();
    String selectedShift = 'ALL';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final now = DateTime.now();
            final today = DateTime(now.year, now.month, now.day);
            final tomorrow = today.add(const Duration(days: 1));
            final isToday = selectedDate.year == today.year && selectedDate.month == today.month && selectedDate.day == today.day;
            final isTomorrow = selectedDate.year == tomorrow.year && selectedDate.month == tomorrow.month && selectedDate.day == tomorrow.day;
            final isCustom = !isToday && !isTomorrow;

            final dateStr = '${selectedDate.year.toString().padLeft(4, '0')}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}';

            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Row(
                      children: [
                        Icon(Icons.calendar_month_rounded, color: AppColors.primary, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Schedule Absence',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Specify the date and transit shift scope (Morning AM, Afternoon PM, or Both):',
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 16),

                    if (students.length > 1) ...[
                      const Text(
                        'Student',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.border),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<ParentStudentCommute>(
                            value: selectedStudent,
                            isExpanded: true,
                            items: students.map((s) {
                              return DropdownMenuItem(
                                value: s,
                                child: Text('${s.studentName} (Route ${s.routeNo})', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              );
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) setModalState(() => selectedStudent = val);
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    const Text(
                      'Date of Absence',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Today', style: TextStyle(fontSize: 12))),
                            selected: isToday,
                            onSelected: (val) {
                              if (val) setModalState(() => selectedDate = today);
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Tomorrow', style: TextStyle(fontSize: 12))),
                            selected: isTomorrow,
                            onSelected: (val) {
                              if (val) setModalState(() => selectedDate = tomorrow);
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ChoiceChip(
                            label: Center(
                              child: Text(
                                isCustom ? '${selectedDate.month}/${selectedDate.day}' : 'Other Date',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                            selected: isCustom,
                            onSelected: (val) async {
                              final picked = await showDatePicker(
                                context: context,
                                initialDate: selectedDate,
                                firstDate: today,
                                lastDate: today.add(const Duration(days: 90)),
                              );
                              if (picked != null) {
                                setModalState(() => selectedDate = picked);
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    const Text(
                      'Shift Scope',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Both (All Day)', style: TextStyle(fontSize: 12))),
                            selected: selectedShift == 'ALL',
                            onSelected: (val) {
                              if (val) setModalState(() => selectedShift = 'ALL');
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Morning AM', style: TextStyle(fontSize: 12))),
                            selected: selectedShift == 'AM',
                            onSelected: (val) {
                              if (val) setModalState(() => selectedShift = 'AM');
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Afternoon PM', style: TextStyle(fontSize: 12))),
                            selected: selectedShift == 'PM',
                            onSelected: (val) {
                              if (val) setModalState(() => selectedShift = 'PM');
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                        label: const Text('Confirm Absence', style: TextStyle(fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          final dateLabel = isToday ? 'today' : (isTomorrow ? 'tomorrow' : dateStr);
                          _processStudentAbsence(
                            selectedStudent,
                            date: dateStr,
                            shiftType: selectedShift,
                            dateLabel: dateLabel,
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _processStudentAbsence(
    ParentStudentCommute student, {
    required String date,
    String shiftType = 'ALL',
    String? dateLabel,
  }) async {
    if (_isSending) return;

    final clean = widget.parentContact.replaceAll(RegExp(r'[^0-9]'), '');
    final mySenderId = clean.isNotEmpty ? 'parent-$clean' : 'parent';
    final parentName = 'Parent (${widget.parentContact})';

    final shiftDesc = shiftType == 'AM'
        ? 'morning run (AM)'
        : shiftType == 'PM'
            ? 'afternoon run (PM)'
            : 'both runs';
    final label = dateLabel ?? date;

    // 1. Send parent communication message in chat (No mention of sick)
    final parentMsg = '${student.studentName} will be absent $label ($shiftDesc). No bus transit needed.';
    _textController.clear();

    setState(() {
      _isSending = true;
      _messages.add(
        _ChatMessage(
          id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
          text: parentMsg,
          senderName: parentName,
          isFromDispatcher: false,
          time: DateTime.now(),
        ),
      );
    });
    _scrollToBottom();

    // Ensure chat channel exists
    if (_channelId == null) {
      await _initChannel();
    }

    if (_channelId != null) {
      try {
        await widget.apiClient.sendChatMessage(
          channelId: _channelId!,
          text: parentMsg,
          senderName: parentName,
          senderId: mySenderId,
        );
      } catch (e) {
        debugPrint('Error delivering parent chat message: $e');
      }
    }

    // 2. Automatically record absence and update dispatch shifts if generated
    try {
      final res = await widget.apiClient.recordStudentAbsence(
        date: date,
        studentId: student.studentId,
        studentName: student.studentName,
        schoolName: student.schoolName,
        routeNo: student.routeNo,
        shiftType: shiftType,
        reason: 'Absent - Reported by Parent',
        reportedBy: parentName,
      );

      final count = res['count'] as int? ?? (res['affectedShifts'] as List?)?.length ?? 0;
      final shiftNote = count > 0
          ? "Marked absent in today's active dispatch run ($count shift${count > 1 ? 's' : ''})."
          : "Logged in student absences repository ($shiftType).";

      // 3. Send automated operation record as a chat message to the dispatcher
      final sysActionMsg = '[AUTOMATED ACTION] Student absence recorded for ${student.studentName} (ID: ${student.studentId}, Route: ${student.routeNo}, Date: $date, Shift: $shiftType). $shiftNote Source: Parent (${widget.parentContact}).';

      if (_channelId != null) {
        await widget.apiClient.sendChatMessage(
          channelId: _channelId!,
          text: sysActionMsg,
          senderName: 'System Automation',
          senderId: 'system-automation',
        );
      }

      await _fetchMessages();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Absence recorded for ${student.studentName} ($label). Dispatch notified.'),
                ),
              ],
            ),
            backgroundColor: AppColors.success,
            duration: const Duration(seconds: 4),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      debugPrint('Automated absence recording error: $e');
      // 4. If operation failed, alert parent to contact dispatch directly
      if (mounted) {
        _showFailureDialog(student.studentName, e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }

  void _showFailureDialog(String studentName, String errorDetail) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 22),
              SizedBox(width: 8),
              Text('Action Required', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Text(
            'Unable to automatically record absence for $studentName in the dispatch schedule.\n\nPlease contact operations dispatch directly by phone or message.',
            style: const TextStyle(fontSize: 13, height: 1.4),
          ),
          actions: [
            TextButton.icon(
              icon: const Icon(Icons.phone_rounded, size: 16),
              label: const Text('Call Dispatch'),
              onPressed: () {
                Navigator.pop(ctx);
                _makePhoneCall();
              },
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
              child: const Text('Chat with Dispatch'),
              onPressed: () {
                Navigator.pop(ctx);
                _textController.text = '$studentName will be absent. Please mark in dispatch schedule.';
              },
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final studentName = widget.commute?.studentName ?? 'Student';
    final busNo = widget.commute?.busUnitNumber.isNotEmpty == true ? widget.commute!.busUnitNumber : '42';

    return Material(
      color: Colors.white,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.78,
          child: Column(
            children: [
              // 1. Grab Bar & Header
              Padding(
                padding: const EdgeInsets.only(top: 10, left: 20, right: 12, bottom: 6),
                child: Column(
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.12),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.support_agent_rounded, color: AppColors.primary, size: 22),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Dispatch Operations Desk',
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                ),
                                Row(
                                  children: [
                                    Container(
                                      width: 7,
                                      height: 7,
                                      decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle),
                                    ),
                                    const SizedBox(width: 5),
                                    Text(
                                      'Online Support • $studentName (Bus #$busNo)',
                                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // 2. Tab Bar: Live Chat vs Call/SMS (Clean tabs to prevent overflow)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicator: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                  ),
                  labelColor: AppColors.primary,
                  unselectedLabelColor: AppColors.textSecondary,
                  labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  dividerColor: Colors.transparent,
                  tabs: const [
                    Tab(
                      icon: Icon(Icons.chat_bubble_outline_rounded, size: 18),
                      text: 'Live Chat',
                    ),
                    Tab(
                      icon: Icon(Icons.phone_in_talk_rounded, size: 18),
                      text: 'Call / SMS',
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 8),

              // 3. Tab Views
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // Tab 1: Live Chat with Dispatcher
                    _buildChatTab(),

                    // Tab 2: Direct Phone & SMS Channels
                    _buildPhoneSmsTab(studentName, busNo),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChatTab() {
    if (_isLoadingChannel) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.primary),
            ),
            SizedBox(height: 12),
            Text(
              'Connecting to Fleet Dispatch Desk...',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }

    if (_channelId == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 36),
            const SizedBox(height: 8),
            const Text(
              'Unable to connect to live dispatch chat.',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _initChannel,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry Connection'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Quick Issue Action Chips with Mouse Drag and Scroll Buttons
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left_rounded, size: 22, color: AppColors.textSecondary),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 26, minHeight: 34),
                tooltip: 'Scroll left',
                onPressed: () => _scrollChips(-160),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: _chipScrollController,
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Row(
                    children: [
                      _buildQuickChip('Absent Tomorrow', Icons.event_busy_rounded),
                      _buildQuickChip('Absent Today', Icons.cancel_outlined),
                      _buildQuickChip('Custom Absence', Icons.calendar_today_rounded),
                      _buildQuickChip('Is bus delayed?', Icons.schedule_rounded),
                      _buildQuickChip('Lost item on bus', Icons.backpack_outlined),
                      _buildQuickChip('ETA & Location', Icons.directions_bus_rounded),
                    ],
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right_rounded, size: 22, color: AppColors.textSecondary),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 26, minHeight: 34),
                tooltip: 'Scroll right',
                onPressed: () => _scrollChips(160),
              ),
            ],
          ),
        ),

        const Divider(height: 1, color: AppColors.border),

        // Chat Message History
        Expanded(
          child: _messages.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.mark_chat_unread_outlined, size: 40, color: AppColors.textMuted),
                        SizedBox(height: 10),
                        Text(
                          'No messages yet',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Send a message or select a topic above to chat with operations dispatch.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  controller: _chatScrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  itemCount: _messages.length,
                  itemBuilder: (context, index) {
                    final msg = _messages[index];
                    return _buildMessageBubble(msg);
                  },
                ),
        ),

        // Delivery / Sending Indicator
        if (_isSending)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Row(
              children: [
                SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
                SizedBox(width: 8),
                Text('Sending message to dispatch...', style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textMuted)),
              ],
            ),
          ),

        // Input Field Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.border)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: TextField(
                    controller: _textController,
                    style: const TextStyle(fontSize: 13),
                    decoration: const InputDecoration(
                      hintText: 'Type inquiry (e.g. "Student waiting at stop")...',
                      hintStyle: TextStyle(fontSize: 12, color: AppColors.textMuted),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 10),
                    ),
                    onSubmitted: (val) => _sendChatMessage(val),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
                icon: _isSending
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.send_rounded, size: 18),
                onPressed: _isSending ? null : () => _sendChatMessage(_textController.text),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildQuickChip(String label, IconData icon) {
    final isAbsentAction = label == 'Absent Tomorrow' || label == 'Absent Today' || label == 'Custom Absence';
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        avatar: Icon(icon, size: 14, color: isAbsentAction ? AppColors.error : AppColors.primary),
        label: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
        backgroundColor: Colors.white,
        side: BorderSide(color: isAbsentAction ? AppColors.error.withValues(alpha: 0.35) : AppColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        onPressed: _isSending
            ? null
            : () {
                if (label == 'Absent Tomorrow') {
                  _handleAbsentTomorrow();
                } else if (label == 'Absent Today') {
                  _handleAbsentToday();
                } else if (label == 'Custom Absence') {
                  _handleCustomAbsence();
                } else {
                  _sendChatMessage(label);
                }
              },
      ),
    );
  }

  Widget _buildMessageBubble(_ChatMessage msg) {
    final isSystem = msg.senderName == 'System Automation' || msg.text.startsWith('[AUTOMATED ACTION]');
    if (isSystem) {
      return Center(
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 6),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.88),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4), // Emerald tint
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.smart_toy_outlined, size: 14, color: Color(0xFF15803D)),
                  SizedBox(width: 6),
                  Text(
                    'System Action Log',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF15803D),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                msg.text,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFF166534),
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 2),
              Align(
                alignment: Alignment.bottomRight,
                child: Text(
                  '${msg.time.hour.toString().padLeft(2, '0')}:${msg.time.minute.toString().padLeft(2, '0')}',
                  style: const TextStyle(fontSize: 9, color: Color(0xFF15803D)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final isDispatcher = msg.isFromDispatcher;
    return Align(
      alignment: isDispatcher ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        decoration: BoxDecoration(
          color: isDispatcher ? AppColors.surfaceMuted : AppColors.primary,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isDispatcher ? 4 : 16),
            bottomRight: Radius.circular(isDispatcher ? 16 : 4),
          ),
          border: isDispatcher ? Border.all(color: AppColors.border) : null,
        ),
        child: Column(
          crossAxisAlignment: isDispatcher ? CrossAxisAlignment.start : CrossAxisAlignment.end,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isDispatcher ? Icons.headset_mic_rounded : Icons.person_outline_rounded,
                    size: 12,
                    color: isDispatcher ? AppColors.primary : Colors.white70,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    msg.senderName,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: isDispatcher ? AppColors.primaryDark : Colors.white70,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${msg.time.hour.toString().padLeft(2, '0')}:${msg.time.minute.toString().padLeft(2, '0')}',
                    style: TextStyle(
                      fontSize: 9,
                      color: isDispatcher ? AppColors.textMuted : Colors.white60,
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
                color: isDispatcher ? AppColors.textPrimary : Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhoneSmsTab(String studentName, String busNo) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      children: [
        // 1. Phone Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
            boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.phone_in_talk_rounded, color: AppColors.success, size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Dispatch Hotline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Text('Direct operator line for urgent inquiries (06:00 - 18:30)', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    dispatchDisplayPhone,
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: 0.5),
                  ),
                  ElevatedButton.icon(
                    onPressed: _makePhoneCall,
                    icon: const Icon(Icons.call_rounded, size: 16),
                    label: const Text('Call Now'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 2. Twilio SMS Hotline Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
            boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.sms_rounded, color: AppColors.primary, size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Twilio 2-Way SMS Hotline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Text('Instant automatic SMS replies for ETA & bus telemetry', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    dispatchDisplaySms,
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: 0.5),
                  ),
                  ElevatedButton.icon(
                    onPressed: () => _sendSms(),
                    icon: const Icon(Icons.send_rounded, size: 16),
                    label: const Text('Send SMS'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.touch_app_rounded, size: 14),
                    label: const Text('Text "ETA"', style: TextStyle(fontSize: 11)),
                    onPressed: () => _sendSms(customBody: 'ETA'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.touch_app_rounded, size: 14),
                    label: const Text('Text "WHERE"', style: TextStyle(fontSize: 11)),
                    onPressed: () => _sendSms(customBody: 'WHERE'),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.copy_rounded, size: 14),
                    label: const Text('Copy SMS Number', style: TextStyle(fontSize: 11)),
                    onPressed: () => _copyToClipboard(dispatchSmsNumber, 'SMS hotline copied: $dispatchDisplaySms'),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Helpful Tips Card
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Row(
            children: [
              Icon(Icons.info_outline_rounded, size: 18, color: AppColors.textSecondary),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'The dispatch system is connected to our automated Twilio service. Texting ETA or WHERE will return instant, real-time arrival estimates.',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.3),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
