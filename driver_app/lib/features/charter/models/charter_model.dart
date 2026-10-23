class CharterStopModel {
  final String id;
  final String charterTripId;
  final int sequenceOrder;
  final int stopType; // 0 = Pickup, 1 = Destination, 2 = Return, 3 = Other
  final String locationName;
  final String address;
  final double? latitude;
  final double? longitude;
  final String? scheduledAt;
  final String? arrivedAt;
  final String? departedAt;
  final String? notes;

  const CharterStopModel({
    required this.id,
    required this.charterTripId,
    required this.sequenceOrder,
    required this.stopType,
    required this.locationName,
    required this.address,
    this.latitude,
    this.longitude,
    this.scheduledAt,
    this.arrivedAt,
    this.departedAt,
    this.notes,
  });

  String get stopTypeLabel {
    switch (stopType) {
      case 0:
        return 'Pickup';
      case 1:
        return 'Destination';
      case 2:
        return 'Return';
      default:
        return 'Stop';
    }
  }

  bool get isArrived => arrivedAt != null && arrivedAt!.isNotEmpty;
  bool get isDeparted => departedAt != null && departedAt!.isNotEmpty;

  factory CharterStopModel.fromMap(Map<String, dynamic> map, {String tripId = ''}) {
    return CharterStopModel(
      id: map['id']?.toString() ?? '',
      charterTripId: map['charterTripId']?.toString() ?? tripId,
      sequenceOrder: (map['sequenceOrder'] as num?)?.toInt() ?? 0,
      stopType: (map['stopType'] as num?)?.toInt() ?? 0,
      locationName: map['locationName']?.toString() ?? '',
      address: map['address']?.toString() ?? '',
      latitude: (map['latitude'] as num?)?.toDouble(),
      longitude: (map['longitude'] as num?)?.toDouble(),
      scheduledAt: map['scheduledAt']?.toString(),
      arrivedAt: map['arrivedAt']?.toString(),
      departedAt: map['departedAt']?.toString(),
      notes: map['notes']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'charterTripId': charterTripId,
      'sequenceOrder': sequenceOrder,
      'stopType': stopType,
      'locationName': locationName,
      'address': address,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (scheduledAt != null) 'scheduledAt': scheduledAt,
      if (arrivedAt != null) 'arrivedAt': arrivedAt,
      if (departedAt != null) 'departedAt': departedAt,
      if (notes != null) 'notes': notes,
    };
  }

  CharterStopModel copyWith({
    String? arrivedAt,
    String? departedAt,
    String? notes,
  }) {
    return CharterStopModel(
      id: id,
      charterTripId: charterTripId,
      sequenceOrder: sequenceOrder,
      stopType: stopType,
      locationName: locationName,
      address: address,
      latitude: latitude,
      longitude: longitude,
      scheduledAt: scheduledAt,
      arrivedAt: arrivedAt ?? this.arrivedAt,
      departedAt: departedAt ?? this.departedAt,
      notes: notes ?? this.notes,
    );
  }
}

class CharterAssignmentModel {
  final String id;
  final String charterTripId;
  final dynamic vehicleId;
  final String vehicleUnitNumber;
  final String plateNumber;
  final String driverId;
  final String driverName;
  final String driverPhone;
  final String attendantId;
  final String attendantName;
  final String attendantPhone;
  final String driverPayOption;
  final double driverPayRate;
  final double driverEiHours;
  final String attendantPayOption;
  final double attendantPayRate;
  final double attendantEiHours;
  final int status; // 0 = Pending, 1 = Checked In, 2 = Checked Out, 3 = Cancelled
  final bool isDriverCheckedIn;
  final String? driverCheckedInAt;
  final bool isDriverCheckedOut;
  final String? driverCheckedOutAt;
  final String? driverPayrollComments;
  final bool isAttendantCheckedIn;
  final String? attendantCheckedInAt;
  final bool isAttendantCheckedOut;
  final String? attendantCheckedOutAt;
  final String? attendantPayrollComments;
  final String? notes;

  const CharterAssignmentModel({
    required this.id,
    required this.charterTripId,
    required this.vehicleId,
    required this.vehicleUnitNumber,
    required this.plateNumber,
    required this.driverId,
    required this.driverName,
    this.driverPhone = '',
    this.attendantId = '',
    this.attendantName = '',
    this.attendantPhone = '',
    this.driverPayOption = 'STANDARD',
    this.driverPayRate = 0.0,
    this.driverEiHours = 0.0,
    this.attendantPayOption = 'STANDARD',
    this.attendantPayRate = 0.0,
    this.attendantEiHours = 0.0,
    this.status = 0,
    this.isDriverCheckedIn = false,
    this.driverCheckedInAt,
    this.isDriverCheckedOut = false,
    this.driverCheckedOutAt,
    this.driverPayrollComments,
    this.isAttendantCheckedIn = false,
    this.attendantCheckedInAt,
    this.isAttendantCheckedOut = false,
    this.attendantCheckedOutAt,
    this.attendantPayrollComments,
    this.notes,
  });

  bool matchesUser(String employeeId, String username) {
    final cleanEmp = employeeId.trim().toLowerCase();
    final cleanUser = username.trim().toLowerCase();
    final dId = driverId.trim().toLowerCase();
    final dName = driverName.trim().toLowerCase();
    final aId = attendantId.trim().toLowerCase();
    final aName = attendantName.trim().toLowerCase();

    return (cleanEmp.isNotEmpty && (dId == cleanEmp || aId == cleanEmp)) ||
        (cleanUser.isNotEmpty && (dName == cleanUser || aName == cleanUser || dName.contains(cleanUser) || cleanUser.contains(dName)));
  }

  bool isUserDriver(String employeeId, String username) {
    final cleanEmp = employeeId.trim().toLowerCase();
    final cleanUser = username.trim().toLowerCase();
    final dId = driverId.trim().toLowerCase();
    final dName = driverName.trim().toLowerCase();

    return (cleanEmp.isNotEmpty && dId == cleanEmp) ||
        (cleanUser.isNotEmpty && (dName == cleanUser || dName.contains(cleanUser) || cleanUser.contains(dName)));
  }

  factory CharterAssignmentModel.fromMap(Map<String, dynamic> map, {String tripId = ''}) {
    return CharterAssignmentModel(
      id: map['id']?.toString() ?? '',
      charterTripId: map['charterTripId']?.toString() ?? tripId,
      vehicleId: map['vehicleId'] ?? 0,
      vehicleUnitNumber: map['vehicleUnitNumber']?.toString() ?? '',
      plateNumber: map['plateNumber']?.toString() ?? '',
      driverId: map['driverId']?.toString() ?? '',
      driverName: map['driverName']?.toString() ?? '',
      driverPhone: map['driverPhone']?.toString() ?? '',
      attendantId: map['attendantId']?.toString() ?? '',
      attendantName: map['attendantName']?.toString() ?? '',
      attendantPhone: map['attendantPhone']?.toString() ?? '',
      driverPayOption: map['driverPayOption']?.toString() ?? 'STANDARD',
      driverPayRate: (map['driverPayRate'] as num?)?.toDouble() ?? 0.0,
      driverEiHours: (map['driverEiHours'] as num?)?.toDouble() ?? 0.0,
      attendantPayOption: map['attendantPayOption']?.toString() ?? 'STANDARD',
      attendantPayRate: (map['attendantPayRate'] as num?)?.toDouble() ?? 0.0,
      attendantEiHours: (map['attendantEiHours'] as num?)?.toDouble() ?? 0.0,
      status: (map['status'] as num?)?.toInt() ?? 0,
      isDriverCheckedIn: map['isDriverCheckedIn'] as bool? ?? false,
      driverCheckedInAt: map['driverCheckedInAt']?.toString(),
      isDriverCheckedOut: map['isDriverCheckedOut'] as bool? ?? false,
      driverCheckedOutAt: map['driverCheckedOutAt']?.toString(),
      driverPayrollComments: map['driverPayrollComments']?.toString(),
      isAttendantCheckedIn: map['isAttendantCheckedIn'] as bool? ?? false,
      attendantCheckedInAt: map['attendantCheckedInAt']?.toString(),
      isAttendantCheckedOut: map['isAttendantCheckedOut'] as bool? ?? false,
      attendantCheckedOutAt: map['attendantCheckedOutAt']?.toString(),
      attendantPayrollComments: map['attendantPayrollComments']?.toString(),
      notes: map['notes']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'charterTripId': charterTripId,
      'vehicleId': vehicleId,
      'vehicleUnitNumber': vehicleUnitNumber,
      'plateNumber': plateNumber,
      'driverId': driverId,
      'driverName': driverName,
      'driverPhone': driverPhone,
      'attendantId': attendantId,
      'attendantName': attendantName,
      'attendantPhone': attendantPhone,
      'driverPayOption': driverPayOption,
      'driverPayRate': driverPayRate,
      'driverEiHours': driverEiHours,
      'attendantPayOption': attendantPayOption,
      'attendantPayRate': attendantPayRate,
      'attendantEiHours': attendantEiHours,
      'status': status,
      'isDriverCheckedIn': isDriverCheckedIn,
      if (driverCheckedInAt != null) 'driverCheckedInAt': driverCheckedInAt,
      'isDriverCheckedOut': isDriverCheckedOut,
      if (driverCheckedOutAt != null) 'driverCheckedOutAt': driverCheckedOutAt,
      if (driverPayrollComments != null) 'driverPayrollComments': driverPayrollComments,
      'isAttendantCheckedIn': isAttendantCheckedIn,
      if (attendantCheckedInAt != null) 'attendantCheckedInAt': attendantCheckedInAt,
      'isAttendantCheckedOut': isAttendantCheckedOut,
      if (attendantCheckedOutAt != null) 'attendantCheckedOutAt': attendantCheckedOutAt,
      if (attendantPayrollComments != null) 'attendantPayrollComments': attendantPayrollComments,
      if (notes != null) 'notes': notes,
    };
  }
}

class CharterTripModel {
  final String id;
  final String tripNumber;
  final String charterClientId;
  final String clientName;
  final String title;
  final int tripType; // 0 = Field Trip, 1 = Athletic, 2 = Academic, 3 = Other
  final int status; // 0 = Draft, 1 = Confirmed, 2 = Assigned, 3 = In Progress, 4 = Completed, 5 = Cancelled
  final String dispatchDate;
  final String departsAt;
  final String returnsAt;
  final int passengerCount;
  final bool needsAttendant;
  final String? specialRequirements;
  final String? notes;
  final bool roundTrip;
  final List<CharterStopModel> stops;
  final List<CharterAssignmentModel> assignments;
  final String createdAt;
  final String updatedAt;

  const CharterTripModel({
    required this.id,
    required this.tripNumber,
    required this.charterClientId,
    required this.clientName,
    required this.title,
    this.tripType = 0,
    this.status = 0,
    required this.dispatchDate,
    required this.departsAt,
    required this.returnsAt,
    this.passengerCount = 0,
    this.needsAttendant = false,
    this.specialRequirements,
    this.notes,
    this.roundTrip = true,
    this.stops = const [],
    this.assignments = const [],
    this.createdAt = '',
    this.updatedAt = '',
  });

  String get tripTypeLabel {
    switch (tripType) {
      case 0:
        return 'Field Trip';
      case 1:
        return 'Athletic';
      case 2:
        return 'Academic';
      default:
        return 'Other';
    }
  }

  String get statusLabel {
    switch (status) {
      case 0:
        return 'Draft';
      case 1:
        return 'Confirmed';
      case 2:
        return 'Assigned';
      case 3:
        return 'In Progress';
      case 4:
        return 'Completed';
      case 5:
        return 'Cancelled';
      default:
        return 'Draft';
    }
  }

  CharterAssignmentModel? getAssignmentForUser(String employeeId, String username) {
    for (final assignment in assignments) {
      if (assignment.matchesUser(employeeId, username)) {
        return assignment;
      }
    }
    return null;
  }

  factory CharterTripModel.fromMap(Map<String, dynamic> map, String docId) {
    final rawStops = map['stops'] as List<dynamic>? ?? [];
    final stops = rawStops
        .map((s) => CharterStopModel.fromMap(Map<String, dynamic>.from(s as Map), tripId: docId))
        .toList()
      ..sort((a, b) => a.sequenceOrder.compareTo(b.sequenceOrder));

    final rawAssignments = map['assignments'] as List<dynamic>? ?? [];
    final assignments = rawAssignments
        .map((a) => CharterAssignmentModel.fromMap(Map<String, dynamic>.from(a as Map), tripId: docId))
        .toList();

    return CharterTripModel(
      id: docId.isNotEmpty ? docId : (map['id']?.toString() ?? ''),
      tripNumber: map['tripNumber']?.toString() ?? '',
      charterClientId: map['charterClientId']?.toString() ?? '',
      clientName: map['clientName']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      tripType: (map['tripType'] as num?)?.toInt() ?? 0,
      status: (map['status'] as num?)?.toInt() ?? 0,
      dispatchDate: map['dispatchDate']?.toString() ?? '',
      departsAt: map['departsAt']?.toString() ?? '',
      returnsAt: map['returnsAt']?.toString() ?? '',
      passengerCount: (map['passengerCount'] as num?)?.toInt() ?? 0,
      needsAttendant: map['needsAttendant'] as bool? ?? false,
      specialRequirements: map['specialRequirements']?.toString(),
      notes: map['notes']?.toString(),
      roundTrip: map['roundTrip'] as bool? ?? true,
      stops: stops,
      assignments: assignments,
      createdAt: map['createdAt']?.toString() ?? '',
      updatedAt: map['updatedAt']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'tripNumber': tripNumber,
      'charterClientId': charterClientId,
      'clientName': clientName,
      'title': title,
      'tripType': tripType,
      'status': status,
      'dispatchDate': dispatchDate,
      'departsAt': departsAt,
      'returnsAt': returnsAt,
      'passengerCount': passengerCount,
      'needsAttendant': needsAttendant,
      if (specialRequirements != null) 'specialRequirements': specialRequirements,
      if (notes != null) 'notes': notes,
      'roundTrip': roundTrip,
      'stops': stops.map((s) => s.toMap()).toList(),
      'assignments': assignments.map((a) => a.toMap()).toList(),
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}
