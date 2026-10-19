import 'package:equatable/equatable.dart';

// ─────────────────────────── Enums ───────────────────────────────────────────

enum InspectionItemStatus {
  pass,
  minorDefect,
  majorDefect,
  notApplicable;

  String get apiValue {
    switch (this) {
      case InspectionItemStatus.pass:
        return 'pass';
      case InspectionItemStatus.minorDefect:
        return 'minor_defect';
      case InspectionItemStatus.majorDefect:
        return 'major_defect';
      case InspectionItemStatus.notApplicable:
        return 'na';
    }
  }

  static InspectionItemStatus fromApiValue(String v) {
    switch (v) {
      case 'minor_defect':
        return InspectionItemStatus.minorDefect;
      case 'major_defect':
        return InspectionItemStatus.majorDefect;
      case 'na':
        return InspectionItemStatus.notApplicable;
      default:
        return InspectionItemStatus.pass;
    }
  }

  String get label {
    switch (this) {
      case InspectionItemStatus.pass:
        return 'Pass';
      case InspectionItemStatus.minorDefect:
        return 'Minor Defect';
      case InspectionItemStatus.majorDefect:
        return 'Major Defect';
      case InspectionItemStatus.notApplicable:
        return 'N/A';
    }
  }
}

enum OverallInspectionStatus {
  passed,
  passedWithMinorDefects,
  failedMajorDefects;

  String get apiValue {
    switch (this) {
      case OverallInspectionStatus.passed:
        return 'passed';
      case OverallInspectionStatus.passedWithMinorDefects:
        return 'passed_with_minor_defects';
      case OverallInspectionStatus.failedMajorDefects:
        return 'failed_major_defects';
    }
  }

  static OverallInspectionStatus fromApiValue(String v) {
    switch (v) {
      case 'passed_with_minor_defects':
        return OverallInspectionStatus.passedWithMinorDefects;
      case 'failed_major_defects':
        return OverallInspectionStatus.failedMajorDefects;
      default:
        return OverallInspectionStatus.passed;
    }
  }

  String get label {
    switch (this) {
      case OverallInspectionStatus.passed:
        return 'Passed';
      case OverallInspectionStatus.passedWithMinorDefects:
        return 'Passed — Minor Defects';
      case OverallInspectionStatus.failedMajorDefects:
        return 'Failed — Major Defects';
    }
  }
}

// ─────────────────────────── Item Result ─────────────────────────────────────

class InspectionItemResult extends Equatable {
  final String code;
  final String title;
  final String category;
  final bool isSchoolBusSpecific;
  final InspectionItemStatus status;
  final String notes;

  const InspectionItemResult({
    required this.code,
    required this.title,
    required this.category,
    this.isSchoolBusSpecific = false,
    this.status = InspectionItemStatus.pass,
    this.notes = '',
  });

  InspectionItemResult copyWith({
    InspectionItemStatus? status,
    String? notes,
  }) {
    return InspectionItemResult(
      code: code,
      title: title,
      category: category,
      isSchoolBusSpecific: isSchoolBusSpecific,
      status: status ?? this.status,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toMap() => {
        'code': code,
        'title': title,
        'category': category,
        'isSchoolBusSpecific': isSchoolBusSpecific,
        'status': status.apiValue,
        'notes': notes,
      };

  factory InspectionItemResult.fromMap(Map<String, dynamic> m) =>
      InspectionItemResult(
        code: m['code'] as String? ?? '',
        title: m['title'] as String? ?? '',
        category: m['category'] as String? ?? '',
        isSchoolBusSpecific: m['isSchoolBusSpecific'] as bool? ?? false,
        status: InspectionItemStatus.fromApiValue(
            m['status'] as String? ?? 'pass'),
        notes: m['notes'] as String? ?? '',
      );

  @override
  List<Object?> get props =>
      [code, title, category, isSchoolBusSpecific, status, notes];
}

// ─────────────────────────── Full Record ─────────────────────────────────────

class PreTripInspectionRecord extends Equatable {
  final String id;
  final String vehicleUnit;
  final int vehicleId;
  final String vehiclePlate;
  final String inspectionDate; // YYYY-MM-DD
  final String inspectionTime; // HH:MM
  final String inspectorId;
  final String inspectorName;
  final int odometer;
  final OverallInspectionStatus overallStatus;
  final Map<String, InspectionItemResult> items;
  final String defectNotes;
  final String signatureName;
  final DateTime createdAt;
  final DateTime updatedAt;

  const PreTripInspectionRecord({
    this.id = '',
    required this.vehicleUnit,
    this.vehicleId = 0,
    this.vehiclePlate = '',
    required this.inspectionDate,
    required this.inspectionTime,
    required this.inspectorId,
    required this.inspectorName,
    this.odometer = 0,
    this.overallStatus = OverallInspectionStatus.passed,
    required this.items,
    this.defectNotes = '',
    required this.signatureName,
    required this.createdAt,
    required this.updatedAt,
  });

  PreTripInspectionRecord copyWith({
    String? id,
    String? vehicleUnit,
    int? vehicleId,
    String? vehiclePlate,
    String? inspectionDate,
    String? inspectionTime,
    String? inspectorId,
    String? inspectorName,
    int? odometer,
    OverallInspectionStatus? overallStatus,
    Map<String, InspectionItemResult>? items,
    String? defectNotes,
    String? signatureName,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return PreTripInspectionRecord(
      id: id ?? this.id,
      vehicleUnit: vehicleUnit ?? this.vehicleUnit,
      vehicleId: vehicleId ?? this.vehicleId,
      vehiclePlate: vehiclePlate ?? this.vehiclePlate,
      inspectionDate: inspectionDate ?? this.inspectionDate,
      inspectionTime: inspectionTime ?? this.inspectionTime,
      inspectorId: inspectorId ?? this.inspectorId,
      inspectorName: inspectorName ?? this.inspectorName,
      odometer: odometer ?? this.odometer,
      overallStatus: overallStatus ?? this.overallStatus,
      items: items ?? this.items,
      defectNotes: defectNotes ?? this.defectNotes,
      signatureName: signatureName ?? this.signatureName,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'vehicleUnit': vehicleUnit,
        'vehicleId': vehicleId,
        'vehiclePlate': vehiclePlate,
        'inspectionDate': inspectionDate,
        'inspectionTime': inspectionTime,
        'inspectorId': inspectorId,
        'inspectorName': inspectorName,
        'odometer': odometer,
        'overallStatus': overallStatus.apiValue,
        'items': items.map((k, v) => MapEntry(k, v.toMap())),
        'defectNotes': defectNotes,
        'signatureName': signatureName,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };

  factory PreTripInspectionRecord.fromMap(Map<String, dynamic> m) {
    final rawItems = m['items'] as Map<String, dynamic>? ?? {};
    final items = rawItems.map((k, v) =>
        MapEntry(k, InspectionItemResult.fromMap(v as Map<String, dynamic>)));
    return PreTripInspectionRecord(
      id: m['id'] as String? ?? '',
      vehicleUnit: m['vehicleUnit'] as String? ?? '',
      vehicleId: (m['vehicleId'] as num?)?.toInt() ?? 0,
      vehiclePlate: m['vehiclePlate'] as String? ?? '',
      inspectionDate: m['inspectionDate'] as String? ?? '',
      inspectionTime: m['inspectionTime'] as String? ?? '',
      inspectorId: m['inspectorId'] as String? ?? '',
      inspectorName: m['inspectorName'] as String? ?? '',
      odometer: (m['odometer'] as num?)?.toInt() ?? 0,
      overallStatus: OverallInspectionStatus.fromApiValue(
          m['overallStatus'] as String? ?? 'passed'),
      items: items,
      defectNotes: m['defectNotes'] as String? ?? '',
      signatureName: m['signatureName'] as String? ?? '',
      createdAt: m['createdAt'] != null
          ? DateTime.tryParse(m['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: m['updatedAt'] != null
          ? DateTime.tryParse(m['updatedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [
        id,
        vehicleUnit,
        vehicleId,
        vehiclePlate,
        inspectionDate,
        inspectionTime,
        inspectorId,
        inspectorName,
        odometer,
        overallStatus,
        items,
        defectNotes,
        signatureName,
        createdAt,
        updatedAt,
      ];
}

// ─────────────── Ontario Reg. 199/07 Schedule 5 Checklist Items ───────────────
// Based on Ontario Regulation 199/07 — Daily Inspection of School Purposes Buses

class ChecklistCategory {
  final String code;
  final String title;
  final bool isSchoolBusSpecific;
  final List<ChecklistItem> items;

  const ChecklistCategory({
    required this.code,
    required this.title,
    this.isSchoolBusSpecific = false,
    required this.items,
  });
}

class ChecklistItem {
  final String code;
  final String title;
  final bool isSchoolBusSpecific;

  const ChecklistItem({
    required this.code,
    required this.title,
    this.isSchoolBusSpecific = false,
  });
}

const List<ChecklistCategory> kSchedule5Categories = [
  // 1. Air Brake System
  ChecklistCategory(
    code: 'AIR_BRAKE',
    title: 'Air Brake System',
    items: [
      ChecklistItem(code: 'AIR_BRAKE_01', title: 'Pushrod stroke within adjustment limit'),
      ChecklistItem(code: 'AIR_BRAKE_02', title: 'Air loss rate within limits (engine off, brakes applied)'),
      ChecklistItem(code: 'AIR_BRAKE_03', title: 'Low-air warning activates above 55 psi'),
      ChecklistItem(code: 'AIR_BRAKE_04', title: 'No audible air leaks'),
      ChecklistItem(code: 'AIR_BRAKE_05', title: 'Air pressure builds to normal operating range'),
    ],
  ),

  // 2. Hydraulic Brake System (if applicable — mark N/A if air brakes only)
  ChecklistCategory(
    code: 'HYD_BRAKE',
    title: 'Hydraulic Brake System',
    items: [
      ChecklistItem(code: 'HYD_BRAKE_01', title: 'Brake boost / power-assist operational'),
      ChecklistItem(code: 'HYD_BRAKE_02', title: 'Brake fluid at proper level — no leaks'),
      ChecklistItem(code: 'HYD_BRAKE_03', title: 'No brake fade or spongy pedal'),
    ],
  ),

  // 3. Parking Brake
  ChecklistCategory(
    code: 'PARK_BRAKE',
    title: 'Parking Brake',
    items: [
      ChecklistItem(code: 'PARK_BRAKE_01', title: 'Parking brake holds vehicle on grade'),
      ChecklistItem(code: 'PARK_BRAKE_02', title: 'Parking brake releases fully'),
    ],
  ),

  // 4. Steering & Suspension
  ChecklistCategory(
    code: 'STEERING',
    title: 'Steering Mechanism & Suspension',
    items: [
      ChecklistItem(code: 'STEERING_01', title: 'Steering free-play within limits'),
      ChecklistItem(code: 'STEERING_02', title: 'No abnormal noise or binding in steering'),
      ChecklistItem(code: 'STEERING_03', title: 'Suspension components — no visible damage or leaks'),
      ChecklistItem(code: 'STEERING_04', title: 'Wheel alignment — no pull or drift'),
    ],
  ),

  // 5. Tires, Wheels, Hubs & Fasteners
  ChecklistCategory(
    code: 'TIRES',
    title: 'Tires, Wheels, Hubs & Fasteners',
    items: [
      ChecklistItem(code: 'TIRES_01', title: 'Tire tread depth meets minimum requirement'),
      ChecklistItem(code: 'TIRES_02', title: 'Tire inflation pressure correct — no visible damage'),
      ChecklistItem(code: 'TIRES_03', title: 'All wheel nuts / lug nuts tight'),
      ChecklistItem(code: 'TIRES_04', title: 'Wheel hubs — no leaks or loose components'),
      ChecklistItem(code: 'TIRES_05', title: 'No exposed wires or sidewall damage'),
    ],
  ),

  // 6. Exhaust & Fuel Systems
  ChecklistCategory(
    code: 'EXHAUST_FUEL',
    title: 'Exhaust & Fuel Systems',
    items: [
      ChecklistItem(code: 'EXHAUST_01', title: 'Exhaust system — no leaks, properly secured'),
      ChecklistItem(code: 'EXHAUST_02', title: 'No exhaust fumes entering passenger compartment'),
      ChecklistItem(code: 'FUEL_01', title: 'Fuel system — no leaks'),
      ChecklistItem(code: 'FUEL_02', title: 'Fuel level adequate for shift'),
    ],
  ),

  // 7. Lamps, Signals & School Bus Lights
  ChecklistCategory(
    code: 'LAMPS',
    title: 'Lamps, Signals & 8-Way Overhead Lights',
    items: [
      ChecklistItem(code: 'LAMPS_01', title: 'Head lamps (low & high beam) operational'),
      ChecklistItem(code: 'LAMPS_02', title: 'Tail lamps, brake lamps & reverse lamp operational'),
      ChecklistItem(code: 'LAMPS_03', title: 'Turn signals — front and rear both sides'),
      ChecklistItem(code: 'LAMPS_04', title: 'Hazard / emergency flashers operational'),
      ChecklistItem(
          code: 'LAMPS_05',
          title: '8-Way overhead alternating lights (amber & red) operational',
          isSchoolBusSpecific: true),
      ChecklistItem(code: 'LAMPS_06', title: 'Side marker & clearance lamps operational'),
    ],
  ),

  // 8. Stop Arm & Crossing Control Arm (school bus specific)
  ChecklistCategory(
    code: 'STOP_ARM',
    title: 'Stop Arm & Crossing Control Arm',
    isSchoolBusSpecific: true,
    items: [
      ChecklistItem(
          code: 'STOP_ARM_01',
          title: 'Stop arm extends and retracts properly',
          isSchoolBusSpecific: true),
      ChecklistItem(
          code: 'STOP_ARM_02',
          title: 'Stop arm lamp operational',
          isSchoolBusSpecific: true),
      ChecklistItem(
          code: 'STOP_ARM_03',
          title: 'Crossing control arm extends / retracts properly',
          isSchoolBusSpecific: true),
    ],
  ),

  // 9. Mirrors, Windshield & Wipers
  ChecklistCategory(
    code: 'VISIBILITY',
    title: 'Mirrors, Windshield Glass & Wipers',
    items: [
      ChecklistItem(code: 'VIS_01', title: 'All mirrors properly adjusted — no cracks or damage'),
      ChecklistItem(code: 'VIS_02', title: 'Windshield — no cracks in driver vision zone'),
      ChecklistItem(code: 'VIS_03', title: 'Windshield wipers operational — blades in good condition'),
      ChecklistItem(code: 'VIS_04', title: 'Windshield washers operational'),
      ChecklistItem(
          code: 'VIS_05',
          title: 'Convex / crossview mirrors operational',
          isSchoolBusSpecific: true),
    ],
  ),

  // 10. Emergency Exits & Alarms
  ChecklistCategory(
    code: 'EMERGENCY_EXIT',
    title: 'Emergency Exits & Alarms',
    items: [
      ChecklistItem(
          code: 'EMER_01',
          title: 'Rear emergency door opens freely — alarm sounds when ajar',
          isSchoolBusSpecific: true),
      ChecklistItem(
          code: 'EMER_02',
          title: 'Roof hatches / side emergency exits operational',
          isSchoolBusSpecific: true),
      ChecklistItem(code: 'EMER_03', title: 'Emergency exit signage clearly visible'),
    ],
  ),

  // 11. Emergency Safety Equipment
  ChecklistCategory(
    code: 'SAFETY_EQUIP',
    title: 'Emergency Safety Equipment',
    items: [
      ChecklistItem(code: 'SAFETY_01', title: 'Fire extinguisher — charged, accessible, within service date'),
      ChecklistItem(code: 'SAFETY_02', title: '3 reflective warning triangles present'),
      ChecklistItem(code: 'SAFETY_03', title: 'First aid kit present and adequately stocked'),
      ChecklistItem(
          code: 'SAFETY_04',
          title: 'Body fluid clean-up kit present',
          isSchoolBusSpecific: true),
    ],
  ),

  // 12. Passenger Compartment, Gauges & Controls
  ChecklistCategory(
    code: 'COMPARTMENT',
    title: 'Passenger Compartment, Gauges & Controls',
    items: [
      ChecklistItem(
          code: 'COMP_01',
          title: 'Passenger seats — secure, no sharp edges or torn upholstery',
          isSchoolBusSpecific: true),
      ChecklistItem(code: 'COMP_02', title: 'Stepwell & floor — clean, no tripping hazards'),
      ChecklistItem(code: 'COMP_03', title: 'Horn operational'),
      ChecklistItem(code: 'COMP_04', title: 'All gauges functional (oil, temp, fuel, etc.)'),
      ChecklistItem(code: 'COMP_05', title: 'Driver seat belt fastens and retracts properly'),
      ChecklistItem(
          code: 'COMP_06',
          title: 'Heating / defrost system operational',
          ),
      ChecklistItem(code: 'COMP_07', title: 'Interior lighting — aisle and step lights'),
    ],
  ),
];

/// Builds the initial items map with all Schedule 5 items set to [InspectionItemStatus.pass].
Map<String, InspectionItemResult> buildInitialItems() {
  final map = <String, InspectionItemResult>{};
  for (final category in kSchedule5Categories) {
    for (final item in category.items) {
      map[item.code] = InspectionItemResult(
        code: item.code,
        title: item.title,
        category: category.title,
        isSchoolBusSpecific: item.isSchoolBusSpecific,
        status: InspectionItemStatus.pass,
        notes: '',
      );
    }
  }
  return map;
}
