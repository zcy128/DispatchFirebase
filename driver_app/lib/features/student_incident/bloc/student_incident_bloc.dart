import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/student_incident_model.dart';
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

  StudentIncidentLoaded? get _loaded =>
      state is StudentIncidentLoaded ? state as StudentIncidentLoaded : null;

  String _errorText(Object error) {
    final text = error.toString();
    const prefix = 'Exception: ';
    return text.startsWith(prefix) ? text.substring(prefix.length) : text;
  }

  Future<void> _onLoadStudentIncidents(
    LoadStudentIncidents event,
    Emitter<StudentIncidentState> emit,
  ) async {
    final previous = _loaded;
    if (previous == null) emit(const StudentIncidentLoading());
    try {
      final reports = newestStudentIncidents(
        await repository.getStudentIncidents(
          driverId: event.driverId,
          studentId: event.studentId,
          routeNo: event.routeNo,
        ),
      );
      emit(StudentIncidentLoaded(
        reports: reports,
        submitting: previous?.submitting ?? false,
      ));
    } catch (e) {
      if (previous != null) {
        emit(previous.copyWith(loadError: _errorText(e)));
      } else {
        emit(StudentIncidentOperationFailure(_errorText(e)));
      }
    }
  }

  void _onStudentIncidentsUpdated(
    StudentIncidentsUpdated event,
    Emitter<StudentIncidentState> emit,
  ) {
    final reports = newestStudentIncidents(event.reports);
    final current = _loaded;
    if (current != null) {
      emit(current.copyWith(reports: reports, clearLoadError: true));
      return;
    }
    if (state is StudentIncidentLoading) return;
    emit(StudentIncidentLoaded(reports: reports));
  }

  Future<void> _onSubmitStudentIncident(
    SubmitStudentIncidentEvent event,
    Emitter<StudentIncidentState> emit,
  ) async {
    final previous = _loaded;
    if (previous != null) {
      if (previous.submitting) return;
      emit(previous.copyWith(
        submitting: true,
        clearSubmitError: true,
        clearSubmitNotice: true,
      ));
    } else {
      emit(const StudentIncidentLoaded(reports: [], submitting: true));
    }

    try {
      final saved = await repository.submitStudentIncident(event.report);
      final base = previous ?? const StudentIncidentLoaded(reports: []);
      final merged = newestStudentIncidents([
        saved,
        ...base.reports.where((report) => report.id != saved.id),
      ]);
      emit(base.copyWith(
        reports: merged,
        submitting: false,
        clearSubmitError: true,
        clearLoadError: true,
        submitNotice: saved.id.isEmpty
            ? '${saved.incidentDate}${saved.incidentTime}'
            : saved.id,
      ));
    } catch (e) {
      final base = previous ?? const StudentIncidentLoaded(reports: []);
      emit(base.copyWith(
        submitting: false,
        submitError: _errorText(e),
        clearSubmitNotice: true,
      ));
    }
  }
}
