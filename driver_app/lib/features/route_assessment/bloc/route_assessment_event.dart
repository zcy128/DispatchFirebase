import 'package:equatable/equatable.dart';
import '../models/route_assessment_model.dart';

abstract class RouteAssessmentEvent extends Equatable {
  const RouteAssessmentEvent();

  @override
  List<Object?> get props => [];
}

class LoadRouteAssessments extends RouteAssessmentEvent {
  final String? employeeId;
  final String? routeId;

  const LoadRouteAssessments({this.employeeId, this.routeId});

  @override
  List<Object?> get props => [employeeId, routeId];
}

class SubmitRouteAssessment extends RouteAssessmentEvent {
  final RouteAssessmentModel assessment;

  const SubmitRouteAssessment(this.assessment);

  @override
  List<Object?> get props => [assessment];
}

class FilterRouteAssessmentsByStatus extends RouteAssessmentEvent {
  final RouteAssessmentStatus? status; // null means 'all'

  const FilterRouteAssessmentsByStatus(this.status);

  @override
  List<Object?> get props => [status];
}
