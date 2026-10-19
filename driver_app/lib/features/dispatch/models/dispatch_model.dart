import 'dart:convert';
import 'package:equatable/equatable.dart';

class StudentAttendance extends Equatable {
  final int studentId;
  final String studentNo;
  final String studentName;
  final String grade;
  final String homeAddress;
  final String schoolName;
  final String pickupStatus; // 'pending' | 'picked_up' | 'absent'
  final String dropoffStatus; // 'pending' | 'dropped_off' | 'bypassed_absent'
  final String? pickupTime;
  final String? dropoffTime;
  final String? notes;

  const StudentAttendance({
    required this.studentId,
    required this.studentNo,
    required this.studentName,
    required this.grade,
    required this.homeAddress,
    required this.schoolName,
    this.pickupStatus = 'pending',
    this.dropoffStatus = 'pending',
    this.pickupTime,
    this.dropoffTime,
    this.notes,
  });

  bool get isPickedUp => pickupStatus == 'picked_up';
  bool get isAbsent => pickupStatus == 'absent';
  bool get isDroppedOff => dropoffStatus == 'dropped_off';
  bool get isBypassedAbsent => dropoffStatus == 'bypassed_absent';
  bool get isParentReportedAbsent => isAbsent && notes != null && notes!.isNotEmpty;

  StudentAttendance copyWith({
    int? studentId,
    String? studentNo,
    String? studentName,
    String? grade,
    String? homeAddress,
    String? schoolName,
    String? pickupStatus,
    String? dropoffStatus,
    String? pickupTime,
    String? dropoffTime,
    String? notes,
  }) {
    return StudentAttendance(
      studentId: studentId ?? this.studentId,
      studentNo: studentNo ?? this.studentNo,
      studentName: studentName ?? this.studentName,
      grade: grade ?? this.grade,
      homeAddress: homeAddress ?? this.homeAddress,
      schoolName: schoolName ?? this.schoolName,
      pickupStatus: pickupStatus ?? this.pickupStatus,
      dropoffStatus: dropoffStatus ?? this.dropoffStatus,
      pickupTime: pickupTime ?? this.pickupTime,
      dropoffTime: dropoffTime ?? this.dropoffTime,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'studentId': studentId,
      'studentNo': studentNo,
      'studentName': studentName,
      'grade': grade,
      'homeAddress': homeAddress,
      'schoolName': schoolName,
      'pickupStatus': pickupStatus,
      'dropoffStatus': dropoffStatus,
      'pickupTime': pickupTime,
      'dropoffTime': dropoffTime,
      'notes': notes,
    };
  }

  factory StudentAttendance.fromMap(Map<String, dynamic> map) {
    return StudentAttendance(
      studentId: map['studentId'] as int? ?? 0,
      studentNo: map['studentNo'] as String? ?? '',
      studentName: map['studentName'] as String? ?? '',
      grade: map['grade'] as String? ?? '',
      homeAddress: map['homeAddress'] as String? ?? '',
      schoolName: map['schoolName'] as String? ?? '',
      pickupStatus: map['pickupStatus'] as String? ?? 'pending',
      dropoffStatus: map['dropoffStatus'] as String? ?? 'pending',
      pickupTime: map['pickupTime'] as String?,
      dropoffTime: map['dropoffTime'] as String?,
      notes: map['notes'] as String?,
    );
  }

  @override
  List<Object?> get props => [
        studentId,
        studentNo,
        studentName,
        grade,
        homeAddress,
        schoolName,
        pickupStatus,
        dropoffStatus,
        pickupTime,
        dropoffTime,
        notes,
      ];
}

class DispatchStop extends Equatable {
  final int stopId;
  final int sequence;
  final String stopLocation;
  final String stopType; // 'home_pickup' | 'school_dropoff' | 'school_pickup' | 'home_dropoff'
  final bool isSchoolStop;
  final String? schoolName;
  final String plannedTime;
  final String? arrivedTime;
  final bool isArrived;
  final List<StudentAttendance> students;

  const DispatchStop({
    required this.stopId,
    required this.sequence,
    required this.stopLocation,
    required this.stopType,
    required this.isSchoolStop,
    this.schoolName,
    required this.plannedTime,
    this.arrivedTime,
    this.isArrived = false,
    required this.students,
  });

  DispatchStop copyWith({
    int? stopId,
    int? sequence,
    String? stopLocation,
    String? stopType,
    bool? isSchoolStop,
    String? schoolName,
    String? plannedTime,
    String? arrivedTime,
    bool? isArrived,
    List<StudentAttendance>? students,
  }) {
    return DispatchStop(
      stopId: stopId ?? this.stopId,
      sequence: sequence ?? this.sequence,
      stopLocation: stopLocation ?? this.stopLocation,
      stopType: stopType ?? this.stopType,
      isSchoolStop: isSchoolStop ?? this.isSchoolStop,
      schoolName: schoolName ?? this.schoolName,
      plannedTime: plannedTime ?? this.plannedTime,
      arrivedTime: arrivedTime ?? this.arrivedTime,
      isArrived: isArrived ?? this.isArrived,
      students: students ?? this.students,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'stopId': stopId,
      'sequence': sequence,
      'stopLocation': stopLocation,
      'stopType': stopType,
      'isSchoolStop': isSchoolStop,
      'schoolName': schoolName,
      'plannedTime': plannedTime,
      'arrivedTime': arrivedTime,
      'isArrived': isArrived,
      'students': students.map((s) => s.toMap()).toList(),
    };
  }

  factory DispatchStop.fromMap(Map<String, dynamic> map) {
    return DispatchStop(
      stopId: map['stopId'] as int? ?? 0,
      sequence: map['sequence'] as int? ?? 0,
      stopLocation: map['stopLocation'] as String? ?? '',
      stopType: map['stopType'] as String? ?? 'home_pickup',
      isSchoolStop: map['isSchoolStop'] as bool? ?? false,
      schoolName: map['schoolName'] as String?,
      plannedTime: map['plannedTime'] as String? ?? '',
      arrivedTime: map['arrivedTime'] as String?,
      isArrived: map['isArrived'] as bool? ?? false,
      students: (map['students'] as List<dynamic>?)
              ?.map((item) => StudentAttendance.fromMap(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  @override
  List<Object?> get props => [
        stopId,
        sequence,
        stopLocation,
        stopType,
        isSchoolStop,
        schoolName,
        plannedTime,
        arrivedTime,
        isArrived,
        students,
      ];
}

class DispatchRecord extends Equatable {
  final String id;
  final String date; // yyyy-MM-dd
  final String routeId;
  final String routeNo;
  final String routeName;
  final String shiftType; // 'AM' | 'PM'
  final String driverId;
  final String driverName;
  final String? attendantName;
  final String? attendantPhone;
  final String? attendantStatus; // 'online' | 'offline'
  final String? attendantLastActive;
  final String vehicleUnit;
  final String yardName;
  final String status; // 'scheduled' | 'in_progress' | 'completed'
  final String? checkInTime;
  final String? checkOutTime;
  final double payrollRate;
  final String payOption; // 'STANDARD' | 'PD' | 'DD' | 'NP' | 'F'
  final String? driverCheckoutComments;
  final List<DispatchStop> stops;

  const DispatchRecord({
    required this.id,
    required this.date,
    required this.routeId,
    required this.routeNo,
    required this.routeName,
    required this.shiftType,
    required this.driverId,
    required this.driverName,
    this.attendantName,
    this.attendantPhone,
    this.attendantStatus,
    this.attendantLastActive,
    required this.vehicleUnit,
    this.yardName = 'Yard 1 (East Campus)',
    this.status = 'scheduled',
    this.checkInTime,
    this.checkOutTime,
    this.payrollRate = 28.50,
    this.payOption = 'STANDARD',
    this.driverCheckoutComments,
    required this.stops,
  });

  bool get isCheckedIn => checkInTime != null && status != 'scheduled';
  bool get isCheckedOut => checkOutTime != null || status == 'completed';
  bool get isInProgress => status == 'in_progress' && !isCheckedOut;

  int get totalStudents {
    final ids = <int>{};
    for (final stop in stops) {
      for (final s in stop.students) {
        ids.add(s.studentId);
      }
    }
    return ids.length;
  }

  int get totalStops => stops.length;

  int get completedStopsCount => stops.where((s) => s.isArrived).length;

  List<StudentAttendance> get allStudents =>
      stops.expand((s) => s.students).toList();

  DispatchRecord copyWith({
    String? id,
    String? date,
    String? routeId,
    String? routeNo,
    String? routeName,
    String? shiftType,
    String? driverId,
    String? driverName,
    String? attendantName,
    String? attendantPhone,
    String? attendantStatus,
    String? attendantLastActive,
    String? vehicleUnit,
    String? yardName,
    String? status,
    String? checkInTime,
    String? checkOutTime,
    double? payrollRate,
    String? payOption,
    String? driverCheckoutComments,
    List<DispatchStop>? stops,
  }) {
    return DispatchRecord(
      id: id ?? this.id,
      date: date ?? this.date,
      routeId: routeId ?? this.routeId,
      routeNo: routeNo ?? this.routeNo,
      routeName: routeName ?? this.routeName,
      shiftType: shiftType ?? this.shiftType,
      driverId: driverId ?? this.driverId,
      driverName: driverName ?? this.driverName,
      attendantName: attendantName ?? this.attendantName,
      attendantPhone: attendantPhone ?? this.attendantPhone,
      attendantStatus: attendantStatus ?? this.attendantStatus,
      attendantLastActive: attendantLastActive ?? this.attendantLastActive,
      vehicleUnit: vehicleUnit ?? this.vehicleUnit,
      yardName: yardName ?? this.yardName,
      status: status ?? this.status,
      checkInTime: checkInTime ?? this.checkInTime,
      checkOutTime: checkOutTime ?? this.checkOutTime,
      payrollRate: payrollRate ?? this.payrollRate,
      payOption: payOption ?? this.payOption,
      driverCheckoutComments: driverCheckoutComments ?? this.driverCheckoutComments,
      stops: stops ?? this.stops,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'date': date,
      'routeId': routeId,
      'routeNo': routeNo,
      'routeName': routeName,
      'shiftType': shiftType,
      'driverId': driverId,
      'driverName': driverName,
      'attendantName': attendantName,
      'attendantPhone': attendantPhone,
      'attendantStatus': attendantStatus,
      'attendantLastActive': attendantLastActive,
      'vehicleUnit': vehicleUnit,
      'yardName': yardName,
      'status': status,
      'checkInTime': checkInTime,
      'checkOutTime': checkOutTime,
      'payrollRate': payrollRate,
      'payOption': payOption,
      'driverCheckoutComments': driverCheckoutComments,
      'stops': stops.map((s) => s.toMap()).toList(),
    };
  }

  factory DispatchRecord.fromMap(Map<String, dynamic> map) {
    return DispatchRecord(
      id: map['id'] as String? ?? '',
      date: map['date'] as String? ?? '',
      routeId: map['routeId'] as String? ?? '',
      routeNo: map['routeNo'] as String? ?? '',
      routeName: map['routeName'] as String? ?? '',
      shiftType: map['shiftType'] as String? ?? 'AM',
      driverId: map['driverId'] as String? ?? '',
      driverName: map['driverName'] as String? ?? '',
      attendantName: map['attendantName'] as String?,
      attendantPhone: map['attendantPhone'] as String?,
      attendantStatus: map['attendantStatus'] as String?,
      attendantLastActive: map['attendantLastActive'] as String?,
      vehicleUnit: map['vehicleUnit'] as String? ?? '',
      yardName: map['yardName'] as String? ?? 'Yard 1 (East Campus)',
      status: map['status'] as String? ?? 'scheduled',
      checkInTime: map['checkInTime'] as String?,
      checkOutTime: map['checkOutTime'] as String?,
      payrollRate: (map['payrollRate'] is num)
          ? (map['payrollRate'] as num).toDouble()
          : (double.tryParse(map['payrollRate']?.toString() ?? '') ?? 28.50),
      payOption: map['payOption'] as String? ?? 'STANDARD',
      driverCheckoutComments: map['driverCheckoutComments'] as String?,
      stops: (map['stops'] as List<dynamic>?)
              ?.map((item) => DispatchStop.fromMap(item as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  String toJson() => json.encode(toMap());

  factory DispatchRecord.fromJson(String source) =>
      DispatchRecord.fromMap(json.decode(source) as Map<String, dynamic>);

  @override
  List<Object?> get props => [
        id,
        date,
        routeId,
        routeNo,
        routeName,
        shiftType,
        driverId,
        driverName,
        attendantName,
        attendantPhone,
        attendantStatus,
        attendantLastActive,
        vehicleUnit,
        yardName,
        status,
        checkInTime,
        checkOutTime,
        payrollRate,
        payOption,
        driverCheckoutComments,
        stops,
      ];
}

