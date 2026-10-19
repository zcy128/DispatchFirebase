import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../repository/student_incident_repository.dart';
import 'student_incident_event.dart';
import 'student_incident_state.dart';

class StudentIncidentBloc
    extends Bloc<StudentIncidentEvent, StudentIncidentState> {
  final StudentIncidentRepository repository;

  StudentIncidentBloc({required this.repository})
      : super(const StudentIncidentInitial()) {
    on<LoadStudentIncidents>(_onLoadStudentIncidents);
    on<StudentIncidentsUpdated>(_onStudentIncidentsUpdated);
    on<SubmitStudentIncidentEvent>(_onSubmitStudentIncident);
  }

  Future<void> _onLoadStudentIncidents(
    LoadStudentIncidents event,
    Emitter<StudentIncidentState> emit,
  ) async {
    emit(const StudentIncidentLoading());
    try {
      final reports = await repository.getStudentIncidents(
        driverId: event.driverId,
        studentId: event.studentId,
        routeNo: event.routeNo,
      );
      emit(StudentIncidentLoaded(reports: reports));
    } catch (e) {
      emit(StudentIncidentOperationFailure(e.toString()));
    }
  }

  void _onStudentIncidentsUpdated(
    StudentIncidentsUpdated event,
    Emitter<StudentIncidentState> emit,
  ) {
    emit(StudentIncidentLoaded(reports: event.reports));
  }

  Future<void> _onSubmitStudentIncident(
    SubmitStudentIncidentEvent event,
    Emitter<StudentIncidentState> emit,
  ) async {
    emit(const StudentIncidentSubmitting());
    try {
      final saved = await repository.submitStudentIncident(event.report);
      emit(StudentIncidentSubmitSuccess(saved));

      // Reload list for driver
      final updatedList = await repository.getStudentIncidents(
        driverId: event.report.driverId,
      );
      emit(StudentIncidentLoaded(reports: updatedList));
    } catch (e) {
      emit(StudentIncidentSubmitFailure(e.toString()));
    }
  }
}
