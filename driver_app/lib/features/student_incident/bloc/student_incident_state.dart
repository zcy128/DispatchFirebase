import 'package:equatable/equatable.dart';
import '../models/student_incident_model.dart';

abstract class StudentIncidentState extends Equatable {
  const StudentIncidentState();

  @override
  List<Object?> get props => [];
}

class StudentIncidentInitial extends StudentIncidentState {
  const StudentIncidentInitial();
}

class StudentIncidentLoading extends StudentIncidentState {
  const StudentIncidentLoading();
}

class StudentIncidentLoaded extends StudentIncidentState {
  final List<StudentIncident> reports;
  final bool submitting;
  final String? submitError;
  final String? loadError;
  final String? submitNotice;

  const StudentIncidentLoaded({
    required this.reports,
    this.submitting = false,
    this.submitError,
    this.loadError,
    this.submitNotice,
  });

  /// Incidents requiring office administrative review
  int get pendingReviewCount =>
      reports.where((r) => r.needsOfficeReview).length;

  StudentIncidentLoaded copyWith({
    List<StudentIncident>? reports,
    bool? submitting,
    String? submitError,
    bool clearSubmitError = false,
    String? loadError,
    bool clearLoadError = false,
    String? submitNotice,
    bool clearSubmitNotice = false,
  }) {
    return StudentIncidentLoaded(
      reports: reports ?? this.reports,
      submitting: submitting ?? this.submitting,
      submitError:
          clearSubmitError ? null : (submitError ?? this.submitError),
      loadError: clearLoadError ? null : (loadError ?? this.loadError),
      submitNotice:
          clearSubmitNotice ? null : (submitNotice ?? this.submitNotice),
    );
  }

  @override
  List<Object?> get props =>
      [reports, submitting, submitError, loadError, submitNotice];
}

class StudentIncidentSubmitting extends StudentIncidentState {
  const StudentIncidentSubmitting();
}

class StudentIncidentSubmitSuccess extends StudentIncidentState {
  final StudentIncident report;

  const StudentIncidentSubmitSuccess(this.report);

  @override
  List<Object?> get props => [report];
}

class StudentIncidentSubmitFailure extends StudentIncidentState {
  final String error;

  const StudentIncidentSubmitFailure(this.error);

  @override
  List<Object?> get props => [error];
}

class StudentIncidentOperationFailure extends StudentIncidentState {
  final String error;

  const StudentIncidentOperationFailure(this.error);

  @override
  List<Object?> get props => [error];
}
