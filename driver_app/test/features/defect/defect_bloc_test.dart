import 'package:driver_app/features/defect/bloc/defect_bloc.dart';
import 'package:driver_app/features/defect/bloc/defect_event.dart';
import 'package:driver_app/features/defect/bloc/defect_state.dart';
import 'package:driver_app/features/defect/models/defect_model.dart';
import 'package:driver_app/features/defect/repository/defect_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

class _IdleClient extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    return http.StreamedResponse(const Stream.empty(), 500);
  }
}

class _FakeDefectRepository extends DefectRepository {
  _FakeDefectRepository() : super(httpClient: _IdleClient());

  List<VehicleDefectReport> stored = [];
  bool failLoad = false;
  bool failSubmit = false;

  @override
  Future<List<String>> getFleetVehicleUnits() async => ['1021'];

  @override
  Future<List<VehicleDefectReport>> getDefectReports({
    String? vehicleUnit,
    String? driverId,
  }) async {
    if (failLoad) {
      throw const DefectLookupException('Defect reports could not be confirmed.');
    }
    return stored;
  }

  @override
  Future<VehicleDefectReport> submitDefectReport(
      VehicleDefectReport report) async {
    if (failSubmit) {
      throw Exception('Failed to submit defect report. The server did not respond.');
    }
    final created = VehicleDefectReport(
      id: 'def-new',
      vehicleId: report.vehicleId,
      vehicleUnitNumber: report.vehicleUnitNumber,
      odometer: report.odometer,
      reportedByUserId: report.reportedByUserId,
      reportedByName: report.reportedByName,
      reportDate: report.reportDate,
      reportTime: report.reportTime,
      items: report.items,
      defectNotes: report.defectNotes,
      noDefectsFound: report.noDefectsFound,
      confirmedAccurate: report.confirmedAccurate,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    );
    stored = [created, ...stored];
    return created;
  }

  @override
  Stream<List<VehicleDefectReport>> watchDefectReports({
    String? driverId,
    String? vehicleUnit,
  }) {
    return const Stream.empty();
  }
}

VehicleDefectReport _existing() {
  final now = DateTime(2026, 11, 4, 7);
  return VehicleDefectReport(
    id: 'def-old',
    vehicleId: 21,
    vehicleUnitNumber: '1021',
    odometer: 1100,
    reportedByUserId: 'driver-1',
    reportedByName: 'Alex',
    reportDate: '2026-11-04',
    reportTime: '07:00',
    items: const [],
    createdAt: now,
    updatedAt: now,
  );
}

VehicleDefectReport _draft() {
  final now = DateTime(2026, 11, 5, 7);
  return VehicleDefectReport(
    id: '',
    vehicleId: 21,
    vehicleUnitNumber: '1021',
    odometer: 1200,
    reportedByUserId: 'driver-1',
    reportedByName: 'Alex',
    reportDate: '2026-11-05',
    reportTime: '07:10',
    items: const [],
    defectNotes: 'Brake',
    noDefectsFound: false,
    confirmedAccurate: true,
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  test('a failed reload keeps the reports already on screen', () async {
    final repo = _FakeDefectRepository()..stored = [_existing()];
    final bloc = DefectBloc(repository: repo);
    bloc.add(const LoadDefects(driverId: 'driver-1'));
    await bloc.stream.firstWhere((state) => state is DefectLoaded);

    repo.failLoad = true;
    bloc.add(const LoadDefects(driverId: 'driver-1'));
    final failed = await bloc.stream.firstWhere(
      (state) => state is DefectLoaded && state.loadError != null,
    ) as DefectLoaded;

    expect(failed.reports.single.id, 'def-old');
    expect(failed.loadError, contains('could not be confirmed'));
    await bloc.close();
  });

  test('a failed submit keeps the list and reports the error', () async {
    final repo = _FakeDefectRepository()
      ..stored = [_existing()]
      ..failSubmit = true;
    final bloc = DefectBloc(repository: repo);
    bloc.add(const LoadDefects(driverId: 'driver-1'));
    await bloc.stream.firstWhere((state) => state is DefectLoaded);

    bloc.add(SubmitDefectReportEvent(_draft()));
    final failed = await bloc.stream.firstWhere(
      (state) => state is DefectLoaded && state.submitError != null,
    ) as DefectLoaded;

    expect(failed.submitting, isFalse);
    expect(failed.reports.single.id, 'def-old');
    expect(failed.submitError, contains('did not respond'));
    await bloc.close();
  });

  test('a successful submit stays on the loaded list', () async {
    final repo = _FakeDefectRepository()..stored = [_existing()];
    final bloc = DefectBloc(repository: repo);
    bloc.add(const LoadDefects(driverId: 'driver-1'));
    await bloc.stream.firstWhere((state) => state is DefectLoaded);

    bloc.add(SubmitDefectReportEvent(_draft()));
    final saved = await bloc.stream.firstWhere(
      (state) => state is DefectLoaded && state.submitNotice != null,
    ) as DefectLoaded;

    expect(saved.submitting, isFalse);
    expect(saved.reports.map((report) => report.id), ['def-new', 'def-old']);
    await bloc.close();
  });
}
