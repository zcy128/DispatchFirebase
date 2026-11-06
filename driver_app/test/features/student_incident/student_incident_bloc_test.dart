import 'package:driver_app/features/student_incident/bloc/student_incident_bloc.dart';
import 'package:driver_app/features/student_incident/bloc/student_incident_event.dart';
import 'package:driver_app/features/student_incident/bloc/student_incident_state.dart';
import 'package:driver_app/features/student_incident/models/student_incident_model.dart';
import 'package:driver_app/features/student_incident/repository/student_incident_repository.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

class _IdleClient extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    return http.StreamedResponse(const Stream.empty(), 500);
  }
}

class _FakeStudentIncidentRepository extends StudentIncidentRepository {
  _FakeStudentIncidentRepository() : super(httpClient: _IdleClient());

  List<StudentIncident> stored = [];
  bool failLoad = false;
  bool failSubmit = false;

  @override
  Future<List<StudentIncident>> getStudentIncidents({
    String? driverId,
    int? studentId,
    String? routeNo,
  }) async {
    if (failLoad) {
      throw const StudentIncidentLookupException(
        'Student incidents could not be confirmed.',
      );
    }
    return stored;
  }

  @override
  Future<StudentIncident> submitStudentIncident(StudentIncident incident) async {
    if (failSubmit) {
      throw Exception(
        'Failed to submit student incident. The server did not respond.',
      );
    }
    final created = incident.copyWith(id: 'inc-new');
    stored = [created, ...stored];
    return created;
  }
}

StudentIncident _existing() {
  final now = DateTime.utc(2026, 11, 4, 8);
  return StudentIncident(
    id: 'inc-old',
    incidentDate: '2026-11-04',
    incidentTime: '08:00',
    studentName: 'Avery Chen',
    routeNo: 'R-4',
    driverId: 'driver-1',
    driverName: 'Alex',
    description: 'Earlier report',
    createdAt: now,
    updatedAt: now,
  );
}

StudentIncident _draft() {
  final now = DateTime.utc(2026, 11, 5, 8);
  return StudentIncident(
    id: '',
    incidentDate: '2026-11-05',
    incidentTime: '08:10',
    studentName: 'Blake Nguyen',
    routeNo: 'R-4',
    driverId: 'driver-1',
    driverName: 'Alex',
    description: 'Left the seat',
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  test('a failed reload keeps the incidents already on screen', () async {
    final repo = _FakeStudentIncidentRepository()..stored = [_existing()];
    final bloc = StudentIncidentBloc(repository: repo);
    bloc.add(const LoadStudentIncidents(driverId: 'driver-1'));
    await bloc.stream.firstWhere((state) => state is StudentIncidentLoaded);

    repo.failLoad = true;
    bloc.add(const LoadStudentIncidents(driverId: 'driver-1'));
    final failed = await bloc.stream.firstWhere(
      (state) => state is StudentIncidentLoaded && state.loadError != null,
    ) as StudentIncidentLoaded;

    expect(failed.reports.single.id, 'inc-old');
    expect(failed.loadError, contains('could not be confirmed'));
    await bloc.close();
  });

  test('a failed submit keeps the list and reports the error', () async {
    final repo = _FakeStudentIncidentRepository()
      ..stored = [_existing()]
      ..failSubmit = true;
    final bloc = StudentIncidentBloc(repository: repo);
    bloc.add(const LoadStudentIncidents(driverId: 'driver-1'));
    await bloc.stream.firstWhere((state) => state is StudentIncidentLoaded);

    bloc.add(SubmitStudentIncidentEvent(_draft()));
    final failed = await bloc.stream.firstWhere(
      (state) => state is StudentIncidentLoaded && state.submitError != null,
    ) as StudentIncidentLoaded;

    expect(failed.submitting, isFalse);
    expect(failed.reports.single.id, 'inc-old');
    expect(failed.submitError, contains('did not respond'));
    await bloc.close();
  });

  test('a successful submit stays on the loaded list', () async {
    final repo = _FakeStudentIncidentRepository()..stored = [_existing()];
    final bloc = StudentIncidentBloc(repository: repo);
    bloc.add(const LoadStudentIncidents(driverId: 'driver-1'));
    await bloc.stream.firstWhere((state) => state is StudentIncidentLoaded);

    bloc.add(SubmitStudentIncidentEvent(_draft()));
    final saved = await bloc.stream.firstWhere(
      (state) => state is StudentIncidentLoaded && state.submitNotice != null,
    ) as StudentIncidentLoaded;

    expect(saved.submitting, isFalse);
    expect(saved.submitNotice, 'inc-new');
    expect(saved.reports.map((report) => report.id), ['inc-new', 'inc-old']);
    await bloc.close();
  });
}
