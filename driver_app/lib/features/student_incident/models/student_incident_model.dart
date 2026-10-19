import 'dart:convert';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

// ─────────────────────────── Enums & Helpers ─────────────────────────────────

enum StudentIncidentStatus {
  submitted,
  underInvestigation,
  parentContacted,
  schoolNotified,
  closed;

  String get apiValue {
    switch (this) {
      case StudentIncidentStatus.submitted:
        return 'submitted';
      case StudentIncidentStatus.underInvestigation:
        return 'under_investigation';
      case StudentIncidentStatus.parentContacted:
        return 'parent_contacted';
      case StudentIncidentStatus.schoolNotified:
        return 'school_notified';
      case StudentIncidentStatus.closed:
        return 'closed';
    }
  }

  static StudentIncidentStatus fromApiValue(dynamic v) {
    final str = (v ?? '').toString().toLowerCase().trim();
    if (str == 'under_investigation' || str == 'investigating') {
      return StudentIncidentStatus.underInvestigation;
    }
    if (str == 'parent_contacted' || str == 'parent_notified') {
      return StudentIncidentStatus.parentContacted;
    }
    if (str == 'school_notified') {
      return StudentIncidentStatus.schoolNotified;
    }
    if (str == 'closed' || str == 'resolved') {
      return StudentIncidentStatus.closed;
    }
    return StudentIncidentStatus.submitted;
  }

  String get label {
    switch (this) {
      case StudentIncidentStatus.submitted:
        return 'Submitted';
      case StudentIncidentStatus.underInvestigation:
        return 'Under Investigation';
      case StudentIncidentStatus.parentContacted:
        return 'Parent Contacted';
      case StudentIncidentStatus.schoolNotified:
        return 'School Notified';
      case StudentIncidentStatus.closed:
        return 'Closed';
    }
  }

  Color get color {
    switch (this) {
      case StudentIncidentStatus.submitted:
        return const Color(0xFFD97706); // Amber
      case StudentIncidentStatus.underInvestigation:
        return const Color(0xFF2563EB); // Blue
      case StudentIncidentStatus.parentContacted:
        return const Color(0xFF4F46E5); // Indigo
      case StudentIncidentStatus.schoolNotified:
        return const Color(0xFF9333EA); // Purple
      case StudentIncidentStatus.closed:
        return const Color(0xFF059669); // Emerald
    }
  }
}

// ─────────────────────────── Constant Maps ────────────────────────────────────

class IncidentCategoryConstants {
  static const Map<String, String> categoryLabels = {
    'physical_altercation': 'Physical Altercation',
    'verbal_conflict': 'Verbal Conflict',
    'academic_misconduct': 'Academic Misconduct',
    'bullying_or_harassment': 'Bullying / Harassment',
    'vandalism': 'Vandalism / Property Damage',
    'safety_violation': 'Safety Violation',
    'other': 'Other',
  };

  static const Map<String, String> disciplinaryLabels = {
    'verbal_warning': 'Verbal Warning',
    'parent_conference': 'Parent Conference',
    'detention': 'Detention',
    'suspension': 'Suspension',
    'counseling_referral': 'Counseling Referral',
    'other': 'Other Action',
  };
}

// ─────────────────────────── Roster Option ───────────────────────────────────

class RosterStudentOption extends Equatable {
  final String key;
  final int studentId;
  final String studentNo;
  final String studentName;
  final String grade;
  final String schoolName;
  final String routeNo;
  final String? routeName;
  final int? routeId;
  final String? shiftType;

  const RosterStudentOption({
    required this.key,
    required this.studentId,
    required this.studentNo,
    required this.studentName,
    required this.grade,
    required this.schoolName,
    required this.routeNo,
    this.routeName,
    this.routeId,
    this.shiftType,
  });

  String get displaySubtitle {
    final buffer = StringBuffer();
    if (grade.isNotEmpty) buffer.write('Gr $grade');
    if (schoolName.isNotEmpty) {
      if (buffer.isNotEmpty) buffer.write(' · ');
      buffer.write(schoolName);
    }
    if (routeNo.isNotEmpty) {
      if (buffer.isNotEmpty) buffer.write(' · ');
      buffer.write('Rte $routeNo');
    }
    return buffer.toString();
  }

  @override
  List<Object?> get props => [key, studentId, studentNo, studentName, grade, schoolName, routeNo, routeName, routeId, shiftType];
}

// ─────────────────────────── Office Follow-Up ─────────────────────────────────

class IncidentOfficeFollowUp extends Equatable {
  final String? reviewedDate;
  final String? administratorName;
  final List<String> disciplinaryActions;
  final String? disciplinaryOther;
  final String? officeNotes;
  final bool isOfficeLocked;
  final DateTime? reviewedAt;

  const IncidentOfficeFollowUp({
    this.reviewedDate,
    this.administratorName,
    this.disciplinaryActions = const [],
    this.disciplinaryOther,
    this.officeNotes,
    this.isOfficeLocked = false,
    this.reviewedAt,
  });

  IncidentOfficeFollowUp copyWith({
    String? reviewedDate,
    String? administratorName,
    List<String>? disciplinaryActions,
    String? disciplinaryOther,
    String? officeNotes,
    bool? isOfficeLocked,
    DateTime? reviewedAt,
  }) {
    return IncidentOfficeFollowUp(
      reviewedDate: reviewedDate ?? this.reviewedDate,
      administratorName: administratorName ?? this.administratorName,
      disciplinaryActions: disciplinaryActions ?? this.disciplinaryActions,
      disciplinaryOther: disciplinaryOther ?? this.disciplinaryOther,
      officeNotes: officeNotes ?? this.officeNotes,
      isOfficeLocked: isOfficeLocked ?? this.isOfficeLocked,
      reviewedAt: reviewedAt ?? this.reviewedAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'reviewedDate': reviewedDate,
      'administratorName': administratorName,
      'disciplinaryActions': disciplinaryActions,
      'disciplinaryOther': disciplinaryOther,
      'officeNotes': officeNotes,
      'isOfficeLocked': isOfficeLocked,
      'reviewedAt': reviewedAt?.toIso8601String(),
    };
  }

  factory IncidentOfficeFollowUp.fromMap(Map<String, dynamic> map) {
    return IncidentOfficeFollowUp(
      reviewedDate: map['reviewedDate']?.toString(),
      administratorName: map['administratorName']?.toString(),
      disciplinaryActions: (map['disciplinaryActions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      disciplinaryOther: map['disciplinaryOther']?.toString(),
      officeNotes: map['officeNotes']?.toString(),
      isOfficeLocked: map['isOfficeLocked'] == true,
      reviewedAt: map['reviewedAt'] != null
          ? DateTime.tryParse(map['reviewedAt'].toString())
          : null,
    );
  }

  @override
  List<Object?> get props => [
        reviewedDate,
        administratorName,
        disciplinaryActions,
        disciplinaryOther,
        officeNotes,
        isOfficeLocked,
        reviewedAt,
      ];
}

// ─────────────────────────── Student Incident Model ──────────────────────────

class StudentIncident extends Equatable {
  final String id;
  final String incidentDate; // YYYY-MM-DD
  final String incidentTime; // HH:mm
  final int studentId;
  final String studentNo;
  final String studentName;
  final String grade;
  final int? schoolId;
  final String schoolName;
  final int? routeId;
  final String routeNo;
  final String routeName;
  final String shiftType;
  final String driverId;
  final String driverName;
  final String location;
  final List<String> incidentTypes;
  final String typeOther;
  final String description;
  final String otherStudentsInvolved;
  final String witnesses;
  final String immediateActionTaken;
  final bool studentRemovedFromBus;
  final bool firstAidRequired;
  final bool parentsNotified;
  final String parentsNotificationDetail;
  final StudentIncidentStatus status;
  final IncidentOfficeFollowUp? officeFollowUp;
  final DateTime createdAt;
  final DateTime updatedAt;

  const StudentIncident({
    required this.id,
    required this.incidentDate,
    required this.incidentTime,
    this.studentId = 0,
    this.studentNo = '',
    required this.studentName,
    this.grade = '',
    this.schoolId,
    this.schoolName = '',
    this.routeId,
    required this.routeNo,
    this.routeName = '',
    this.shiftType = '',
    required this.driverId,
    required this.driverName,
    this.location = '',
    this.incidentTypes = const [],
    this.typeOther = '',
    required this.description,
    this.otherStudentsInvolved = '',
    this.witnesses = '',
    this.immediateActionTaken = '',
    this.studentRemovedFromBus = false,
    this.firstAidRequired = false,
    this.parentsNotified = false,
    this.parentsNotificationDetail = '',
    this.status = StudentIncidentStatus.submitted,
    this.officeFollowUp,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get needsOfficeReview =>
      status != StudentIncidentStatus.closed &&
      (officeFollowUp == null || !officeFollowUp!.isOfficeLocked);

  String get formattedTypesSummary {
    if (incidentTypes.isEmpty) return 'No Category Specified';
    return incidentTypes
        .map((t) => IncidentCategoryConstants.categoryLabels[t] ?? t)
        .join(', ');
  }

  StudentIncident copyWith({
    String? id,
    String? incidentDate,
    String? incidentTime,
    int? studentId,
    String? studentNo,
    String? studentName,
    String? grade,
    int? schoolId,
    String? schoolName,
    int? routeId,
    String? routeNo,
    String? routeName,
    String? shiftType,
    String? driverId,
    String? driverName,
    String? location,
    List<String>? incidentTypes,
    String? typeOther,
    String? description,
    String? otherStudentsInvolved,
    String? witnesses,
    String? immediateActionTaken,
    bool? studentRemovedFromBus,
    bool? firstAidRequired,
    bool? parentsNotified,
    String? parentsNotificationDetail,
    StudentIncidentStatus? status,
    IncidentOfficeFollowUp? officeFollowUp,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return StudentIncident(
      id: id ?? this.id,
      incidentDate: incidentDate ?? this.incidentDate,
      incidentTime: incidentTime ?? this.incidentTime,
      studentId: studentId ?? this.studentId,
      studentNo: studentNo ?? this.studentNo,
      studentName: studentName ?? this.studentName,
      grade: grade ?? this.grade,
      schoolId: schoolId ?? this.schoolId,
      schoolName: schoolName ?? this.schoolName,
      routeId: routeId ?? this.routeId,
      routeNo: routeNo ?? this.routeNo,
      routeName: routeName ?? this.routeName,
      shiftType: shiftType ?? this.shiftType,
      driverId: driverId ?? this.driverId,
      driverName: driverName ?? this.driverName,
      location: location ?? this.location,
      incidentTypes: incidentTypes ?? this.incidentTypes,
      typeOther: typeOther ?? this.typeOther,
      description: description ?? this.description,
      otherStudentsInvolved:
          otherStudentsInvolved ?? this.otherStudentsInvolved,
      witnesses: witnesses ?? this.witnesses,
      immediateActionTaken: immediateActionTaken ?? this.immediateActionTaken,
      studentRemovedFromBus:
          studentRemovedFromBus ?? this.studentRemovedFromBus,
      firstAidRequired: firstAidRequired ?? this.firstAidRequired,
      parentsNotified: parentsNotified ?? this.parentsNotified,
      parentsNotificationDetail:
          parentsNotificationDetail ?? this.parentsNotificationDetail,
      status: status ?? this.status,
      officeFollowUp: officeFollowUp ?? this.officeFollowUp,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'incidentDate': incidentDate,
      'incidentTime': incidentTime,
      'studentId': studentId,
      'studentNo': studentNo,
      'studentName': studentName,
      'grade': grade,
      'schoolId': schoolId,
      'schoolName': schoolName,
      'routeId': routeId,
      'routeNo': routeNo,
      'routeName': routeName,
      'shiftType': shiftType,
      'driverId': driverId,
      'driverName': driverName,
      'location': location,
      'incidentTypes': incidentTypes,
      'typeOther': typeOther,
      'description': description,
      'otherStudentsInvolved': otherStudentsInvolved,
      'witnesses': witnesses,
      'immediateActionTaken': immediateActionTaken,
      'studentRemovedFromBus': studentRemovedFromBus,
      'firstAidRequired': firstAidRequired,
      'parentsNotified': parentsNotified,
      'parentsNotificationDetail': parentsNotificationDetail,
      'status': status.apiValue,
      'officeFollowUp': officeFollowUp?.toMap(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  Map<String, dynamic> toCreatePayload() {
    return {
      'incidentDate': incidentDate,
      'incidentTime': incidentTime,
      'studentId': studentId > 0 ? studentId : null,
      'studentNo': studentNo.isNotEmpty ? studentNo : null,
      'studentName': studentName,
      'grade': grade.isNotEmpty ? grade : null,
      'schoolId': schoolId,
      'schoolName': schoolName,
      'routeId': routeId,
      'routeNo': routeNo,
      'routeName': routeName,
      'shiftType': shiftType,
      'driverId': driverId,
      'driverName': driverName,
      'location': location,
      'incidentTypes': incidentTypes,
      'typeOther': typeOther,
      'description': description,
      'otherStudentsInvolved': otherStudentsInvolved,
      'witnesses': witnesses,
      'immediateActionTaken': immediateActionTaken,
      'studentRemovedFromBus': studentRemovedFromBus,
      'firstAidRequired': firstAidRequired,
      'parentsNotified': parentsNotified,
      'parentsNotificationDetail': parentsNotificationDetail,
    };
  }

  factory StudentIncident.fromMap(Map<String, dynamic> map, {String? docId}) {
    DateTime parseDt(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is DateTime) return val;
      final s = val.toString();
      return DateTime.tryParse(s) ?? DateTime.now();
    }

    return StudentIncident(
      id: docId ?? (map['id']?.toString() ?? ''),
      incidentDate: map['incidentDate']?.toString() ?? '',
      incidentTime: map['incidentTime']?.toString() ?? '',
      studentId: map['studentId'] is int
          ? map['studentId'] as int
          : int.tryParse(map['studentId']?.toString() ?? '') ?? 0,
      studentNo: map['studentNo']?.toString() ?? '',
      studentName: map['studentName']?.toString() ?? '',
      grade: map['grade']?.toString() ?? '',
      schoolId: map['schoolId'] is int
          ? map['schoolId'] as int
          : int.tryParse(map['schoolId']?.toString() ?? ''),
      schoolName: map['schoolName']?.toString() ?? '',
      routeId: map['routeId'] is int
          ? map['routeId'] as int
          : int.tryParse(map['routeId']?.toString() ?? ''),
      routeNo: map['routeNo']?.toString() ?? '',
      routeName: map['routeName']?.toString() ?? '',
      shiftType: map['shiftType']?.toString() ?? '',
      driverId: map['driverId']?.toString() ?? '',
      driverName: map['driverName']?.toString() ?? '',
      location: map['location']?.toString() ?? '',
      incidentTypes: (map['incidentTypes'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      typeOther: map['typeOther']?.toString() ?? '',
      description: map['description']?.toString() ?? '',
      otherStudentsInvolved: map['otherStudentsInvolved']?.toString() ?? '',
      witnesses: map['witnesses']?.toString() ?? '',
      immediateActionTaken: map['immediateActionTaken']?.toString() ?? '',
      studentRemovedFromBus: map['studentRemovedFromBus'] == true,
      firstAidRequired: map['firstAidRequired'] == true,
      parentsNotified: map['parentsNotified'] == true,
      parentsNotificationDetail:
          map['parentsNotificationDetail']?.toString() ?? '',
      status: StudentIncidentStatus.fromApiValue(map['status']),
      officeFollowUp: map['officeFollowUp'] is Map<String, dynamic>
          ? IncidentOfficeFollowUp.fromMap(
              map['officeFollowUp'] as Map<String, dynamic>)
          : null,
      createdAt: parseDt(map['createdAt']),
      updatedAt: parseDt(map['updatedAt']),
    );
  }

  String toJson() => json.encode(toMap());

  factory StudentIncident.fromJson(String source) =>
      StudentIncident.fromMap(json.decode(source) as Map<String, dynamic>);

  @override
  List<Object?> get props => [
        id,
        incidentDate,
        incidentTime,
        studentId,
        studentNo,
        studentName,
        grade,
        schoolId,
        schoolName,
        routeId,
        routeNo,
        routeName,
        shiftType,
        driverId,
        driverName,
        location,
        incidentTypes,
        typeOther,
        description,
        otherStudentsInvolved,
        witnesses,
        immediateActionTaken,
        studentRemovedFromBus,
        firstAidRequired,
        parentsNotified,
        parentsNotificationDetail,
        status,
        officeFollowUp,
        createdAt,
        updatedAt,
      ];
}
