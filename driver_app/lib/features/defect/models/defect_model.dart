import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

// ─────────────────────────── Enums ───────────────────────────────────────────

enum DefectItemStatus {
  ok,
  defect,
  notApplicable;

  String get apiValue {
    switch (this) {
      case DefectItemStatus.ok:
        return 'ok';
      case DefectItemStatus.defect:
        return 'defect';
      case DefectItemStatus.notApplicable:
        return 'na';
    }
  }

  static DefectItemStatus fromApiValue(dynamic v) {
    if (v == 0 || v == '0' || v == 'ok' || v == 'pass') return DefectItemStatus.ok;
    if (v == 1 || v == '1' || v == 'defect') return DefectItemStatus.defect;
    if (v == 2 || v == '2' || v == 'na' || v == 'not_applicable') return DefectItemStatus.notApplicable;
    return DefectItemStatus.ok;
  }

  String get label {
    switch (this) {
      case DefectItemStatus.ok:
        return 'OK';
      case DefectItemStatus.defect:
        return 'Defect';
      case DefectItemStatus.notApplicable:
        return 'N/A';
    }
  }
}

enum DefectReportStatus {
  submitted,
  underAssessment,
  underRepair,
  resolved;

  String get apiValue {
    switch (this) {
      case DefectReportStatus.submitted:
        return 'submitted';
      case DefectReportStatus.underAssessment:
        return 'under_assessment';
      case DefectReportStatus.underRepair:
        return 'under_repair';
      case DefectReportStatus.resolved:
        return 'resolved';
    }
  }

  static DefectReportStatus fromApiValue(dynamic v) {
    if (v == 1 || v == '1' || v == 'submitted') return DefectReportStatus.submitted;
    if (v == 2 || v == '2' || v == 'under_assessment') return DefectReportStatus.underAssessment;
    if (v == 3 || v == '3' || v == 'under_repair') return DefectReportStatus.underRepair;
    if (v == 4 || v == '4' || v == 'resolved') return DefectReportStatus.resolved;
    return DefectReportStatus.submitted;
  }

  String get label {
    switch (this) {
      case DefectReportStatus.submitted:
        return 'Submitted';
      case DefectReportStatus.underAssessment:
        return 'Under Assessment';
      case DefectReportStatus.underRepair:
        return 'Under Repair';
      case DefectReportStatus.resolved:
        return 'Resolved';
    }
  }

  Color get color {
    switch (this) {
      case DefectReportStatus.submitted:
        return const Color(0xFFD97706); // Amber
      case DefectReportStatus.underAssessment:
        return const Color(0xFF2563EB); // Blue
      case DefectReportStatus.underRepair:
        return const Color(0xFF9333EA); // Purple
      case DefectReportStatus.resolved:
        return const Color(0xFF059669); // Emerald
    }
  }
}

// ─────────────────────────── Checklist Item Template ────────────────────────

class DefectCheckItemTemplate {
  final String key;
  final String label;
  final String group;

  const DefectCheckItemTemplate({
    required this.key,
    required this.label,
    required this.group,
  });

  static const List<DefectCheckItemTemplate> standardItems = [
    // Daily Check group
    DefectCheckItemTemplate(
      key: 'fuel_oil_leaks',
      label: 'Fuel / Oil Leaks',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'battery',
      label: 'Battery & Electrical Terminals',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'tyres_wheel',
      label: 'Tyres / Wheels & Wheel Fixing',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'spray_suppression',
      label: 'Spray Suppression & Mudflaps',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'brakes_abs_ebs',
      label: 'Brakes (Service, Parking & ABS/EBS)',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'doors_exits',
      label: 'Doors & Emergency Exits',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'indicators_side_repeaters',
      label: 'Indicators & Side Repeaters',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'fire_extinguisher',
      label: 'Fire Extinguisher & Safety Kit',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'seats_seatbelts',
      label: 'Seats & Driver / Passenger Belts',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'air_buildup_leaks',
      label: 'Air Build-up / System Leaks',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'wipers_washers',
      label: 'Windshield Wipers & Washers',
      group: 'Daily Check',
    ),
    DefectCheckItemTemplate(
      key: 'communication_devices',
      label: 'Communication & Radio Devices',
      group: 'Daily Check',
    ),

    // Periodic / When Checked group
    DefectCheckItemTemplate(
      key: 'horn',
      label: 'Horn Operation',
      group: 'Periodic Check',
    ),
    DefectCheckItemTemplate(
      key: 'vehicle_height',
      label: 'Vehicle Clearance & Height Markers',
      group: 'Periodic Check',
    ),
    DefectCheckItemTemplate(
      key: 'reflectors',
      label: 'Reflectors & Reflective Tape',
      group: 'Periodic Check',
    ),
    DefectCheckItemTemplate(
      key: 'body_exterior',
      label: 'Body Exterior & Panels',
      group: 'Periodic Check',
    ),
    DefectCheckItemTemplate(
      key: 'first_aid_kit',
      label: 'First-Aid Kit Inspection',
      group: 'Periodic Check',
    ),
    DefectCheckItemTemplate(
      key: 'accessibility_equipment',
      label: 'Accessibility Equipment / Lift',
      group: 'Periodic Check',
    ),
    DefectCheckItemTemplate(
      key: 'adblue',
      label: 'AdBlue / Exhaust Emissions Fluid',
      group: 'Periodic Check',
    ),
  ];
}

// ─────────────────────────── Defect Item Result ──────────────────────────────

class DefectReportItem extends Equatable {
  final String id;
  final String name;
  final String category;
  final DefectItemStatus status;
  final String notes;

  const DefectReportItem({
    required this.id,
    required this.name,
    required this.category,
    required this.status,
    this.notes = '',
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'category': category,
        'status': status.apiValue,
        'notes': notes,
      };

  factory DefectReportItem.fromJson(Map<String, dynamic> json) {
    return DefectReportItem(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString() ?? 'Daily Check',
      status: DefectItemStatus.fromApiValue(json['status']),
      notes: json['notes']?.toString() ?? '',
    );
  }

  @override
  List<Object?> get props => [id, name, category, status, notes];
}

// ─────────────────────────── Defect Assessment ───────────────────────────────

class DefectAssessment extends Equatable {
  final String assessedBy;
  final DateTime? assessedAt;
  final String assessmentNotes;
  final String repairLocation;
  final int estimatedRepairDays;
  final String estimatedStartDate;
  final String estimatedCompletionDate;
  final String actualCompletionDate;
  final double repairCost;
  final String mechanicNotes;
  final String resolvedBy;
  final DateTime? resolvedAt;

  const DefectAssessment({
    this.assessedBy = '',
    this.assessedAt,
    this.assessmentNotes = '',
    this.repairLocation = '',
    this.estimatedRepairDays = 0,
    this.estimatedStartDate = '',
    this.estimatedCompletionDate = '',
    this.actualCompletionDate = '',
    this.repairCost = 0.0,
    this.mechanicNotes = '',
    this.resolvedBy = '',
    this.resolvedAt,
  });

  Map<String, dynamic> toJson() => {
        'assessedBy': assessedBy,
        'assessedAt': assessedAt?.toIso8601String(),
        'assessmentNotes': assessmentNotes,
        'repairLocation': repairLocation,
        'estimatedRepairDays': estimatedRepairDays,
        'estimatedStartDate': estimatedStartDate,
        'estimatedCompletionDate': estimatedCompletionDate,
        'actualCompletionDate': actualCompletionDate,
        'repairCost': repairCost,
        'mechanicNotes': mechanicNotes,
        'resolvedBy': resolvedBy,
        'resolvedAt': resolvedAt?.toIso8601String(),
      };

  factory DefectAssessment.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic d) {
      if (d == null) return null;
      try {
        return DateTime.parse(d.toString());
      } catch (_) {
        return null;
      }
    }

    return DefectAssessment(
      assessedBy: json['assessedBy']?.toString() ?? '',
      assessedAt: parseDate(json['assessedAt']),
      assessmentNotes: json['assessmentNotes']?.toString() ?? '',
      repairLocation: json['repairLocation']?.toString() ?? '',
      estimatedRepairDays: (json['estimatedRepairDays'] as num?)?.toInt() ?? 0,
      estimatedStartDate: json['estimatedStartDate']?.toString() ?? '',
      estimatedCompletionDate: json['estimatedCompletionDate']?.toString() ?? '',
      actualCompletionDate: json['actualCompletionDate']?.toString() ?? '',
      repairCost: (json['repairCost'] as num?)?.toDouble() ?? 0.0,
      mechanicNotes: json['mechanicNotes']?.toString() ?? '',
      resolvedBy: json['resolvedBy']?.toString() ?? '',
      resolvedAt: parseDate(json['resolvedAt']),
    );
  }

  @override
  List<Object?> get props => [
        assessedBy,
        assessedAt,
        assessmentNotes,
        repairLocation,
        estimatedRepairDays,
        estimatedStartDate,
        estimatedCompletionDate,
        actualCompletionDate,
        repairCost,
        mechanicNotes,
        resolvedBy,
        resolvedAt,
      ];
}

// ─────────────────────────── Vehicle Defect Report ───────────────────────────

class VehicleDefectReport extends Equatable {
  final String id;
  final int vehicleId;
  final String vehicleUnitNumber;
  final int odometer;
  final String reportedByUserId;
  final String reportedByName;
  final String reportDate; // YYYY-MM-DD
  final String reportTime; // HH:mm
  final List<DefectReportItem> items;
  final String defectNotes;
  final bool noDefectsFound;
  final bool confirmedAccurate;
  final DefectReportStatus status;
  final DefectAssessment? assessment;
  final DateTime createdAt;
  final DateTime updatedAt;

  const VehicleDefectReport({
    required this.id,
    required this.vehicleId,
    required this.vehicleUnitNumber,
    required this.odometer,
    required this.reportedByUserId,
    required this.reportedByName,
    required this.reportDate,
    required this.reportTime,
    required this.items,
    this.defectNotes = '',
    this.noDefectsFound = false,
    this.confirmedAccurate = false,
    this.status = DefectReportStatus.submitted,
    this.assessment,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Count of items flagged with Defect status
  int get defectCount =>
      items.where((i) => i.status == DefectItemStatus.defect).length;

  Map<String, dynamic> toJson() => {
        'id': id,
        'vehicleId': vehicleId,
        'vehicleUnitNumber': vehicleUnitNumber,
        'odometer': odometer,
        'reportedByUserId': reportedByUserId,
        'reportedByName': reportedByName,
        'reportDate': reportDate,
        'reportTime': reportTime,
        'items': items.map((i) => i.toJson()).toList(),
        'defectNotes': defectNotes,
        'noDefectsFound': noDefectsFound,
        'confirmedAccurate': confirmedAccurate,
        'status': status.apiValue,
        'assessment': assessment?.toJson(),
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };

  factory VehicleDefectReport.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic d) {
      if (d == null) return DateTime.now();
      try {
        return DateTime.parse(d.toString());
      } catch (_) {
        return DateTime.now();
      }
    }

    final rawItems = json['items'];
    List<DefectReportItem> parsedItems = [];
    if (rawItems is List) {
      parsedItems = rawItems
          .map((i) => DefectReportItem.fromJson(Map<String, dynamic>.from(i as Map)))
          .toList();
    }

    DefectAssessment? parsedAssessment;
    if (json['assessment'] is Map) {
      parsedAssessment = DefectAssessment.fromJson(
          Map<String, dynamic>.from(json['assessment'] as Map));
    }

    return VehicleDefectReport(
      id: json['id']?.toString() ?? '',
      vehicleId: (json['vehicleId'] as num?)?.toInt() ?? 0,
      vehicleUnitNumber: json['vehicleUnitNumber']?.toString() ?? '',
      odometer: (json['odometer'] as num?)?.toInt() ?? 0,
      reportedByUserId: json['reportedByUserId']?.toString() ?? '',
      reportedByName: json['reportedByName']?.toString() ?? '',
      reportDate: json['reportDate']?.toString() ?? '',
      reportTime: json['reportTime']?.toString() ?? '',
      items: parsedItems,
      defectNotes: json['defectNotes']?.toString() ?? '',
      noDefectsFound: json['noDefectsFound'] == true,
      confirmedAccurate: json['confirmedAccurate'] == true,
      status: DefectReportStatus.fromApiValue(json['status']),
      assessment: parsedAssessment,
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt']),
    );
  }

  @override
  List<Object?> get props => [
        id,
        vehicleId,
        vehicleUnitNumber,
        odometer,
        reportedByUserId,
        reportedByName,
        reportDate,
        reportTime,
        items,
        defectNotes,
        noDefectsFound,
        confirmedAccurate,
        status,
        assessment,
        createdAt,
        updatedAt,
      ];
}
