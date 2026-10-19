class VehicleLiveLocation {
  final String unitNumber;
  final String routeNo;
  final String shiftId;
  final double latitude;
  final double longitude;
  final double heading;
  final double speedKmh;
  final DateTime lastUpdated;
  final int currentStopSequence;
  final String nextStopLocation;
  final String status;

  VehicleLiveLocation({
    required this.unitNumber,
    required this.routeNo,
    required this.shiftId,
    required this.latitude,
    required this.longitude,
    required this.heading,
    required this.speedKmh,
    required this.lastUpdated,
    required this.currentStopSequence,
    required this.nextStopLocation,
    required this.status,
  });

  factory VehicleLiveLocation.fromJson(Map<String, dynamic> json) {
    return VehicleLiveLocation(
      unitNumber: json['unitNumber'] as String? ?? '',
      routeNo: json['routeNo'] as String? ?? '',
      shiftId: json['shiftId'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      heading: (json['heading'] as num?)?.toDouble() ?? 0.0,
      speedKmh: (json['speedKmh'] as num?)?.toDouble() ?? 0.0,
      lastUpdated: json['lastUpdated'] != null
          ? DateTime.tryParse(json['lastUpdated'].toString()) ?? DateTime.now()
          : DateTime.now(),
      currentStopSequence: json['currentStopSequence'] as int? ?? 0,
      nextStopLocation: json['nextStopLocation'] as String? ?? '',
      status: json['status'] as String? ?? 'EN_ROUTE',
    );
  }
}

class ParentStudentCommute {
  final int studentId;
  final String studentNo;
  final String studentName;
  final String grade;
  final String schoolName;
  final String avatarColor;
  final String shiftType;
  final String shiftId;
  final String routeNo;
  final String busUnitNumber;
  final String driverName;
  final String stopLocation;
  final String stopType;
  final double? stopLatitude;
  final double? stopLongitude;
  final double? schoolLatitude;
  final double? schoolLongitude;
  final String scheduledTime;
  final String estimatedTime;
  final int lateMinutes;
  final String status; // SCHEDULED, EN_ROUTE, APPROACHING, BOARDED, DROPPED_OFF, DELAYED
  final VehicleLiveLocation? vehicleLocation;
  final double? distanceKm;
  final int? minutesAway;
  final String? routePolyline;

  ParentStudentCommute({
    required this.studentId,
    required this.studentNo,
    required this.studentName,
    required this.grade,
    required this.schoolName,
    this.schoolLatitude,
    this.schoolLongitude,
    required this.avatarColor,
    required this.shiftType,
    required this.shiftId,
    required this.routeNo,
    required this.busUnitNumber,
    required this.driverName,
    required this.stopLocation,
    this.stopLatitude,
    this.stopLongitude,
    required this.stopType,
    required this.scheduledTime,
    required this.estimatedTime,
    required this.lateMinutes,
    required this.status,
    this.vehicleLocation,
    this.distanceKm,
    this.minutesAway,
    this.routePolyline,
  });

  factory ParentStudentCommute.fromJson(Map<String, dynamic> json) {
    return ParentStudentCommute(
      studentId: json['studentId'] as int? ?? 0,
      studentNo: json['studentNo'] as String? ?? '',
      studentName: json['studentName'] as String? ?? 'Student',
      grade: json['grade'] as String? ?? '',
      schoolName: json['schoolName'] as String? ?? '',
      schoolLatitude: (json['schoolLatitude'] as num?)?.toDouble(),
      schoolLongitude: (json['schoolLongitude'] as num?)?.toDouble(),
      avatarColor: json['avatarColor'] as String? ?? '#2563EB',
      shiftType: json['shiftType'] as String? ?? 'AM',
      shiftId: json['shiftId'] as String? ?? '',
      routeNo: json['routeNo'] as String? ?? '',
      busUnitNumber: json['busUnitNumber'] as String? ?? '',
      driverName: json['driverName'] as String? ?? '',
      stopLocation: json['stopLocation'] as String? ?? 'Designated Stop',
      stopLatitude: (json['stopLatitude'] as num?)?.toDouble(),
      stopLongitude: (json['stopLongitude'] as num?)?.toDouble(),
      stopType: json['stopType'] as String? ?? 'HomePickup',
      scheduledTime: json['scheduledTime'] as String? ?? '07:30',
      estimatedTime: json['estimatedTime'] as String? ?? '07:30',
      lateMinutes: json['lateMinutes'] as int? ?? 0,
      status: json['status'] as String? ?? 'SCHEDULED',
      vehicleLocation: json['vehicleLocation'] != null
          ? VehicleLiveLocation.fromJson(json['vehicleLocation'] as Map<String, dynamic>)
          : null,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      minutesAway: json['minutesAway'] as int?,
      routePolyline: json['routePolyline'] as String?,
    );
  }
}

class ParentUser {
  final String id;
  final String contactType;
  final String contactValue;
  final String displayName;
  final String phone;
  final String email;
  final String homeAddress;
  final bool isRegistered;
  final List<String> linkedStudentIds;

  ParentUser({
    required this.id,
    required this.contactType,
    required this.contactValue,
    required this.displayName,
    this.phone = '',
    this.email = '',
    this.homeAddress = '',
    required this.isRegistered,
    required this.linkedStudentIds,
  });

  factory ParentUser.fromJson(Map<String, dynamic> json) {
    return ParentUser(
      id: json['id'] as String? ?? '',
      contactType: json['contactType'] as String? ?? 'phone',
      contactValue: json['contactValue'] as String? ?? '',
      displayName: json['displayName'] as String? ?? 'Parent',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String? ?? '',
      homeAddress: json['homeAddress'] as String? ?? '',
      isRegistered: json['isRegistered'] as bool? ?? false,
      linkedStudentIds: (json['linkedStudentIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'contactType': contactType,
      'contactValue': contactValue,
      'displayName': displayName,
      'phone': phone,
      'email': email,
      'homeAddress': homeAddress,
      'isRegistered': isRegistered,
      'linkedStudentIds': linkedStudentIds,
    };
  }
}

class ParentNotificationConfig {
  bool notifyApproaching;
  int approachingMinutes;
  bool notifyDelay;
  int delayThresholdMinutes;
  bool notifyBoarding;
  bool notifyDropoff;
  bool channelPush;
  bool channelSms;
  bool channelEmail;

  ParentNotificationConfig({
    this.notifyApproaching = true,
    this.approachingMinutes = 5,
    this.notifyDelay = true,
    this.delayThresholdMinutes = 10,
    this.notifyBoarding = true,
    this.notifyDropoff = true,
    this.channelPush = true,
    this.channelSms = true,
    this.channelEmail = false,
  });

  factory ParentNotificationConfig.fromJson(Map<String, dynamic> json) {
    return ParentNotificationConfig(
      notifyApproaching: json['notifyApproaching'] as bool? ?? true,
      approachingMinutes: json['approachingMinutes'] as int? ?? 5,
      notifyDelay: json['notifyDelay'] as bool? ?? true,
      delayThresholdMinutes: json['delayThresholdMinutes'] as int? ?? 10,
      notifyBoarding: json['notifyBoarding'] as bool? ?? true,
      notifyDropoff: json['notifyDropoff'] as bool? ?? true,
      channelPush: json['channelPush'] as bool? ?? true,
      channelSms: json['channelSms'] as bool? ?? true,
      channelEmail: json['channelEmail'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'notifyApproaching': notifyApproaching,
      'approachingMinutes': approachingMinutes,
      'notifyDelay': notifyDelay,
      'delayThresholdMinutes': delayThresholdMinutes,
      'notifyBoarding': notifyBoarding,
      'notifyDropoff': notifyDropoff,
      'channelPush': channelPush,
      'channelSms': channelSms,
      'channelEmail': channelEmail,
    };
  }
}
