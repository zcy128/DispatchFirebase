import 'package:equatable/equatable.dart';
import '../models/route_assessment_model.dart';

abstract class RouteAssessmentState extends Equatable {
  const RouteAssessmentState();

  @override
  List<Object?> get props => [];
}

class RouteAssessmentInitial extends RouteAssessmentState {}

class RouteAssessmentLoading extends RouteAssessmentState {}

class RouteAssessmentLoaded extends RouteAssessmentState {
  final List<RouteAssessmentModel> assessments;
  final RouteAssessmentStatus? statusFilter;

  const RouteAssessmentLoaded({
    required this.assessments,
    this.statusFilter,
  });

  List<RouteAssessmentModel> get filteredAssessments {
    if (statusFilter == null) return assessments;
    return assessments.where((a) => a.status == statusFilter).toList();
  }

  int get workingCount =>
      assessments.where((a) => a.status == RouteAssessmentStatus.working).length;

  int get completedCount =>
      assessments.where((a) => a.status == RouteAssessmentStatus.completed).length;

  int get submittedCount =>
      assessments.where((a) => a.status == RouteAssessmentStatus.submitted).length;

  @override
  List<Object?> get props => [assessments, statusFilter];
}

class RouteAssessmentSubmitting extends RouteAssessmentState {}

class RouteAssessmentSubmitSuccess extends RouteAssessmentState {
  final RouteAssessmentModel assessment;

  const RouteAssessmentSubmitSuccess(this.assessment);

  @override
  List<Object?> get props => [assessment];
}

class RouteAssessmentError extends RouteAssessmentState {
  final String message;

  const RouteAssessmentError(this.message);

  @override
  List<Object?> get props => [message];
}
