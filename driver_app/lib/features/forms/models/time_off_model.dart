import 'package:equatable/equatable.dart';

/// Reason for employee time-off or leave request.
enum TimeOffLeaveType {
  vacation('vacation', 'Vacation'),
  sickLeave('sick_leave', 'Sick Leave'),
  personalDays('personal_days', 'Personal Days'),
  juryDuty('jury_duty', 'Jury Duty'),
  bereavementLeave('bereavement_leave', 'Bereavement Leave'),
  aboriginalPractices('aboriginal_practices', 'Traditional Practices'),
  other('other', 'Other');

  final String code;
  final String label;

  const TimeOffLeaveType(this.code, this.label);

  static TimeOffLeaveType fromCode(String? code) {
    if (code == null) return TimeOffLeaveType.vacation;
    for (final type in TimeOffLeaveType.values) {
      if (type.code == code) return type;
    }
    return TimeOffLeaveType.other;
  }
}

/// Lifecycle status for time-off request.
enum TimeOffStatus {
  pending('pending', 'Pending Review'),
  approved('approved', 'Approved'),
  rejected('rejected', 'Rejected'),
  cancelled('cancelled', 'Cancelled');

  final String code;
  final String label;

  const TimeOffStatus(this.code, this.label);

  static TimeOffStatus fromCode(String? code) {
    if (code == null) return TimeOffStatus.pending;
    for (final status in TimeOffStatus.values) {
      if (status.code == code) return status;
    }
    return TimeOffStatus.pending;
  }
}

/// Shift coverage scope for time-off request.
enum TimeOffShiftType {
  all('ALL', 'All Shifts (Full Day)'),
  am('AM', 'Morning (AM) Only'),
  pm('PM', 'Afternoon (PM) Only'),
  midday('Midday', 'Midday / Noon Only');

  final String code;
  final String label;

  const TimeOffShiftType(this.code, this.label);

  static TimeOffShiftType fromCode(String? code) {
    if (code == null) return TimeOffShiftType.all;
    final upper = code.toUpperCase();
    for (final st in TimeOffShiftType.values) {
      if (st.code.toUpperCase() == upper) return st;
    }
    return TimeOffShiftType.all;
  }
}

/// Model representing an employee leave / time-off request.
class TimeOffRequestModel extends Equatable {
  final String id;
  final String employeeId;
  final String employeeNumber;
  final String employeeName;
  final TimeOffLeaveType leaveType;
  final String startDate; // YYYY-MM-DD
  final String endDate; // YYYY-MM-DD
  final TimeOffShiftType shiftType;
  final String comments;
  final TimeOffStatus status;
  final String requestedByUserId;
  final String requestedByName;
  final String? approvedByUserId;
  final String? approvedByName;
  final String? approvedAt;
  final String? approvalNotes;
  final String createdAt;
  final String updatedAt;

  const TimeOffRequestModel({
    required this.id,
    required this.employeeId,
    this.employeeNumber = '',
    required this.employeeName,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    this.shiftType = TimeOffShiftType.all,
    this.comments = '',
    this.status = TimeOffStatus.pending,
    this.requestedByUserId = '',
    this.requestedByName = '',
    this.approvedByUserId,
    this.approvedByName,
    this.approvedAt,
    this.approvalNotes,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Calculates total day duration between startDate and endDate inclusive.
  int get durationDays {
    try {
      final start = DateTime.parse(startDate);
      final end = DateTime.parse(endDate);
      final diff = end.difference(start).inDays + 1;
      return diff > 0 ? diff : 1;
    } catch (_) {
      return 1;
    }
  }

  bool get isPending => status == TimeOffStatus.pending;
  bool get isApproved => status == TimeOffStatus.approved;
  bool get isRejected => status == TimeOffStatus.rejected;
  bool get isCancelled => status == TimeOffStatus.cancelled;

  /// Returns true if the request was created on the current calendar day (local time).
  bool get isCreatedToday {
    try {
      final created = DateTime.parse(createdAt).toLocal();
      final now = DateTime.now();
      return created.year == now.year &&
             created.month == now.month &&
             created.day == now.day;
    } catch (_) {
      return false;
    }
  }

  /// A driver can cancel a request only if it is still pending AND created today.
  /// Once approved or rejected (or after the creation day), cancellation is locked.
  bool get canCancelByDriver => isPending && isCreatedToday;

  TimeOffRequestModel copyWith({
    String? id,
    String? employeeId,
    String? employeeNumber,
    String? employeeName,
    TimeOffLeaveType? leaveType,
    String? startDate,
    String? endDate,
    TimeOffShiftType? shiftType,
    String? comments,
    TimeOffStatus? status,
    String? requestedByUserId,
    String? requestedByName,
    String? approvedByUserId,
    String? approvedByName,
    String? approvedAt,
    String? approvalNotes,
    String? createdAt,
    String? updatedAt,
  }) {
    return TimeOffRequestModel(
      id: id ?? this.id,
      employeeId: employeeId ?? this.employeeId,
      employeeNumber: employeeNumber ?? this.employeeNumber,
      employeeName: employeeName ?? this.employeeName,
      leaveType: leaveType ?? this.leaveType,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      shiftType: shiftType ?? this.shiftType,
      comments: comments ?? this.comments,
      status: status ?? this.status,
      requestedByUserId: requestedByUserId ?? this.requestedByUserId,
      requestedByName: requestedByName ?? this.requestedByName,
      approvedByUserId: approvedByUserId ?? this.approvedByUserId,
      approvedByName: approvedByName ?? this.approvedByName,
      approvedAt: approvedAt ?? this.approvedAt,
      approvalNotes: approvalNotes ?? this.approvalNotes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'employeeId': employeeId,
      'employeeNumber': employeeNumber,
      'employeeName': employeeName,
      'leaveType': leaveType.code,
      'startDate': startDate,
      'endDate': endDate,
      'shiftType': shiftType.code,
      'comments': comments,
      'status': status.code,
      'requestedByUserId': requestedByUserId,
      'requestedByName': requestedByName,
      'approvedByUserId': approvedByUserId,
      'approvedByName': approvedByName,
      'approvedAt': approvedAt,
      'approvalNotes': approvalNotes,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  factory TimeOffRequestModel.fromMap(Map<String, dynamic> map, [String? docId]) {
    String parseDate(dynamic val) {
      if (val == null) return '';
      if (val is String) return val;
      if (val is DateTime) return val.toIso8601String();
      if (val is Map && val['seconds'] != null) {
        return DateTime.fromMillisecondsSinceEpoch((val['seconds'] as num).toInt() * 1000).toIso8601String();
      }
      return val.toString();
    }

    final id = docId ?? (map['id']?.toString() ?? '');
    final empId = map['employeeId']?.toString() ?? '';
    final empNumber = map['employeeNumber']?.toString() ?? '';
    final empName = map['employeeName']?.toString() ?? '';

    return TimeOffRequestModel(
      id: id,
      employeeId: empId,
      employeeNumber: empNumber,
      employeeName: empName,
      leaveType: TimeOffLeaveType.fromCode(map['leaveType']?.toString()),
      startDate: map['startDate']?.toString() ?? '',
      endDate: map['endDate']?.toString() ?? '',
      shiftType: TimeOffShiftType.fromCode(map['shiftType']?.toString()),
      comments: map['comments']?.toString() ?? '',
      status: TimeOffStatus.fromCode(map['status']?.toString()),
      requestedByUserId: map['requestedByUserId']?.toString() ?? '',
      requestedByName: map['requestedByName']?.toString() ?? '',
      approvedByUserId: map['approvedByUserId']?.toString(),
      approvedByName: map['approvedByName']?.toString(),
      approvedAt: map['approvedAt'] != null ? parseDate(map['approvedAt']) : null,
      approvalNotes: map['approvalNotes']?.toString(),
      createdAt: parseDate(map['createdAt']).isNotEmpty ? parseDate(map['createdAt']) : DateTime.now().toIso8601String(),
      updatedAt: parseDate(map['updatedAt']).isNotEmpty ? parseDate(map['updatedAt']) : DateTime.now().toIso8601String(),
    );
  }

  @override
  List<Object?> get props => [
        id,
        employeeId,
        employeeNumber,
        employeeName,
        leaveType,
        startDate,
        endDate,
        shiftType,
        comments,
        status,
        requestedByUserId,
        requestedByName,
        approvedByUserId,
        approvedByName,
        approvedAt,
        approvalNotes,
        createdAt,
        updatedAt,
      ];
}
