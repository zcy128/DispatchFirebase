import 'package:equatable/equatable.dart';

/// Status representation for Route Assessment.
enum RouteAssessmentStatus {
  working,
  completed,
  submitted;

  int get statusInt {
    switch (this) {
      case RouteAssessmentStatus.working:
        return 0;
      case RouteAssessmentStatus.completed:
        return 2;
      case RouteAssessmentStatus.submitted:
        return 3;
    }
  }

  String get label {
    switch (this) {
      case RouteAssessmentStatus.working:
        return 'Working';
      case RouteAssessmentStatus.completed:
        return 'Completed';
      case RouteAssessmentStatus.submitted:
        return 'Submitted';
    }
  }

  static RouteAssessmentStatus fromStatusInt(dynamic val) {
    if (val == 3 || val == '3' || val == 'Submitted' || val == 'submitted') {
      return RouteAssessmentStatus.submitted;
    }
    if (val == 2 || val == '2' || val == 'Completed' || val == 'completed') {
      return RouteAssessmentStatus.completed;
    }
    return RouteAssessmentStatus.working;
  }
}

/// School bus route safety assessment checklist model.
class RouteAssessmentModel extends Equatable {
  final String id;
  final String assessmentType; // '0' = New Route (Dry Run), '1' = Change in Route
  final String routeId;
  final int? schoolBoardId;
  final String? schoolBoard;
  final int? schoolId;
  final String? school;
  final String schoolYear;
  final DateTime? assessmentDate;
  final String conductedByDriver;
  final String? conductedByOperator;
  final String? conductedByEmployeeId;
  final String? driverEmail;
  final String? driverPhone;
  final String? summary;

  // 11 Core Assessment Safety Checklist Questions
  final bool visibilityProblemCheck;
  final String? visibilityProblem;

  final bool highwayStopConcernCheck;
  final String? highwayStopConcern;

  final bool locationProblemCheck;
  final String? locationProblem;

  final bool unsafeTurnaroundCheck;
  final String? unsafeTurnaround;

  final bool intersectionCheck;
  final String? intersection;

  final bool roadwayCheck;
  final String? roadway;

  final bool nonweatherRiskCheck;
  final String? nonweatherRisk;

  final bool weatherRiskCheck;
  final String? weatherRisk;

  final bool companyPolicyCheck;
  final bool companyPolicyFamiliar;
  final bool routeAdjustCheck;
  final String? routeAdjust;

  final bool safetyConcernCheck;
  final String? safetyConcern;

  // Office Processing Section
  final String? assignedTo;
  final bool isCompleted;
  final bool isSubmitted;

  final int statusInt;
  final String statusStr;

  final List<String> attachmentUrls;
  final DateTime createdAt;
  final DateTime updatedAt;

  const RouteAssessmentModel({
    required this.id,
    this.assessmentType = '0',
    required this.routeId,
    this.schoolBoardId,
    this.schoolBoard,
    this.schoolId,
    this.school,
    this.schoolYear = '2026-2027',
    this.assessmentDate,
    required this.conductedByDriver,
    this.conductedByOperator,
    this.conductedByEmployeeId,
    this.driverEmail,
    this.driverPhone,
    this.summary,
    this.visibilityProblemCheck = false,
    this.visibilityProblem,
    this.highwayStopConcernCheck = false,
    this.highwayStopConcern,
    this.locationProblemCheck = false,
    this.locationProblem,
    this.unsafeTurnaroundCheck = false,
    this.unsafeTurnaround,
    this.intersectionCheck = false,
    this.intersection,
    this.roadwayCheck = false,
    this.roadway,
    this.nonweatherRiskCheck = false,
    this.nonweatherRisk,
    this.weatherRiskCheck = false,
    this.weatherRisk,
    this.companyPolicyCheck = false,
    this.companyPolicyFamiliar = false,
    this.routeAdjustCheck = false,
    this.routeAdjust,
    this.safetyConcernCheck = false,
    this.safetyConcern,
    this.assignedTo,
    this.isCompleted = false,
    this.isSubmitted = false,
    this.statusInt = 0,
    this.statusStr = 'Working',
    this.attachmentUrls = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  RouteAssessmentStatus get status => RouteAssessmentStatus.fromStatusInt(statusInt);

  String get typeLabel => assessmentType == '0' ? 'New Route (Dry Run)' : 'Change in Route';

  int get flaggedConcernsCount {
    int count = 0;
    if (visibilityProblemCheck) count++;
    if (highwayStopConcernCheck) count++;
    if (locationProblemCheck) count++;
    if (unsafeTurnaroundCheck) count++;
    if (intersectionCheck) count++;
    if (roadwayCheck) count++;
    if (nonweatherRiskCheck) count++;
    if (weatherRiskCheck) count++;
    if (safetyConcernCheck) count++;
    return count;
  }

  RouteAssessmentModel copyWith({
    String? id,
    String? assessmentType,
    String? routeId,
    int? schoolBoardId,
    String? schoolBoard,
    int? schoolId,
    String? school,
    String? schoolYear,
    DateTime? assessmentDate,
    String? conductedByDriver,
    String? conductedByOperator,
    String? conductedByEmployeeId,
    String? driverEmail,
    String? driverPhone,
    String? summary,
    bool? visibilityProblemCheck,
    String? visibilityProblem,
    bool? highwayStopConcernCheck,
    String? highwayStopConcern,
    bool? locationProblemCheck,
    String? locationProblem,
    bool? unsafeTurnaroundCheck,
    String? unsafeTurnaround,
    bool? intersectionCheck,
    String? intersection,
    bool? roadwayCheck,
    String? roadway,
    bool? nonweatherRiskCheck,
    String? nonweatherRisk,
    bool? weatherRiskCheck,
    String? weatherRisk,
    bool? companyPolicyCheck,
    bool? companyPolicyFamiliar,
    bool? routeAdjustCheck,
    String? routeAdjust,
    bool? safetyConcernCheck,
    String? safetyConcern,
    String? assignedTo,
    bool? isCompleted,
    bool? isSubmitted,
    int? statusInt,
    String? statusStr,
    List<String>? attachmentUrls,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return RouteAssessmentModel(
      id: id ?? this.id,
      assessmentType: assessmentType ?? this.assessmentType,
      routeId: routeId ?? this.routeId,
      schoolBoardId: schoolBoardId ?? this.schoolBoardId,
      schoolBoard: schoolBoard ?? this.schoolBoard,
      schoolId: schoolId ?? this.schoolId,
      school: school ?? this.school,
      schoolYear: schoolYear ?? this.schoolYear,
      assessmentDate: assessmentDate ?? this.assessmentDate,
      conductedByDriver: conductedByDriver ?? this.conductedByDriver,
      conductedByOperator: conductedByOperator ?? this.conductedByOperator,
      conductedByEmployeeId: conductedByEmployeeId ?? this.conductedByEmployeeId,
      driverEmail: driverEmail ?? this.driverEmail,
      driverPhone: driverPhone ?? this.driverPhone,
      summary: summary ?? this.summary,
      visibilityProblemCheck: visibilityProblemCheck ?? this.visibilityProblemCheck,
      visibilityProblem: visibilityProblem ?? this.visibilityProblem,
      highwayStopConcernCheck: highwayStopConcernCheck ?? this.highwayStopConcernCheck,
      highwayStopConcern: highwayStopConcern ?? this.highwayStopConcern,
      locationProblemCheck: locationProblemCheck ?? this.locationProblemCheck,
      locationProblem: locationProblem ?? this.locationProblem,
      unsafeTurnaroundCheck: unsafeTurnaroundCheck ?? this.unsafeTurnaroundCheck,
      unsafeTurnaround: unsafeTurnaround ?? this.unsafeTurnaround,
      intersectionCheck: intersectionCheck ?? this.intersectionCheck,
      intersection: intersection ?? this.intersection,
      roadwayCheck: roadwayCheck ?? this.roadwayCheck,
      roadway: roadway ?? this.roadway,
      nonweatherRiskCheck: nonweatherRiskCheck ?? this.nonweatherRiskCheck,
      nonweatherRisk: nonweatherRisk ?? this.nonweatherRisk,
      weatherRiskCheck: weatherRiskCheck ?? this.weatherRiskCheck,
      weatherRisk: weatherRisk ?? this.weatherRisk,
      companyPolicyCheck: companyPolicyCheck ?? this.companyPolicyCheck,
      companyPolicyFamiliar: companyPolicyFamiliar ?? this.companyPolicyFamiliar,
      routeAdjustCheck: routeAdjustCheck ?? this.routeAdjustCheck,
      routeAdjust: routeAdjust ?? this.routeAdjust,
      safetyConcernCheck: safetyConcernCheck ?? this.safetyConcernCheck,
      safetyConcern: safetyConcern ?? this.safetyConcern,
      assignedTo: assignedTo ?? this.assignedTo,
      isCompleted: isCompleted ?? this.isCompleted,
      isSubmitted: isSubmitted ?? this.isSubmitted,
      statusInt: statusInt ?? this.statusInt,
      statusStr: statusStr ?? this.statusStr,
      attachmentUrls: attachmentUrls ?? this.attachmentUrls,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'assessmentType': assessmentType,
      'routeId': routeId,
      if (schoolBoardId != null) 'schoolBoardId': schoolBoardId,
      if (schoolBoard != null) 'schoolBoard': schoolBoard,
      if (schoolId != null) 'schoolId': schoolId,
      if (school != null) 'school': school,
      'schoolYear': schoolYear,
      if (assessmentDate != null) 'assessmentDate': assessmentDate!.toUtc().toIso8601String(),
      'conductedByDriver': conductedByDriver,
      if (conductedByOperator != null) 'conductedByOperator': conductedByOperator,
      if (conductedByEmployeeId != null) 'conductedByEmployeeId': conductedByEmployeeId,
      if (driverEmail != null) 'driverEmail': driverEmail,
      if (driverPhone != null) 'driverPhone': driverPhone,
      if (summary != null) 'summary': summary,
      'visibilityProblemCheck': visibilityProblemCheck,
      if (visibilityProblem != null) 'visibilityProblem': visibilityProblem,
      'highwayStopConcernCheck': highwayStopConcernCheck,
      if (highwayStopConcern != null) 'highwayStopConcern': highwayStopConcern,
      'locationProblemCheck': locationProblemCheck,
      if (locationProblem != null) 'locationProblem': locationProblem,
      'unsafeTurnaroundCheck': unsafeTurnaroundCheck,
      if (unsafeTurnaround != null) 'unsafeTurnaround': unsafeTurnaround,
      'intersectionCheck': intersectionCheck,
      if (intersection != null) 'intersection': intersection,
      'roadwayCheck': roadwayCheck,
      if (roadway != null) 'roadway': roadway,
      'nonweatherRiskCheck': nonweatherRiskCheck,
      if (nonweatherRisk != null) 'nonweatherRisk': nonweatherRisk,
      'weatherRiskCheck': weatherRiskCheck,
      if (weatherRisk != null) 'weatherRisk': weatherRisk,
      'companyPolicyCheck': companyPolicyCheck,
      'companyPolicyFamiliar': companyPolicyFamiliar,
      'routeAdjustCheck': routeAdjustCheck,
      if (routeAdjust != null) 'routeAdjust': routeAdjust,
      'safetyConcernCheck': safetyConcernCheck,
      if (safetyConcern != null) 'safetyConcern': safetyConcern,
      if (assignedTo != null) 'assignedTo': assignedTo,
      'isCompleted': isCompleted,
      'isSubmitted': isSubmitted,
      'statusInt': statusInt,
      'statusStr': statusStr,
      'attachmentUrls': attachmentUrls,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'updatedAt': updatedAt.toUtc().toIso8601String(),
    };
  }

  factory RouteAssessmentModel.fromJson(Map<String, dynamic> json, [String? docId]) {
    DateTime parseDate(dynamic val, DateTime fallback) {
      if (val == null) return fallback;
      if (val is DateTime) return val;
      if (val is String && val.isNotEmpty) {
        return DateTime.tryParse(val) ?? fallback;
      }
      return fallback;
    }

    DateTime? parseNullableDate(dynamic val) {
      if (val == null) return null;
      if (val is DateTime) return val;
      if (val is String && val.isNotEmpty) {
        return DateTime.tryParse(val);
      }
      return null;
    }

    final isCompleted = json['isCompleted'] == true;
    final isSubmitted = json['isSubmitted'] == true;
    final statusIntVal = json['statusInt'] is int
        ? json['statusInt'] as int
        : (isSubmitted ? 3 : isCompleted ? 2 : 0);

    return RouteAssessmentModel(
      id: docId ?? json['id']?.toString() ?? '',
      assessmentType: json['assessmentType']?.toString() ?? '0',
      routeId: json['routeId']?.toString() ?? '',
      schoolBoardId: json['schoolBoardId'] is int ? json['schoolBoardId'] as int : null,
      schoolBoard: json['schoolBoard']?.toString(),
      schoolId: json['schoolId'] is int ? json['schoolId'] as int : null,
      school: json['school']?.toString(),
      schoolYear: json['schoolYear']?.toString() ?? '2026-2027',
      assessmentDate: parseNullableDate(json['assessmentDate']),
      conductedByDriver: json['conductedByDriver']?.toString() ?? 'Driver',
      conductedByOperator: json['conductedByOperator']?.toString(),
      conductedByEmployeeId: json['conductedByEmployeeId']?.toString(),
      driverEmail: json['driverEmail']?.toString(),
      driverPhone: json['driverPhone']?.toString(),
      summary: json['summary']?.toString(),
      visibilityProblemCheck: json['visibilityProblemCheck'] == true,
      visibilityProblem: json['visibilityProblem']?.toString(),
      highwayStopConcernCheck: json['highwayStopConcernCheck'] == true,
      highwayStopConcern: json['highwayStopConcern']?.toString(),
      locationProblemCheck: json['locationProblemCheck'] == true,
      locationProblem: json['locationProblem']?.toString(),
      unsafeTurnaroundCheck: json['unsafeTurnaroundCheck'] == true,
      unsafeTurnaround: json['unsafeTurnaround']?.toString(),
      intersectionCheck: json['intersectionCheck'] == true,
      intersection: json['intersection']?.toString(),
      roadwayCheck: json['roadwayCheck'] == true,
      roadway: json['roadway']?.toString(),
      nonweatherRiskCheck: json['nonweatherRiskCheck'] == true,
      nonweatherRisk: json['nonweatherRisk']?.toString(),
      weatherRiskCheck: json['weatherRiskCheck'] == true,
      weatherRisk: json['weatherRisk']?.toString(),
      companyPolicyCheck: json['companyPolicyCheck'] == true,
      companyPolicyFamiliar: json['companyPolicyFamiliar'] == true,
      routeAdjustCheck: json['routeAdjustCheck'] == true,
      routeAdjust: json['routeAdjust']?.toString(),
      safetyConcernCheck: json['safetyConcernCheck'] == true,
      safetyConcern: json['safetyConcern']?.toString(),
      assignedTo: json['assignedTo']?.toString(),
      isCompleted: isCompleted,
      isSubmitted: isSubmitted,
      statusInt: statusIntVal,
      statusStr: json['statusStr']?.toString() ??
          (statusIntVal == 3 ? 'Submitted' : statusIntVal == 2 ? 'Completed' : 'Working'),
      attachmentUrls: json['attachmentUrls'] is List
          ? (json['attachmentUrls'] as List).map((e) => e.toString()).toList()
          : [],
      createdAt: parseDate(json['createdAt'], DateTime.now()),
      updatedAt: parseDate(json['updatedAt'], DateTime.now()),
    );
  }

  @override
  List<Object?> get props => [
        id,
        assessmentType,
        routeId,
        schoolBoard,
        school,
        schoolYear,
        assessmentDate,
        conductedByDriver,
        conductedByEmployeeId,
        summary,
        visibilityProblemCheck,
        visibilityProblem,
        highwayStopConcernCheck,
        highwayStopConcern,
        locationProblemCheck,
        locationProblem,
        unsafeTurnaroundCheck,
        unsafeTurnaround,
        intersectionCheck,
        intersection,
        roadwayCheck,
        roadway,
        nonweatherRiskCheck,
        nonweatherRisk,
        weatherRiskCheck,
        weatherRisk,
        companyPolicyCheck,
        companyPolicyFamiliar,
        routeAdjustCheck,
        routeAdjust,
        safetyConcernCheck,
        safetyConcern,
        assignedTo,
        isCompleted,
        isSubmitted,
        statusInt,
        attachmentUrls,
        createdAt,
        updatedAt,
      ];
}
