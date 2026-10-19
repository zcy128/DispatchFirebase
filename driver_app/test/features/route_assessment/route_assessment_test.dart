import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/route_assessment/models/route_assessment_model.dart';
import 'package:driver_app/features/route_assessment/bloc/route_assessment_bloc.dart';
import 'package:driver_app/features/route_assessment/bloc/route_assessment_event.dart';
import 'package:driver_app/features/route_assessment/bloc/route_assessment_state.dart';
import 'package:driver_app/features/route_assessment/repository/route_assessment_repository.dart';

class MockRouteAssessmentRepository extends RouteAssessmentRepository {
  List<RouteAssessmentModel> assessments = [];
  bool shouldThrow = false;

  MockRouteAssessmentRepository() : super();

  @override
  Future<List<RouteAssessmentModel>> getRouteAssessments({
    String? employeeId,
    String? routeId,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    var result = assessments;
    if (employeeId != null && employeeId.isNotEmpty) {
      result = result.where((a) => a.conductedByEmployeeId == employeeId).toList();
    }
    if (routeId != null && routeId.isNotEmpty) {
      result = result.where((a) => a.routeId == routeId).toList();
    }
    return result;
  }

  @override
  Future<RouteAssessmentModel> submitRouteAssessment(RouteAssessmentModel assessment) async {
    if (shouldThrow) throw Exception('Submission failed');
    final created = assessment.copyWith(
      id: 'mock-assessment-1',
      statusInt: 0,
      statusStr: 'Working',
    );
    assessments.add(created);
    return created;
  }
}

void main() {
  group('RouteAssessmentStatus enum tests', () {
    test('RouteAssessmentStatus values and labels', () {
      expect(RouteAssessmentStatus.working.statusInt, 0);
      expect(RouteAssessmentStatus.working.label, 'Working');
      expect(RouteAssessmentStatus.completed.statusInt, 2);
      expect(RouteAssessmentStatus.completed.label, 'Completed');
      expect(RouteAssessmentStatus.submitted.statusInt, 3);
      expect(RouteAssessmentStatus.submitted.label, 'Submitted');

      expect(RouteAssessmentStatus.fromStatusInt(0), RouteAssessmentStatus.working);
      expect(RouteAssessmentStatus.fromStatusInt(2), RouteAssessmentStatus.completed);
      expect(RouteAssessmentStatus.fromStatusInt(3), RouteAssessmentStatus.submitted);
      expect(RouteAssessmentStatus.fromStatusInt('invalid'), RouteAssessmentStatus.working);
    });
  });

  group('RouteAssessmentModel serialization and helpers', () {
    final now = DateTime(2026, 10, 5, 12, 0);
    final sample = RouteAssessmentModel(
      id: 'ra-201',
      assessmentType: '1',
      routeId: 'RT-88',
      conductedByDriver: 'Jane Smith',
      conductedByEmployeeId: 'EMP-102',
      school: 'Maple High School',
      visibilityProblemCheck: true,
      visibilityProblem: 'Blind curve near corner',
      highwayStopConcernCheck: false,
      locationProblemCheck: true,
      locationProblem: 'Limited curb space during morning rush',
      unsafeTurnaroundCheck: false,
      intersectionCheck: false,
      roadwayCheck: false,
      nonweatherRiskCheck: false,
      weatherRiskCheck: true,
      weatherRisk: 'Prone to severe black ice on steep descent',
      companyPolicyCheck: false,
      companyPolicyFamiliar: true,
      routeAdjustCheck: false,
      safetyConcernCheck: false,
      summary: 'Overall manageable, caution required on blind curve.',
      attachmentUrls: const ['https://example.com/curve.png'],
      assignedTo: 'Dispatcher Mark',
      isCompleted: false,
      isSubmitted: false,
      statusInt: 0,
      statusStr: 'Working',
      createdAt: now,
      updatedAt: now,
    );

    test('flaggedConcernsCount computes correct number of flagged questions', () {
      expect(sample.flaggedConcernsCount, 3);
      expect(sample.typeLabel, 'Change in Route');
    });

    test('toJson and fromJson symmetry', () {
      final json = sample.toJson();
      expect(json['id'], 'ra-201');
      expect(json['assessmentType'], '1');
      expect(json['routeId'], 'RT-88');
      expect(json['visibilityProblemCheck'], isTrue);
      expect(json['visibilityProblem'], 'Blind curve near corner');
      expect(json['highwayStopConcernCheck'], isFalse);
      expect(json['weatherRiskCheck'], isTrue);
      expect(json['attachmentUrls'], ['https://example.com/curve.png']);
      expect(json['assignedTo'], 'Dispatcher Mark');

      final reconstructed = RouteAssessmentModel.fromJson(json);
      expect(reconstructed.id, sample.id);
      expect(reconstructed.assessmentType, sample.assessmentType);
      expect(reconstructed.routeId, sample.routeId);
      expect(reconstructed.visibilityProblemCheck, isTrue);
      expect(reconstructed.visibilityProblem, 'Blind curve near corner');
      expect(reconstructed.flaggedConcernsCount, 3);
      expect(reconstructed.assignedTo, 'Dispatcher Mark');
    });

    test('copyWith updates fields correctly', () {
      final updated = sample.copyWith(
        statusInt: 2,
        statusStr: 'Completed',
        isCompleted: true,
      );
      expect(updated.id, 'ra-201');
      expect(updated.statusInt, 2);
      expect(updated.statusStr, 'Completed');
      expect(updated.isCompleted, isTrue);
      expect(updated.routeId, 'RT-88');
    });
  });

  group('RouteAssessmentBloc tests', () {
    late MockRouteAssessmentRepository mockRepo;
    late RouteAssessmentBloc bloc;

    setUp(() {
      mockRepo = MockRouteAssessmentRepository();
      bloc = RouteAssessmentBloc(repository: mockRepo);
    });

    tearDown(() {
      bloc.close();
    });

    test('initial state is RouteAssessmentInitial', () {
      expect(bloc.state, isA<RouteAssessmentInitial>());
    });

    test('LoadRouteAssessments emits [Loading, Loaded] on success', () async {
      final now = DateTime.now();
      final item = RouteAssessmentModel(
        id: 'ra-1',
        conductedByEmployeeId: 'EMP-1',
        routeId: 'Route-5',
        conductedByDriver: 'Driver Bob',
        createdAt: now,
        updatedAt: now,
      );
      mockRepo.assessments = [item];

      final expectedStates = [
        isA<RouteAssessmentLoading>(),
        isA<RouteAssessmentLoaded>().having(
          (s) => s.assessments.length,
          'assessments length',
          1,
        ),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));
      bloc.add(const LoadRouteAssessments(employeeId: 'EMP-1'));
    });

    test('LoadRouteAssessments emits [Loading, Error] on repository failure', () async {
      mockRepo.shouldThrow = true;

      final expectedStates = [
        isA<RouteAssessmentLoading>(),
        isA<RouteAssessmentError>().having(
          (s) => s.message,
          'error message',
          contains('Network error'),
        ),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));
      bloc.add(const LoadRouteAssessments(employeeId: 'EMP-1'));
    });

    test('SubmitRouteAssessment emits [Submitting, SubmitSuccess, Loaded] on success', () async {
      final now = DateTime.now();
      final toSubmit = RouteAssessmentModel(
        id: '',
        routeId: 'Route-9',
        conductedByDriver: 'Driver Bob',
        conductedByEmployeeId: 'EMP-1',
        createdAt: now,
        updatedAt: now,
      );

      final expectedStates = [
        isA<RouteAssessmentSubmitting>(),
        isA<RouteAssessmentSubmitSuccess>().having(
          (s) => s.assessment.id,
          'submitted id',
          'mock-assessment-1',
        ),
        isA<RouteAssessmentLoaded>().having(
          (s) => s.assessments.length,
          'assessments length after submit',
          1,
        ),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));
      bloc.add(SubmitRouteAssessment(toSubmit));
    });

    test('SubmitRouteAssessment emits [Submitting, Error] on failure', () async {
      mockRepo.shouldThrow = true;
      final now = DateTime.now();
      final toSubmit = RouteAssessmentModel(
        id: '',
        routeId: 'Route-9',
        conductedByDriver: 'Driver Bob',
        conductedByEmployeeId: 'EMP-1',
        createdAt: now,
        updatedAt: now,
      );

      final expectedStates = [
        isA<RouteAssessmentSubmitting>(),
        isA<RouteAssessmentError>().having(
          (s) => s.message,
          'error message',
          contains('Submission failed'),
        ),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));
      bloc.add(SubmitRouteAssessment(toSubmit));
    });

    test('FilterRouteAssessmentsByStatus updates statusFilter', () async {
      final now = DateTime.now();
      final item0 = RouteAssessmentModel(
        id: 'ra-0',
        routeId: 'Route-0',
        conductedByDriver: 'Driver 1',
        statusInt: 0,
        createdAt: now,
        updatedAt: now,
      );
      final item1 = RouteAssessmentModel(
        id: 'ra-1',
        routeId: 'Route-1',
        conductedByDriver: 'Driver 2',
        statusInt: 2,
        createdAt: now,
        updatedAt: now,
      );
      mockRepo.assessments = [item0, item1];

      bloc.add(const LoadRouteAssessments());
      await Future.delayed(const Duration(milliseconds: 50));

      bloc.add(const FilterRouteAssessmentsByStatus(RouteAssessmentStatus.completed));
      await Future.delayed(const Duration(milliseconds: 50));

      final state = bloc.state;
      expect(state, isA<RouteAssessmentLoaded>());
      if (state is RouteAssessmentLoaded) {
        expect(state.statusFilter, RouteAssessmentStatus.completed);
        expect(state.filteredAssessments.length, 1);
        expect(state.filteredAssessments.first.id, 'ra-1');
      }
    });
  });
}
