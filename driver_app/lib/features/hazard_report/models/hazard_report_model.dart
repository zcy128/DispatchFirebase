import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

enum HazardReportStatus {
  open,
  investigating,
  resolved;

  int get statusInt {
    switch (this) {
      case HazardReportStatus.open:
        return 0;
      case HazardReportStatus.investigating:
        return 1;
      case HazardReportStatus.resolved:
        return 2;
    }
  }

  String get label {
    switch (this) {
      case HazardReportStatus.open:
        return 'Open / Pending';
      case HazardReportStatus.investigating:
        return 'Under Investigation';
      case HazardReportStatus.resolved:
        return 'Resolved';
    }
  }

  Color get color {
    switch (this) {
      case HazardReportStatus.open:
        return const Color(0xFFD97706);
      case HazardReportStatus.investigating:
        return const Color(0xFF2563EB);
      case HazardReportStatus.resolved:
        return const Color(0xFF059669);
    }
  }

  IconData get icon {
    switch (this) {
      case HazardReportStatus.open:
        return Icons.access_time_rounded;
      case HazardReportStatus.investigating:
        return Icons.build_circle_outlined;
      case HazardReportStatus.resolved:
        return Icons.check_circle_outline_rounded;
    }
  }

  static HazardReportStatus fromStatusInt(dynamic val) {
    final v = int.tryParse('$val') ?? 0;
    if (v == 1) return HazardReportStatus.investigating;
    if (v >= 2) return HazardReportStatus.resolved;
    return HazardReportStatus.open;
  }
}

class HazardReportModel extends Equatable {
  final String id;
  final String reportedBy;
  final String? reportedByEmployeeId;
  final String? personInvolved;
  final String? unitId;
  final String? unitNumber;
  final String? routeId;
  final String? routeName;
  final String? phone;
  final String? supervisor;
  final String? eventTime;
  final String? eventLocation;
  final String? witnesses;
  final String eventDescription;

  // Hazard Types
  final bool trippingHazard;
  final bool trafficHazard;
  final bool equipmentHazard;
  final bool performanceHazard;
  final bool snowHazard;
  final bool spillHazard;
  final bool otherHazard;

  // Close Call / Near Miss Types
  final bool unsafeAction;
  final bool unsafeCondition;
  final bool happenedtoMe;
  final bool happenedtoSomeone;
  final bool ofanarea;
  final bool ofEquipment;

  // Evaluation of Risk Potential (Health & Safety)
  final bool moderate;
  final bool serious;
  final bool minor;
  final bool probableRecurrence;
  final bool occasional;
  final bool rare;
  final String? suggestion;
  final String? actionTaken;
  final String? assignedTo;
  final bool isCompleted;
  final String? officeHazardType;
  final String? employeeIdError;
  final String? employeeNameError;
  final String? safetySignedBy;

  final int statusInt;
  final String statusStr;
  final List<String> attachmentUrls;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const HazardReportModel({
    required this.id,
    required this.reportedBy,
    this.reportedByEmployeeId,
    this.personInvolved,
    this.unitId,
    this.unitNumber,
    this.routeId,
    this.routeName,
    this.phone,
    this.supervisor,
    this.eventTime,
    this.eventLocation,
    this.witnesses,
    required this.eventDescription,
    this.trippingHazard = false,
    this.trafficHazard = false,
    this.equipmentHazard = false,
    this.performanceHazard = false,
    this.snowHazard = false,
    this.spillHazard = false,
    this.otherHazard = false,
    this.unsafeAction = false,
    this.unsafeCondition = false,
    this.happenedtoMe = false,
    this.happenedtoSomeone = false,
    this.ofanarea = false,
    this.ofEquipment = false,
    this.moderate = false,
    this.serious = false,
    this.minor = false,
    this.probableRecurrence = false,
    this.occasional = false,
    this.rare = false,
    this.suggestion,
    this.actionTaken,
    this.assignedTo,
    this.isCompleted = false,
    this.officeHazardType,
    this.employeeIdError,
    this.employeeNameError,
    this.safetySignedBy,
    this.statusInt = 0,
    this.statusStr = 'Open',
    this.attachmentUrls = const [],
    required this.createdAt,
    this.updatedAt,
  });

  HazardReportStatus get status => HazardReportStatus.fromStatusInt(statusInt);

  List<String> get activeHazardLabels {
    final list = <String>[];
    if (trippingHazard) list.add('Tripping');
    if (trafficHazard) list.add('Traffic');
    if (equipmentHazard) list.add('Equipment');
    if (performanceHazard) list.add('Performance');
    if (snowHazard) list.add('Snow / Ice / Road');
    if (spillHazard) list.add('Spill');
    if (otherHazard) list.add('Other Hazard');
    return list;
  }

  List<String> get activeCloseCallLabels {
    final list = <String>[];
    if (unsafeAction) list.add('Unsafe Action');
    if (unsafeCondition) list.add('Unsafe Condition');
    if (happenedtoMe) list.add('Happened to Me');
    if (happenedtoSomeone) list.add('Happened to Someone');
    if (ofanarea) list.add('Area Hazard');
    if (ofEquipment) list.add('Equipment Hazard');
    return list;
  }

  factory HazardReportModel.fromJson(Map<String, dynamic> json, [String? docId]) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      if (val is DateTime) return val;
      return DateTime.tryParse(val.toString()) ?? DateTime.now();
    }

    final id = docId ?? json['id']?.toString() ?? '';
    final sInt = int.tryParse('${json['statusInt']}') ?? (json['isCompleted'] == true ? 2 : 0);

    return HazardReportModel(
      id: id,
      reportedBy: json['reportedBy']?.toString() ?? 'Driver / Crew',
      reportedByEmployeeId: json['reportedByEmployeeId']?.toString(),
      personInvolved: json['personInvolved']?.toString(),
      unitId: json['unitId']?.toString(),
      unitNumber: json['unitNumber']?.toString(),
      routeId: json['routeId']?.toString(),
      routeName: json['routeName']?.toString(),
      phone: json['phone']?.toString(),
      supervisor: json['supervisor']?.toString(),
      eventTime: json['eventTime']?.toString(),
      eventLocation: json['eventLocation']?.toString(),
      witnesses: json['witnesses']?.toString(),
      eventDescription: json['eventDescription']?.toString() ?? '',
      trippingHazard: json['trippingHazard'] == true,
      trafficHazard: json['trafficHazard'] == true,
      equipmentHazard: json['equipmentHazard'] == true,
      performanceHazard: json['performanceHazard'] == true,
      snowHazard: json['snowHazard'] == true,
      spillHazard: json['spillHazard'] == true,
      otherHazard: json['otherHazard'] == true,
      unsafeAction: json['unsafeAction'] == true,
      unsafeCondition: json['unsafeCondition'] == true,
      happenedtoMe: json['happenedtoMe'] == true,
      happenedtoSomeone: json['happenedtoSomeone'] == true,
      ofanarea: json['ofanarea'] == true,
      ofEquipment: json['ofEquipment'] == true,
      moderate: json['moderate'] == true,
      serious: json['serious'] == true,
      minor: json['minor'] == true,
      probableRecurrence: json['probableRecurrence'] == true,
      occasional: json['occasional'] == true,
      rare: json['rare'] == true,
      suggestion: json['suggestion']?.toString(),
      actionTaken: json['actionTaken']?.toString(),
      assignedTo: json['assignedTo']?.toString(),
      isCompleted: json['isCompleted'] == true,
      officeHazardType: json['officeHazardType']?.toString(),
      employeeIdError: json['employeeIdError']?.toString(),
      employeeNameError: json['employeeNameError']?.toString(),
      safetySignedBy: json['safetySignedBy']?.toString(),
      statusInt: sInt,
      statusStr: json['statusStr']?.toString() ?? (sInt == 2 ? 'Resolved' : sInt == 1 ? 'Investigating' : 'Open'),
      attachmentUrls: (json['attachmentUrls'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      createdAt: parseDate(json['createdAt']),
      updatedAt: json['updatedAt'] != null ? parseDate(json['updatedAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'reportedBy': reportedBy,
      if (reportedByEmployeeId != null) 'reportedByEmployeeId': reportedByEmployeeId,
      if (personInvolved != null) 'personInvolved': personInvolved,
      if (unitId != null) 'unitId': unitId,
      if (unitNumber != null) 'unitNumber': unitNumber,
      if (routeId != null) 'routeId': routeId,
      if (routeName != null) 'routeName': routeName,
      if (phone != null) 'phone': phone,
      if (supervisor != null) 'supervisor': supervisor,
      if (eventTime != null) 'eventTime': eventTime,
      if (eventLocation != null) 'eventLocation': eventLocation,
      if (witnesses != null) 'witnesses': witnesses,
      'eventDescription': eventDescription,
      'trippingHazard': trippingHazard,
      'trafficHazard': trafficHazard,
      'equipmentHazard': equipmentHazard,
      'performanceHazard': performanceHazard,
      'snowHazard': snowHazard,
      'spillHazard': spillHazard,
      'otherHazard': otherHazard,
      'unsafeAction': unsafeAction,
      'unsafeCondition': unsafeCondition,
      'happenedtoMe': happenedtoMe,
      'happenedtoSomeone': happenedtoSomeone,
      'ofanarea': ofanarea,
      'ofEquipment': ofEquipment,
      'moderate': moderate,
      'serious': serious,
      'minor': minor,
      'probableRecurrence': probableRecurrence,
      'occasional': occasional,
      'rare': rare,
      if (suggestion != null) 'suggestion': suggestion,
      if (actionTaken != null) 'actionTaken': actionTaken,
      if (assignedTo != null) 'assignedTo': assignedTo,
      'isCompleted': isCompleted,
      if (officeHazardType != null) 'officeHazardType': officeHazardType,
      if (employeeIdError != null) 'employeeIdError': employeeIdError,
      if (employeeNameError != null) 'employeeNameError': employeeNameError,
      if (safetySignedBy != null) 'safetySignedBy': safetySignedBy,
      'statusInt': statusInt,
      'statusStr': statusStr,
      'attachmentUrls': attachmentUrls,
      'createdAt': createdAt.toUtc().toIso8601String(),
      if (updatedAt != null) 'updatedAt': updatedAt!.toUtc().toIso8601String(),
    };
  }

  HazardReportModel copyWith({
    String? id,
    String? reportedBy,
    String? reportedByEmployeeId,
    String? personInvolved,
    String? unitId,
    String? unitNumber,
    String? routeId,
    String? routeName,
    String? phone,
    String? supervisor,
    String? eventTime,
    String? eventLocation,
    String? witnesses,
    String? eventDescription,
    bool? trippingHazard,
    bool? trafficHazard,
    bool? equipmentHazard,
    bool? performanceHazard,
    bool? snowHazard,
    bool? spillHazard,
    bool? otherHazard,
    bool? unsafeAction,
    bool? unsafeCondition,
    bool? happenedtoMe,
    bool? happenedtoSomeone,
    bool? ofanarea,
    bool? ofEquipment,
    bool? moderate,
    bool? serious,
    bool? minor,
    bool? probableRecurrence,
    bool? occasional,
    bool? rare,
    String? suggestion,
    String? actionTaken,
    String? assignedTo,
    bool? isCompleted,
    String? officeHazardType,
    String? employeeIdError,
    String? employeeNameError,
    String? safetySignedBy,
    int? statusInt,
    String? statusStr,
    List<String>? attachmentUrls,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return HazardReportModel(
      id: id ?? this.id,
      reportedBy: reportedBy ?? this.reportedBy,
      reportedByEmployeeId: reportedByEmployeeId ?? this.reportedByEmployeeId,
      personInvolved: personInvolved ?? this.personInvolved,
      unitId: unitId ?? this.unitId,
      unitNumber: unitNumber ?? this.unitNumber,
      routeId: routeId ?? this.routeId,
      routeName: routeName ?? this.routeName,
      phone: phone ?? this.phone,
      supervisor: supervisor ?? this.supervisor,
      eventTime: eventTime ?? this.eventTime,
      eventLocation: eventLocation ?? this.eventLocation,
      witnesses: witnesses ?? this.witnesses,
      eventDescription: eventDescription ?? this.eventDescription,
      trippingHazard: trippingHazard ?? this.trippingHazard,
      trafficHazard: trafficHazard ?? this.trafficHazard,
      equipmentHazard: equipmentHazard ?? this.equipmentHazard,
      performanceHazard: performanceHazard ?? this.performanceHazard,
      snowHazard: snowHazard ?? this.snowHazard,
      spillHazard: spillHazard ?? this.spillHazard,
      otherHazard: otherHazard ?? this.otherHazard,
      unsafeAction: unsafeAction ?? this.unsafeAction,
      unsafeCondition: unsafeCondition ?? this.unsafeCondition,
      happenedtoMe: happenedtoMe ?? this.happenedtoMe,
      happenedtoSomeone: happenedtoSomeone ?? this.happenedtoSomeone,
      ofanarea: ofanarea ?? this.ofanarea,
      ofEquipment: ofEquipment ?? this.ofEquipment,
      moderate: moderate ?? this.moderate,
      serious: serious ?? this.serious,
      minor: minor ?? this.minor,
      probableRecurrence: probableRecurrence ?? this.probableRecurrence,
      occasional: occasional ?? this.occasional,
      rare: rare ?? this.rare,
      suggestion: suggestion ?? this.suggestion,
      actionTaken: actionTaken ?? this.actionTaken,
      assignedTo: assignedTo ?? this.assignedTo,
      isCompleted: isCompleted ?? this.isCompleted,
      officeHazardType: officeHazardType ?? this.officeHazardType,
      employeeIdError: employeeIdError ?? this.employeeIdError,
      employeeNameError: employeeNameError ?? this.employeeNameError,
      safetySignedBy: safetySignedBy ?? this.safetySignedBy,
      statusInt: statusInt ?? this.statusInt,
      statusStr: statusStr ?? this.statusStr,
      attachmentUrls: attachmentUrls ?? this.attachmentUrls,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  List<Object?> get props => [
        id,
        reportedBy,
        reportedByEmployeeId,
        personInvolved,
        unitId,
        unitNumber,
        routeId,
        routeName,
        phone,
        supervisor,
        eventTime,
        eventLocation,
        witnesses,
        eventDescription,
        trippingHazard,
        trafficHazard,
        equipmentHazard,
        performanceHazard,
        snowHazard,
        spillHazard,
        otherHazard,
        unsafeAction,
        unsafeCondition,
        happenedtoMe,
        happenedtoSomeone,
        ofanarea,
        ofEquipment,
        moderate,
        serious,
        minor,
        probableRecurrence,
        occasional,
        rare,
        suggestion,
        actionTaken,
        assignedTo,
        isCompleted,
        officeHazardType,
        employeeIdError,
        employeeNameError,
        safetySignedBy,
        statusInt,
        statusStr,
        attachmentUrls,
        createdAt,
        updatedAt,
      ];
}
