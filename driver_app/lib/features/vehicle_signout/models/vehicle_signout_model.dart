
class VehicleSignoutAttachment {
  final String url;
  final String fileName;
  final String? caption;
  final String uploadedTime;

  VehicleSignoutAttachment({
    required this.url,
    required this.fileName,
    this.caption,
    required this.uploadedTime,
  });

  factory VehicleSignoutAttachment.fromJson(Map<String, dynamic> json) {
    return VehicleSignoutAttachment(
      url: json['url']?.toString() ?? '',
      fileName: json['fileName']?.toString() ?? '',
      caption: json['caption']?.toString(),
      uploadedTime: json['uploadedTime']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'fileName': fileName,
      'caption': caption,
      'uploadedTime': uploadedTime,
    };
  }
}

class VehicleSignoutModel {
  final String id;
  final bool isSignIn; // false = Sign Out, true = Sign In
  final String signDate;
  final int vehicleType; // 0 = Bus, 1 = Van
  final String employeeId;
  final String employeeName;
  final String? routeId;
  final String? routeName;
  final String? cellPhone;
  final String? driverLicenseClass;
  final String? driverLicenseCondition;
  final int? unitId;
  final String unitNumber;
  final double odometer;
  final String? licensePlate;
  final String? cvipDate;
  final int? unitYear;
  final String? unitMaker;
  final String? unitModel;
  final String? unitColor;
  final int? fuelLevelId;
  final String? fuelLevelDescription;
  final int? fuelTypeId;
  final String? fuelTypeDescription;

  // Document checklist
  final bool docRegistrationSignIn;
  final bool docInsuranceSignIn;
  final bool docSafetyFitnessSignIn;
  final bool docCollisionReportSignIn;
  final bool docScheduleMaintenanceSignIn;
  final bool docSdsSignIn;

  // Safety equipment checklist
  final bool checkFireExtinguisher;
  final bool checkFirstAidKit;
  final bool checkTriangles;
  final bool checkQstraints;
  final bool checkSeatBeltCutter;
  final bool checkBroom;
  final bool checkSnowbrush;
  final bool checkCleankit;

  // Parking & Acknowledgement
  final bool acknowledgeCheck;
  final String? conditionKey;
  final String? conditionComments;
  final String? parkingAddress;
  final String? fireHallLocation;

  // Signatures
  final String? driverSignature;
  final String? driverSignDate;
  final String? fleetDepartmentSignature;
  final String? fleetDepartmentSignDate;

  final List<VehicleSignoutAttachment> attachments;
  final String? createdBy;
  final String createdAt;
  final String updatedAt;

  VehicleSignoutModel({
    required this.id,
    required this.isSignIn,
    required this.signDate,
    this.vehicleType = 0,
    required this.employeeId,
    required this.employeeName,
    this.routeId,
    this.routeName,
    this.cellPhone,
    this.driverLicenseClass,
    this.driverLicenseCondition,
    this.unitId,
    required this.unitNumber,
    this.odometer = 0.0,
    this.licensePlate,
    this.cvipDate,
    this.unitYear,
    this.unitMaker,
    this.unitModel,
    this.unitColor,
    this.fuelLevelId,
    this.fuelLevelDescription = 'Full',
    this.fuelTypeId,
    this.fuelTypeDescription = 'Diesel',
    this.docRegistrationSignIn = true,
    this.docInsuranceSignIn = true,
    this.docSafetyFitnessSignIn = true,
    this.docCollisionReportSignIn = true,
    this.docScheduleMaintenanceSignIn = true,
    this.docSdsSignIn = true,
    this.checkFireExtinguisher = true,
    this.checkFirstAidKit = true,
    this.checkTriangles = true,
    this.checkQstraints = false,
    this.checkSeatBeltCutter = true,
    this.checkBroom = true,
    this.checkSnowbrush = true,
    this.checkCleankit = true,
    this.acknowledgeCheck = true,
    this.conditionKey,
    this.conditionComments,
    this.parkingAddress,
    this.fireHallLocation,
    this.driverSignature,
    this.driverSignDate,
    this.fleetDepartmentSignature,
    this.fleetDepartmentSignDate,
    this.attachments = const [],
    this.createdBy,
    required this.createdAt,
    required this.updatedAt,
  });

  factory VehicleSignoutModel.fromJson(Map<String, dynamic> json) {
    List<VehicleSignoutAttachment> attList = [];
    if (json['attachments'] != null && json['attachments'] is List) {
      attList = (json['attachments'] as List)
          .map((a) => VehicleSignoutAttachment.fromJson(a as Map<String, dynamic>))
          .toList();
    }

    return VehicleSignoutModel(
      id: json['id']?.toString() ?? '',
      isSignIn: json['isSignIn'] == true,
      signDate: json['signDate']?.toString() ?? '',
      vehicleType: json['vehicleType'] is int ? json['vehicleType'] : int.tryParse(json['vehicleType']?.toString() ?? '0') ?? 0,
      employeeId: json['employeeId']?.toString() ?? '',
      employeeName: json['employeeName']?.toString() ?? 'Driver',
      routeId: json['routeId']?.toString(),
      routeName: json['routeName']?.toString(),
      cellPhone: json['cellPhone']?.toString(),
      driverLicenseClass: json['driverLicenseClass']?.toString(),
      driverLicenseCondition: json['driverLicenseCondition']?.toString(),
      unitId: json['unitId'] is int ? json['unitId'] : int.tryParse(json['unitId']?.toString() ?? ''),
      unitNumber: json['unitNumber']?.toString() ?? '',
      odometer: json['odometer'] is num ? (json['odometer'] as num).toDouble() : double.tryParse(json['odometer']?.toString() ?? '0') ?? 0.0,
      licensePlate: json['licensePlate']?.toString(),
      cvipDate: json['cvipDate']?.toString(),
      unitYear: json['unitYear'] is int ? json['unitYear'] : int.tryParse(json['unitYear']?.toString() ?? ''),
      unitMaker: json['unitMaker']?.toString(),
      unitModel: json['unitModel']?.toString(),
      unitColor: json['unitColor']?.toString(),
      fuelLevelId: json['fuelLevelId'] is int ? json['fuelLevelId'] : int.tryParse(json['fuelLevelId']?.toString() ?? ''),
      fuelLevelDescription: json['fuelLevelDescription']?.toString() ?? 'Full',
      fuelTypeId: json['fuelTypeId'] is int ? json['fuelTypeId'] : int.tryParse(json['fuelTypeId']?.toString() ?? ''),
      fuelTypeDescription: json['fuelTypeDescription']?.toString() ?? 'Diesel',
      docRegistrationSignIn: json['docRegistrationSignIn'] == true,
      docInsuranceSignIn: json['docInsuranceSignIn'] == true,
      docSafetyFitnessSignIn: json['docSafetyFitnessSignIn'] == true,
      docCollisionReportSignIn: json['docCollisionReportSignIn'] == true,
      docScheduleMaintenanceSignIn: json['docScheduleMaintenanceSignIn'] == true,
      docSdsSignIn: json['docSdsSignIn'] == true,
      checkFireExtinguisher: json['checkFireExtinguisher'] == true,
      checkFirstAidKit: json['checkFirstAidKit'] == true,
      checkTriangles: json['checkTriangles'] == true,
      checkQstraints: json['checkQstraints'] == true,
      checkSeatBeltCutter: json['checkSeatBeltCutter'] == true,
      checkBroom: json['checkBroom'] == true,
      checkSnowbrush: json['checkSnowbrush'] == true,
      checkCleankit: json['checkCleankit'] == true,
      acknowledgeCheck: json['acknowledgeCheck'] == true,
      conditionKey: json['conditionKey']?.toString(),
      conditionComments: json['conditionComments']?.toString(),
      parkingAddress: json['parkingAddress']?.toString(),
      fireHallLocation: json['fireHallLocation']?.toString(),
      driverSignature: json['driverSignature']?.toString(),
      driverSignDate: json['driverSignDate']?.toString(),
      fleetDepartmentSignature: json['fleetDepartmentSignature']?.toString(),
      fleetDepartmentSignDate: json['fleetDepartmentSignDate']?.toString(),
      attachments: attList,
      createdBy: json['createdBy']?.toString(),
      createdAt: json['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'isSignIn': isSignIn,
      'signDate': signDate,
      'vehicleType': vehicleType,
      'employeeId': employeeId,
      'employeeName': employeeName,
      'routeId': routeId,
      'routeName': routeName,
      'cellPhone': cellPhone,
      'driverLicenseClass': driverLicenseClass,
      'driverLicenseCondition': driverLicenseCondition,
      'unitId': unitId,
      'unitNumber': unitNumber,
      'odometer': odometer,
      'licensePlate': licensePlate,
      'cvipDate': cvipDate,
      'unitYear': unitYear,
      'unitMaker': unitMaker,
      'unitModel': unitModel,
      'unitColor': unitColor,
      'fuelLevelId': fuelLevelId,
      'fuelLevelDescription': fuelLevelDescription,
      'fuelTypeId': fuelTypeId,
      'fuelTypeDescription': fuelTypeDescription,
      'docRegistrationSignIn': docRegistrationSignIn,
      'docInsuranceSignIn': docInsuranceSignIn,
      'docSafetyFitnessSignIn': docSafetyFitnessSignIn,
      'docCollisionReportSignIn': docCollisionReportSignIn,
      'docScheduleMaintenanceSignIn': docScheduleMaintenanceSignIn,
      'docSdsSignIn': docSdsSignIn,
      'checkFireExtinguisher': checkFireExtinguisher,
      'checkFirstAidKit': checkFirstAidKit,
      'checkTriangles': checkTriangles,
      'checkQstraints': checkQstraints,
      'checkSeatBeltCutter': checkSeatBeltCutter,
      'checkBroom': checkBroom,
      'checkSnowbrush': checkSnowbrush,
      'checkCleankit': checkCleankit,
      'acknowledgeCheck': acknowledgeCheck,
      'conditionKey': conditionKey,
      'conditionComments': conditionComments,
      'parkingAddress': parkingAddress,
      'fireHallLocation': fireHallLocation,
      'driverSignature': driverSignature,
      'driverSignDate': driverSignDate,
      'fleetDepartmentSignature': fleetDepartmentSignature,
      'fleetDepartmentSignDate': fleetDepartmentSignDate,
      'attachments': attachments.map((a) => a.toJson()).toList(),
      'createdBy': createdBy,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  VehicleSignoutModel copyWith({
    String? id,
    bool? isSignIn,
    String? signDate,
    int? vehicleType,
    String? employeeId,
    String? employeeName,
    String? routeId,
    String? routeName,
    String? cellPhone,
    String? driverLicenseClass,
    String? driverLicenseCondition,
    int? unitId,
    String? unitNumber,
    double? odometer,
    String? licensePlate,
    String? cvipDate,
    int? unitYear,
    String? unitMaker,
    String? unitModel,
    String? unitColor,
    int? fuelLevelId,
    String? fuelLevelDescription,
    int? fuelTypeId,
    String? fuelTypeDescription,
    bool? docRegistrationSignIn,
    bool? docInsuranceSignIn,
    bool? docSafetyFitnessSignIn,
    bool? docCollisionReportSignIn,
    bool? docScheduleMaintenanceSignIn,
    bool? docSdsSignIn,
    bool? checkFireExtinguisher,
    bool? checkFirstAidKit,
    bool? checkTriangles,
    bool? checkQstraints,
    bool? checkSeatBeltCutter,
    bool? checkBroom,
    bool? checkSnowbrush,
    bool? checkCleankit,
    bool? acknowledgeCheck,
    String? conditionKey,
    String? conditionComments,
    String? parkingAddress,
    String? fireHallLocation,
    String? driverSignature,
    String? driverSignDate,
    String? fleetDepartmentSignature,
    String? fleetDepartmentSignDate,
    List<VehicleSignoutAttachment>? attachments,
    String? createdBy,
    String? createdAt,
    String? updatedAt,
  }) {
    return VehicleSignoutModel(
      id: id ?? this.id,
      isSignIn: isSignIn ?? this.isSignIn,
      signDate: signDate ?? this.signDate,
      vehicleType: vehicleType ?? this.vehicleType,
      employeeId: employeeId ?? this.employeeId,
      employeeName: employeeName ?? this.employeeName,
      routeId: routeId ?? this.routeId,
      routeName: routeName ?? this.routeName,
      cellPhone: cellPhone ?? this.cellPhone,
      driverLicenseClass: driverLicenseClass ?? this.driverLicenseClass,
      driverLicenseCondition: driverLicenseCondition ?? this.driverLicenseCondition,
      unitId: unitId ?? this.unitId,
      unitNumber: unitNumber ?? this.unitNumber,
      odometer: odometer ?? this.odometer,
      licensePlate: licensePlate ?? this.licensePlate,
      cvipDate: cvipDate ?? this.cvipDate,
      unitYear: unitYear ?? this.unitYear,
      unitMaker: unitMaker ?? this.unitMaker,
      unitModel: unitModel ?? this.unitModel,
      unitColor: unitColor ?? this.unitColor,
      fuelLevelId: fuelLevelId ?? this.fuelLevelId,
      fuelLevelDescription: fuelLevelDescription ?? this.fuelLevelDescription,
      fuelTypeId: fuelTypeId ?? this.fuelTypeId,
      fuelTypeDescription: fuelTypeDescription ?? this.fuelTypeDescription,
      docRegistrationSignIn: docRegistrationSignIn ?? this.docRegistrationSignIn,
      docInsuranceSignIn: docInsuranceSignIn ?? this.docInsuranceSignIn,
      docSafetyFitnessSignIn: docSafetyFitnessSignIn ?? this.docSafetyFitnessSignIn,
      docCollisionReportSignIn: docCollisionReportSignIn ?? this.docCollisionReportSignIn,
      docScheduleMaintenanceSignIn: docScheduleMaintenanceSignIn ?? this.docScheduleMaintenanceSignIn,
      docSdsSignIn: docSdsSignIn ?? this.docSdsSignIn,
      checkFireExtinguisher: checkFireExtinguisher ?? this.checkFireExtinguisher,
      checkFirstAidKit: checkFirstAidKit ?? this.checkFirstAidKit,
      checkTriangles: checkTriangles ?? this.checkTriangles,
      checkQstraints: checkQstraints ?? this.checkQstraints,
      checkSeatBeltCutter: checkSeatBeltCutter ?? this.checkSeatBeltCutter,
      checkBroom: checkBroom ?? this.checkBroom,
      checkSnowbrush: checkSnowbrush ?? this.checkSnowbrush,
      checkCleankit: checkCleankit ?? this.checkCleankit,
      acknowledgeCheck: acknowledgeCheck ?? this.acknowledgeCheck,
      conditionKey: conditionKey ?? this.conditionKey,
      conditionComments: conditionComments ?? this.conditionComments,
      parkingAddress: parkingAddress ?? this.parkingAddress,
      fireHallLocation: fireHallLocation ?? this.fireHallLocation,
      driverSignature: driverSignature ?? this.driverSignature,
      driverSignDate: driverSignDate ?? this.driverSignDate,
      fleetDepartmentSignature: fleetDepartmentSignature ?? this.fleetDepartmentSignature,
      fleetDepartmentSignDate: fleetDepartmentSignDate ?? this.fleetDepartmentSignDate,
      attachments: attachments ?? this.attachments,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
