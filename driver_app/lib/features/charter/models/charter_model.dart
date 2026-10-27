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
        return 'Dropoff';
      case 2:
        return 'Return Dropoff';
      case 3:
        return 'Return Pickup';
      default:
        return 'Stop';
    }
  }

  static String extractTimeOnly(String? raw) {
    final v = (raw ?? '').trim();
    if (v.isEmpty) return '';
    if (RegExp(r'^\d{1,2}:\d{2}').hasMatch(v)) {
      return v.substring(0, v.indexOf(':') + 3);
    }
    final normalized = v.replaceAll('T', ' ');
    final parts = normalized.split(' ');
    for (final p in parts) {
      if (RegExp(r'^\d{1,2}:\d{2}').hasMatch(p)) {
        return p.substring(0, p.indexOf(':') + 3);
      }
    }
    return v;
  }

  static String addMinutesToTime(String hhmm, int minutes) {
    final clean = extractTimeOnly(hhmm);
    final parts = clean.split(':');
    if (parts.length < 2) return clean;
    final h = int.tryParse(parts[0]) ?? 8;
    final m = int.tryParse(parts[1]) ?? 0;
    final total = h * 60 + m + minutes;
    final nh = (total ~/ 60) % 24;
    final nm = total % 60;
    return '${nh.toString().padLeft(2, '0')}:${nm.toString().padLeft(2, '0')}';
  }

  static List<CharterStopModel> normalizeRoundTripStops(
    List<CharterStopModel> stops, {
    required String tripId,
    required String departsAt,
    required String returnsAt,
    bool roundTrip = true,
  }) {
    if (!roundTrip || stops.length != 3) return stops;
    final s0 = stops[0];
    final s1 = stops[1];
    final s2 = stops[2];
    final addr0 = s0.address.trim().isNotEmpty
        ? s0.address.trim()
        : (s0.locationName.trim().isNotEmpty ? s0.locationName.trim() : 'School');
    final addr1 = s1.address.trim().isNotEmpty
        ? s1.address.trim()
        : (s1.locationName.trim().isNotEmpty ? s1.locationName.trim() : 'Museum');
    final addr3 = s2.address.trim().isNotEmpty ? s2.address.trim() : addr0;

    final depClean = extractTimeOnly(departsAt).isNotEmpty ? extractTimeOnly(departsAt) : '08:00';
    final retClean = extractTimeOnly(returnsAt).isNotEmpty ? extractTimeOnly(returnsAt) : '15:00';

    final t0 = extractTimeOnly(s0.scheduledAt).isNotEmpty ? extractTimeOnly(s0.scheduledAt) : depClean;
    final t1 = addMinutesToTime(t0, 30);
    final t2 = extractTimeOnly(s2.scheduledAt).isNotEmpty ? extractTimeOnly(s2.scheduledAt) : retClean;
    final t3 = addMinutesToTime(t2, 30);

    return [
      CharterStopModel(
        id: s0.id.isNotEmpty ? s0.id : 'stop-1',
        charterTripId: tripId,
        sequenceOrder: 1,
        stopType: 0,
        locationName: 'Pickup: $addr0',
        address: addr0,
        scheduledAt: t0,
        arrivedAt: s0.arrivedAt,
        departedAt: s0.departedAt,
        notes: s0.notes,
      ),
      CharterStopModel(
        id: s1.id.isNotEmpty ? s1.id : 'stop-2',
        charterTripId: tripId,
        sequenceOrder: 2,
        stopType: 1,
        locationName: 'Dropoff: $addr1',
        address: addr1,
        scheduledAt: t1,
        arrivedAt: s1.arrivedAt,
        departedAt: s1.departedAt,
        notes: s1.notes,
      ),
      CharterStopModel(
        id: 'stop-3',
        charterTripId: tripId,
        sequenceOrder: 3,
        stopType: 3,
        locationName: 'Return Pickup: $addr1',
        address: addr1,
        scheduledAt: t2,
      ),
      CharterStopModel(
        id: s2.id.isNotEmpty && s2.id != 'stop-3' ? s2.id : 'stop-4',
        charterTripId: tripId,
        sequenceOrder: 4,
        stopType: 2,
        locationName: 'Return Dropoff: $addr3',
        address: addr3,
        scheduledAt: t3,
        arrivedAt: s2.arrivedAt,
        departedAt: s2.departedAt,
        notes: s2.notes,
      ),
    ];
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
  final int? runNumber;
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
  final List<CharterStopModel> stops;
  final String? notes;

  const CharterAssignmentModel({
    required this.id,
    required this.charterTripId,
    this.runNumber,
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
    this.stops = const [],
    this.notes,
  });

  bool get hasDriverAssigned {
    final dId = driverId.trim().toLowerCase();
    final dName = driverName.trim().toLowerCase();
    final hasValidId = dId.isNotEmpty && dId != '0' && dId != 'tbd' && dId != 'unassigned';
    final hasValidName = dName.isNotEmpty && dName != 'tbd' && dName != 'unassigned' && dName != 'non assigné';
    return hasValidId || hasValidName;
  }

  bool get hasAttendantAssigned {
    final aId = attendantId.trim().toLowerCase();
    final aName = attendantName.trim().toLowerCase();
    final hasValidId = aId.isNotEmpty && aId != '0' && aId != 'tbd' && aId != 'unassigned';
    final hasValidName = aName.isNotEmpty && aName != 'tbd' && aName != 'unassigned' && aName != 'non assigné';
    return hasValidId || hasValidName;
  }

  bool matchesUser(String employeeId, String username) {
    return isUserDriver(employeeId, username) || isUserAttendant(employeeId, username);
  }

  bool isUserDriver(String employeeId, String username) {
    if (!hasDriverAssigned) return false;
    final cleanEmp = employeeId.trim().toLowerCase();
    final cleanUser = username.trim().toLowerCase();
    final dId = driverId.trim().toLowerCase();
    final dName = driverName.trim().toLowerCase();

    final matchesId = cleanEmp.isNotEmpty && dId.isNotEmpty && dId == cleanEmp;
    final matchesName = cleanUser.isNotEmpty &&
        dName.isNotEmpty &&
        dName != 'tbd' &&
        dName != 'unassigned' &&
        (dName == cleanUser || dName.contains(cleanUser) || cleanUser.contains(dName));

    return matchesId || matchesName;
  }

  bool isUserAttendant(String employeeId, String username) {
    if (!hasAttendantAssigned) return false;
    final cleanEmp = employeeId.trim().toLowerCase();
    final cleanUser = username.trim().toLowerCase();
    final aId = attendantId.trim().toLowerCase();
    final aName = attendantName.trim().toLowerCase();

    final matchesId = cleanEmp.isNotEmpty && aId.isNotEmpty && aId == cleanEmp;
    final matchesName = cleanUser.isNotEmpty &&
        aName.isNotEmpty &&
        aName != 'tbd' &&
        aName != 'unassigned' &&
        (aName == cleanUser || aName.contains(cleanUser) || cleanUser.contains(aName));

    return matchesId || matchesName;
  }

  factory CharterAssignmentModel.fromMap(Map<String, dynamic> map, {String tripId = ''}) {
    final rawStops = map['stops'] as List<dynamic>? ?? [];
    final parsedStops = rawStops
        .whereType<Map>()
        .map((s) => CharterStopModel.fromMap(Map<String, dynamic>.from(s), tripId: tripId))
        .toList()
      ..sort((a, b) => a.sequenceOrder.compareTo(b.sequenceOrder));

    return CharterAssignmentModel(
      id: map['id']?.toString() ?? '',
      charterTripId: map['charterTripId']?.toString() ?? tripId,
      runNumber: (map['runNumber'] as num?)?.toInt(),
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
      stops: parsedStops,
      notes: map['notes']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'charterTripId': charterTripId,
      if (runNumber != null) 'runNumber': runNumber,
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
      if (stops.isNotEmpty) 'stops': stops.map((s) => s.toMap()).toList(),
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
  final int vehiclesNeeded;
  final bool needsAttendant;
  final double billableHours;
  final double driverPayRate;
  final double attendantPayRate;
  final String? specialRequirements;
  final String? notes;
  final bool roundTrip;
  final List<CharterStopModel> stops;
  final List<CharterAssignmentModel> assignments;
  final List<String> assignedEmployeeIds;
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
    this.vehiclesNeeded = 1,
    this.needsAttendant = false,
    this.billableHours = 5.0,
    this.driverPayRate = 150.0,
    this.attendantPayRate = 100.0,
    this.specialRequirements,
    this.notes,
    this.roundTrip = true,
    this.stops = const [],
    this.assignments = const [],
    this.assignedEmployeeIds = const [],
    this.createdAt = '',
    this.updatedAt = '',
  });

  static List<String> extractAssignedEmployeeIds(List<CharterAssignmentModel> assignments) {
    final set = <String>{};
    for (final asg in assignments) {
      final dId = asg.driverId.trim();
      if (dId.isNotEmpty && dId != '0' && dId.toLowerCase() != 'tbd' && dId.toLowerCase() != 'unassigned') {
        set.add(dId);
        set.add(dId.toLowerCase());
      }
      final dName = asg.driverName.trim();
      if (dName.isNotEmpty && dName.toLowerCase() != 'tbd' && dName.toLowerCase() != 'unassigned' && dName.toLowerCase() != 'non assigné') {
        set.add(dName);
        set.add(dName.toLowerCase());
      }
      final aId = asg.attendantId.trim();
      if (aId.isNotEmpty && aId != '0' && aId.toLowerCase() != 'tbd' && aId.toLowerCase() != 'unassigned') {
        set.add(aId);
        set.add(aId.toLowerCase());
      }
      final aName = asg.attendantName.trim();
      if (aName.isNotEmpty && aName.toLowerCase() != 'tbd' && aName.toLowerCase() != 'unassigned' && aName.toLowerCase() != 'non assigné') {
        set.add(aName);
        set.add(aName.toLowerCase());
      }
    }
    return set.toList();
  }

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

  List<CharterStopModel> effectiveStopsForAssignment(String? assignmentId) {
    if (assignmentId != null && assignmentId.isNotEmpty) {
      for (final a in assignments) {
        if (a.id == assignmentId && a.stops.isNotEmpty) {
          return a.stops;
        }
      }
    }
    return stops;
  }

  factory CharterTripModel.fromMap(Map<String, dynamic> map, String docId) {
    final resolvedId = docId.isNotEmpty ? docId : (map['id']?.toString() ?? '');
    final departsAtStr = map['departsAt']?.toString() ?? '08:00';
    final returnsAtStr = map['returnsAt']?.toString() ?? '15:00';
    final isRoundTrip = map['roundTrip'] as bool? ?? true;

    final rawStops = map['stops'] as List<dynamic>? ?? [];
    final parsedStops = rawStops
        .whereType<Map>()
        .map((s) => CharterStopModel.fromMap(Map<String, dynamic>.from(s), tripId: resolvedId))
        .toList()
      ..sort((a, b) => a.sequenceOrder.compareTo(b.sequenceOrder));

    final stops = CharterStopModel.normalizeRoundTripStops(
      parsedStops,
      tripId: resolvedId,
      departsAt: departsAtStr,
      returnsAt: returnsAtStr,
      roundTrip: isRoundTrip,
    );

    final rawAssignments = map['assignments'] as List<dynamic>? ?? [];
    final assignments = rawAssignments
        .whereType<Map>()
        .map((a) {
          final asg = CharterAssignmentModel.fromMap(Map<String, dynamic>.from(a), tripId: resolvedId);
          if (asg.stops.length == 3 && isRoundTrip) {
            return CharterAssignmentModel(
              id: asg.id,
              charterTripId: asg.charterTripId,
              runNumber: asg.runNumber,
              vehicleId: asg.vehicleId,
              vehicleUnitNumber: asg.vehicleUnitNumber,
              plateNumber: asg.plateNumber,
              driverId: asg.driverId,
              driverName: asg.driverName,
              driverPhone: asg.driverPhone,
              attendantId: asg.attendantId,
              attendantName: asg.attendantName,
              attendantPhone: asg.attendantPhone,
              driverPayOption: asg.driverPayOption,
              driverPayRate: asg.driverPayRate,
              driverEiHours: asg.driverEiHours,
              attendantPayOption: asg.attendantPayOption,
              attendantPayRate: asg.attendantPayRate,
              attendantEiHours: asg.attendantEiHours,
              status: asg.status,
              isDriverCheckedIn: asg.isDriverCheckedIn,
              driverCheckedInAt: asg.driverCheckedInAt,
              isDriverCheckedOut: asg.isDriverCheckedOut,
              driverCheckedOutAt: asg.driverCheckedOutAt,
              driverPayrollComments: asg.driverPayrollComments,
              isAttendantCheckedIn: asg.isAttendantCheckedIn,
              attendantCheckedInAt: asg.attendantCheckedInAt,
              isAttendantCheckedOut: asg.isAttendantCheckedOut,
              attendantCheckedOutAt: asg.attendantCheckedOutAt,
              attendantPayrollComments: asg.attendantPayrollComments,
              stops: CharterStopModel.normalizeRoundTripStops(
                asg.stops,
                tripId: resolvedId,
                departsAt: departsAtStr,
                returnsAt: returnsAtStr,
                roundTrip: isRoundTrip,
              ),
              notes: asg.notes,
            );
          }
          return asg;
        })
        .toList();

    return CharterTripModel(
      id: resolvedId,
      tripNumber: map['tripNumber']?.toString() ?? '',
      charterClientId: map['charterClientId']?.toString() ?? '',
      clientName: map['clientName']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      tripType: (map['tripType'] as num?)?.toInt() ?? 0,
      status: (map['status'] as num?)?.toInt() ?? 0,
      dispatchDate: map['dispatchDate']?.toString() ?? '',
      departsAt: departsAtStr,
      returnsAt: returnsAtStr,
      passengerCount: (map['passengerCount'] as num?)?.toInt() ?? 0,
      vehiclesNeeded: (map['vehiclesNeeded'] as num?)?.toInt() ?? 1,
      needsAttendant: map['needsAttendant'] as bool? ?? false,
      billableHours: (map['billableHours'] as num?)?.toDouble() ?? 5.0,
      driverPayRate: (map['driverPayRate'] as num?)?.toDouble() ?? 150.0,
      attendantPayRate: (map['attendantPayRate'] as num?)?.toDouble() ?? 100.0,
      specialRequirements: map['specialRequirements']?.toString(),
      notes: map['notes']?.toString(),
      roundTrip: isRoundTrip,
      stops: stops,
      assignments: assignments,
      assignedEmployeeIds: (map['assignedEmployeeIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          extractAssignedEmployeeIds(assignments),
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
      'vehiclesNeeded': vehiclesNeeded,
      'needsAttendant': needsAttendant,
      'billableHours': billableHours,
      'driverPayRate': driverPayRate,
      'attendantPayRate': attendantPayRate,
      if (specialRequirements != null) 'specialRequirements': specialRequirements,
      if (notes != null) 'notes': notes,
      'roundTrip': roundTrip,
      'stops': stops.map((s) => s.toMap()).toList(),
      'assignments': assignments.map((a) => a.toMap()).toList(),
      'assignedEmployeeIds': assignedEmployeeIds.isNotEmpty
          ? assignedEmployeeIds
          : extractAssignedEmployeeIds(assignments),
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}
