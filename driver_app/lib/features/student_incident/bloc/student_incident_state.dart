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

  const StudentIncidentLoaded({
    required this.reports,
  });

  /// Incidents requiring office administrative review
  int get pendingReviewCount =>
      reports.where((r) => r.needsOfficeReview).length;

  StudentIncidentLoaded copyWith({
    List<StudentIncident>? reports,
  }) {
    return StudentIncidentLoaded(
      reports: reports ?? this.reports,
    );
  }

  @override
  List<Object?> get props => [reports];
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
