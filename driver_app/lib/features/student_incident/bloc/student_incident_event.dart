import 'package:equatable/equatable.dart';
import '../models/student_incident_model.dart';

abstract class StudentIncidentEvent extends Equatable {
  const StudentIncidentEvent();

  @override
  List<Object?> get props => [];
}

class LoadStudentIncidents extends StudentIncidentEvent {
  final String? driverId;
  final int? studentId;
  final String? routeNo;

  const LoadStudentIncidents({this.driverId, this.studentId, this.routeNo});

  @override
  List<Object?> get props => [driverId, studentId, routeNo];
}

class StudentIncidentsUpdated extends StudentIncidentEvent {
  final List<StudentIncident> reports;

  const StudentIncidentsUpdated(this.reports);

  @override
  List<Object?> get props => [reports];
}

class SubmitStudentIncidentEvent extends StudentIncidentEvent {
  final StudentIncident report;

  const SubmitStudentIncidentEvent(this.report);

  @override
  List<Object?> get props => [report];
}
