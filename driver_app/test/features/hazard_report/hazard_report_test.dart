import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/hazard_report/models/hazard_report_model.dart';
import 'package:driver_app/features/hazard_report/bloc/hazard_report_bloc.dart';
import 'package:driver_app/features/hazard_report/bloc/hazard_report_event.dart';
import 'package:driver_app/features/hazard_report/bloc/hazard_report_state.dart';
import 'package:driver_app/features/hazard_report/repository/hazard_report_repository.dart';

class MockHazardReportRepository extends HazardReportRepository {
  List<HazardReportModel> reports = [];
  bool shouldThrow = false;

  MockHazardReportRepository() : super();

  @override
  Future<List<HazardReportModel>> getHazardReports({String? employeeId}) async {
    if (shouldThrow) throw Exception('Network error');
    if (employeeId != null && employeeId.isNotEmpty) {
      return reports.where((r) => r.reportedByEmployeeId == employeeId).toList();
    }
    return reports;
  }

  @override
  Future<HazardReportModel> submitHazardReport(HazardReportModel report) async {
    if (shouldThrow) throw Exception('Submission failed');
    final created = report.copyWith(
      id: 'mock-hazard-1',
      statusInt: 0,
      statusStr: 'Open',
    );
    reports.add(created);
    return created;
  }
}

void main() {
  group('HazardReportStatus enum tests', () {
    test('statusInt mapping', () {
      expect(HazardReportStatus.open.statusInt, 0);
      expect(HazardReportStatus.investigating.statusInt, 1);
      expect(HazardReportStatus.resolved.statusInt, 2);
    });

    test('fromStatusInt helper', () {
      expect(HazardReportStatus.fromStatusInt(0), HazardReportStatus.open);
      expect(HazardReportStatus.fromStatusInt(1), HazardReportStatus.investigating);
      expect(HazardReportStatus.fromStatusInt(2), HazardReportStatus.resolved);
      expect(HazardReportStatus.fromStatusInt('invalid'), HazardReportStatus.open);
    });
  });

  group('HazardReportModel JSON serialization', () {
    final now = DateTime(2026, 10, 1, 10, 30);
    final sample = HazardReportModel(
      id: 'hz-101',
      reportedBy: 'John Driver',
      reportedByEmployeeId: 'EMP-900',
      unitNumber: 'BUS-42',
      routeId: 'RT-10',
      eventTime: '2026-10-01 10:15',
      eventLocation: 'Main St & 4th Ave',
      eventDescription: 'Severe black ice on road turning into school bus loop.',
      trippingHazard: false,
      trafficHazard: true,
      equipmentHazard: false,
      performanceHazard: false,
      snowHazard: true,
      spillHazard: false,
      otherHazard: false,
      unsafeAction: false,
      unsafeCondition: true,
      happenedtoMe: true,
      happenedtoSomeone: false,
      ofanarea: true,
      ofEquipment: false,
      moderate: true,
      serious: false,
      minor: false,
      probableRecurrence: true,
      occasional: false,
      rare: false,
      suggestion: 'Salt or sand the turn immediately.',
      actionTaken: 'Contacted city road maintenance.',
      assignedTo: 'Officer Dan',
      isCompleted: false,
      officeHazardType: 'Hazard',
      statusInt: 1,
      statusStr: 'Investigating',
      attachmentUrls: const ['https://example.com/ice.jpg'],
      createdAt: now,
    );

    test('toJson and fromJson symmetry', () {
      final json = sample.toJson();
      expect(json['id'], 'hz-101');
      expect(json['trafficHazard'], isTrue);
      expect(json['snowHazard'], isTrue);
      expect(json['unsafeCondition'], isTrue);
      expect(json['statusInt'], 1);

      final deserialized = HazardReportModel.fromJson(json, 'hz-101');
      expect(deserialized.id, sample.id);
      expect(deserialized.reportedBy, sample.reportedBy);
      expect(deserialized.trafficHazard, isTrue);
      expect(deserialized.snowHazard, isTrue);
      expect(deserialized.activeHazardLabels, contains('Traffic'));
      expect(deserialized.activeHazardLabels, contains('Snow / Ice / Road'));
      expect(deserialized.activeCloseCallLabels, contains('Unsafe Condition'));
      expect(deserialized.activeCloseCallLabels, contains('Happened to Me'));
      expect(deserialized.attachmentUrls, contains('https://example.com/ice.jpg'));
    });

    test('copyWith updates fields correctly', () {
      final updated = sample.copyWith(
        statusInt: 2,
        statusStr: 'Resolved',
        isCompleted: true,
      );
      expect(updated.statusInt, 2);
      expect(updated.statusStr, 'Resolved');
      expect(updated.isCompleted, isTrue);
      expect(updated.id, sample.id);
    });
  });

  group('HazardReportBloc tests', () {
    late MockHazardReportRepository mockRepo;
    late HazardReportBloc bloc;

    setUp(() {
      mockRepo = MockHazardReportRepository();
      bloc = HazardReportBloc(repository: mockRepo);
    });

    tearDown(() {
      bloc.close();
    });

    test('initial state is HazardReportInitial', () {
      expect(bloc.state, isA<HazardReportInitial>());
    });

    test('loads reports successfully', () async {
      mockRepo.reports = [
        HazardReportModel(
          id: 'hz-1',
          reportedBy: 'Driver A',
          reportedByEmployeeId: 'EMP-1',
          eventDescription: 'Icy road',
          createdAt: DateTime.now(),
        ),
      ];

      bloc.add(const LoadHazardReports(employeeId: 'EMP-1'));

      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<HazardReportLoading>(),
          isA<HazardReportLoaded>().having(
            (s) => s.reports.length,
            'reports length',
            1,
          ),
        ]),
      );
    });

    test('submits report successfully', () async {
      final newReport = HazardReportModel(
        id: '',
        reportedBy: 'Driver B',
        eventDescription: 'Tree branch hanging low',
        trafficHazard: true,
        createdAt: DateTime.now(),
      );

      bloc.add(SubmitHazardReport(newReport));

      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<HazardReportSubmitting>(),
          isA<HazardReportSubmitSuccess>(),
          isA<HazardReportLoaded>().having(
            (s) => s.reports.length,
            'reports count',
            1,
          ),
        ]),
      );
    });

    test('handles submission failure gracefully', () async {
      mockRepo.shouldThrow = true;
      final newReport = HazardReportModel(
        id: '',
        reportedBy: 'Driver C',
        eventDescription: 'Defective crosswalk sign',
        createdAt: DateTime.now(),
      );

      bloc.add(SubmitHazardReport(newReport));

      await expectLater(
        bloc.stream,
        emitsInOrder([
          isA<HazardReportSubmitting>(),
          isA<HazardReportSubmitFailure>(),
          isA<HazardReportLoaded>(),
        ]),
      );
    });
  });
}
