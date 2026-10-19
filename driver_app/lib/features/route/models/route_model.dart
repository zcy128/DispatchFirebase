import 'dart:convert';
import 'package:equatable/equatable.dart';

class DriverRouteStudent extends Equatable {
  final int studentId;
  final String studentNo;
  final String name;
  final String grade;
  final String schoolName;
  final String address;
  final String? guardianName;
  final String? guardianPhone;
  final String? specialNeeds;

  const DriverRouteStudent({
    required this.studentId,
    required this.studentNo,
    required this.name,
    required this.grade,
    required this.schoolName,
    required this.address,
    this.guardianName,
    this.guardianPhone,
    this.specialNeeds,
  });

  Map<String, dynamic> toMap() {
    return {
      'studentId': studentId,
      'studentNo': studentNo,
      'name': name,
      'grade': grade,
      'schoolName': schoolName,
      'address': address,
      'guardianName': guardianName,
      'guardianPhone': guardianPhone,
      'specialNeeds': specialNeeds,
    };
  }

  factory DriverRouteStudent.fromMap(Map<String, dynamic> map) {
    return DriverRouteStudent(
      studentId: map['studentId'] as int? ?? 0,
      studentNo: map['studentNo'] as String? ?? '',
      name: map['name'] as String? ?? '',
      grade: map['grade'] as String? ?? '',
      schoolName: map['schoolName'] as String? ?? '',
      address: map['address'] as String? ?? '',
      guardianName: map['guardianName'] as String?,
      guardianPhone: map['guardianPhone'] as String?,
      specialNeeds: map['specialNeeds'] as String?,
    );
  }

  @override
  List<Object?> get props => [
        studentId,
        studentNo,
        name,
        grade,
        schoolName,
        address,
        guardianName,
        guardianPhone,
        specialNeeds,
      ];
}

class DriverRouteStop extends Equatable {
  final int stopId;
  final int sequence;
  final String location;
  final String pullawayTime;
  final String stopType; // 'HomePickup' | 'SchoolDropoff' | 'SchoolPickup' | 'HomeDropoff'
  final bool isSchoolStop;
  final String? schoolName;
  final String? instruction;
  final double? latitude;
  final double? longitude;
  final List<DriverRouteStudent> students;

  const DriverRouteStop({
    required this.stopId,
    required this.sequence,
    required this.location,
    required this.pullawayTime,
    required this.stopType,
    required this.isSchoolStop,
    this.schoolName,
    this.instruction,
    this.latitude,
    this.longitude,
    required this.students,
  });

  Map<String, dynamic> toMap() {
    return {
      'stopId': stopId,
      'sequence': sequence,
      'location': location,
      'pullawayTime': pullawayTime,
      'stopType': stopType,
      'isSchoolStop': isSchoolStop,
      'schoolName': schoolName,
      'instruction': instruction,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      'students': students.map((s) => s.toMap()).toList(),
    };
  }

  factory DriverRouteStop.fromMap(Map<String, dynamic> map) {
    return DriverRouteStop(
      stopId: map['stopId'] as int? ?? 0,
      sequence: map['sequence'] as int? ?? 0,
      location: map['location'] as String? ?? '',
      pullawayTime: map['pullawayTime'] as String? ?? '',
      stopType: map['stopType'] as String? ?? 'HomePickup',
      isSchoolStop: map['isSchoolStop'] as bool? ?? false,
      schoolName: map['schoolName'] as String?,
      instruction: map['instruction'] as String?,
      latitude: (map['latitude'] as num?)?.toDouble(),
      longitude: (map['longitude'] as num?)?.toDouble(),
      students: (map['students'] as List<dynamic>?)
              ?.map((item) => DriverRouteStudent.fromMap(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  @override
  List<Object?> get props => [
        stopId,
        sequence,
        location,
        pullawayTime,
        stopType,
        isSchoolStop,
        schoolName,
        instruction,
        latitude,
        longitude,
        students,
      ];
}

class DriverRouteShift extends Equatable {
  final String shiftId;
  final String shiftType; // 'AM' | 'PM' | 'Midday'
  final String shiftName;
  final String runDays; // 'MTWRF'
  final String firstStopTime;
  final String lastStopTime;
  final String schoolsServiced;
  final List<DriverRouteStop> stops;

  const DriverRouteShift({
    required this.shiftId,
    required this.shiftType,
    required this.shiftName,
    required this.runDays,
    required this.firstStopTime,
    required this.lastStopTime,
    required this.schoolsServiced,
    required this.stops,
  });

  int get studentCount {
    final ids = <int>{};
    for (final st in stops) {
      for (final s in st.students) {
        ids.add(s.studentId);
      }
    }
    return ids.length;
  }

  int get stopCount => stops.length;

  Map<String, dynamic> toMap() {
    return {
      'shiftId': shiftId,
      'shiftType': shiftType,
      'shiftName': shiftName,
      'runDays': runDays,
      'firstStopTime': firstStopTime,
      'lastStopTime': lastStopTime,
      'schoolsServiced': schoolsServiced,
      'stops': stops.map((s) => s.toMap()).toList(),
    };
  }

  factory DriverRouteShift.fromMap(Map<String, dynamic> map) {
    return DriverRouteShift(
      shiftId: map['shiftId'] as String? ?? '',
      shiftType: map['shiftType'] as String? ?? 'AM',
      shiftName: map['shiftName'] as String? ?? '',
      runDays: map['runDays'] as String? ?? 'MTWRF',
      firstStopTime: map['firstStopTime'] as String? ?? '',
      lastStopTime: map['lastStopTime'] as String? ?? '',
      schoolsServiced: map['schoolsServiced'] as String? ?? '',
      stops: (map['stops'] as List<dynamic>?)
              ?.map((item) => DriverRouteStop.fromMap(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  @override
  List<Object?> get props => [
        shiftId,
        shiftType,
        shiftName,
        runDays,
        firstStopTime,
        lastStopTime,
        schoolsServiced,
        stops,
      ];
}

class DriverRouteInfo extends Equatable {
  final String id; // RT-001
  final String routeNo; // OCDSB-001
  final String routeName;
  final String schoolBoard; // OCDSB
  final String yardName;
  final String driverId;
  final String driverName;
  final String vehicleUnit;
  final String plateNumber;
  final String? attendantName;
  final String? attendantPhone;
  final String? attendantStatus; // 'online' | 'offline'
  final String? instructions;
  final List<DriverRouteShift> shifts;

  const DriverRouteInfo({
    required this.id,
    required this.routeNo,
    required this.routeName,
    required this.schoolBoard,
    required this.yardName,
    required this.driverId,
    required this.driverName,
    required this.vehicleUnit,
    required this.plateNumber,
    this.attendantName,
    this.attendantPhone,
    this.attendantStatus,
    this.instructions,
    required this.shifts,
  });

  int get totalStops {
    return shifts.fold(0, (sum, sh) => sum + sh.stopCount);
  }

  int get totalUniqueStudents {
    final ids = <int>{};
    for (final sh in shifts) {
      for (final st in sh.stops) {
        for (final s in st.students) {
          ids.add(s.studentId);
        }
      }
    }
    return ids.length;
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'routeNo': routeNo,
      'routeName': routeName,
      'schoolBoard': schoolBoard,
      'yardName': yardName,
      'driverId': driverId,
      'driverName': driverName,
      'vehicleUnit': vehicleUnit,
      'plateNumber': plateNumber,
      'attendantName': attendantName,
      'attendantPhone': attendantPhone,
      'attendantStatus': attendantStatus,
      'instructions': instructions,
      'shifts': shifts.map((s) => s.toMap()).toList(),
    };
  }

  factory DriverRouteInfo.fromMap(Map<String, dynamic> map) {
    return DriverRouteInfo(
      id: map['id'] as String? ?? '',
      routeNo: map['routeNo'] as String? ?? '',
      routeName: map['routeName'] as String? ?? '',
      schoolBoard: map['schoolBoard'] as String? ?? '',
      yardName: map['yardName'] as String? ?? '',
      driverId: map['driverId'] as String? ?? '',
      driverName: map['driverName'] as String? ?? '',
      vehicleUnit: map['vehicleUnit'] as String? ?? '',
      plateNumber: map['plateNumber'] as String? ?? '',
      attendantName: map['attendantName'] as String?,
      attendantPhone: map['attendantPhone'] as String?,
      attendantStatus: map['attendantStatus'] as String?,
      instructions: map['instructions'] as String?,
      shifts: (map['shifts'] as List<dynamic>?)
              ?.map((item) => DriverRouteShift.fromMap(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  String toJson() => json.encode(toMap());

  factory DriverRouteInfo.fromJson(String source) =>
      DriverRouteInfo.fromMap(json.decode(source) as Map<String, dynamic>);

  DriverRouteInfo copyWith({
    String? id,
    String? routeNo,
    String? routeName,
    String? schoolBoard,
    String? yardName,
    String? driverId,
    String? driverName,
    String? vehicleUnit,
    String? plateNumber,
    String? attendantName,
    String? attendantPhone,
    String? attendantStatus,
    String? instructions,
    List<DriverRouteShift>? shifts,
  }) {
    return DriverRouteInfo(
      id: id ?? this.id,
      routeNo: routeNo ?? this.routeNo,
      routeName: routeName ?? this.routeName,
      schoolBoard: schoolBoard ?? this.schoolBoard,
      yardName: yardName ?? this.yardName,
      driverId: driverId ?? this.driverId,
      driverName: driverName ?? this.driverName,
      vehicleUnit: vehicleUnit ?? this.vehicleUnit,
      plateNumber: plateNumber ?? this.plateNumber,
      attendantName: attendantName ?? this.attendantName,
      attendantPhone: attendantPhone ?? this.attendantPhone,
      attendantStatus: attendantStatus ?? this.attendantStatus,
      instructions: instructions ?? this.instructions,
      shifts: shifts ?? this.shifts,
    );
  }

  @override
  List<Object?> get props => [
        id,
        routeNo,
        routeName,
        schoolBoard,
        yardName,
        driverId,
        driverName,
        vehicleUnit,
        plateNumber,
        attendantName,
        attendantPhone,
        attendantStatus,
        instructions,
        shifts,
      ];

}
