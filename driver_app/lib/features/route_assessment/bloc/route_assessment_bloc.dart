import 'package:flutter_bloc/flutter_bloc.dart';
import '../repository/route_assessment_repository.dart';
import 'route_assessment_event.dart';
import 'route_assessment_state.dart';

class RouteAssessmentBloc extends Bloc<RouteAssessmentEvent, RouteAssessmentState> {
  final RouteAssessmentRepository repository;

  RouteAssessmentBloc({required this.repository}) : super(RouteAssessmentInitial()) {
    on<LoadRouteAssessments>(_onLoadRouteAssessments);
    on<SubmitRouteAssessment>(_onSubmitRouteAssessment);
    on<FilterRouteAssessmentsByStatus>(_onFilterRouteAssessmentsByStatus);
  }

  Future<void> _onLoadRouteAssessments(
    LoadRouteAssessments event,
    Emitter<RouteAssessmentState> emit,
  ) async {
    emit(RouteAssessmentLoading());
    try {
      final items = await repository.getRouteAssessments(
        employeeId: event.employeeId,
        routeId: event.routeId,
      );
      emit(RouteAssessmentLoaded(assessments: items));
    } catch (e) {
      emit(RouteAssessmentError('Failed to load route assessments: $e'));
    }
  }

  Future<void> _onSubmitRouteAssessment(
    SubmitRouteAssessment event,
    Emitter<RouteAssessmentState> emit,
  ) async {
    emit(RouteAssessmentSubmitting());
    try {
      final saved = await repository.submitRouteAssessment(event.assessment);
      emit(RouteAssessmentSubmitSuccess(saved));

      // Reload list
      final items = await repository.getRouteAssessments(
        employeeId: saved.conductedByEmployeeId,
      );
      emit(RouteAssessmentLoaded(assessments: items));
    } catch (e) {
      emit(RouteAssessmentError('Failed to submit route assessment: $e'));
    }
  }

  void _onFilterRouteAssessmentsByStatus(
    FilterRouteAssessmentsByStatus event,
    Emitter<RouteAssessmentState> emit,
  ) {
    if (state is RouteAssessmentLoaded) {
      final current = state as RouteAssessmentLoaded;
      emit(RouteAssessmentLoaded(
        assessments: current.assessments,
        statusFilter: event.status,
      ));
    }
  }
}
