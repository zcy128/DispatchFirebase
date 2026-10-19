import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/vehicle_signout/models/vehicle_signout_model.dart';
import 'package:driver_app/features/vehicle_signout/bloc/vehicle_signout_bloc.dart';
import 'package:driver_app/features/vehicle_signout/bloc/vehicle_signout_event.dart';
import 'package:driver_app/features/vehicle_signout/bloc/vehicle_signout_state.dart';
import 'package:driver_app/features/vehicle_signout/repository/vehicle_signout_repository.dart';

class MockVehicleSignoutRepository extends VehicleSignoutRepository {
  final List<VehicleSignoutModel> _storage = [];

  @override
  Future<List<VehicleSignoutModel>> getVehicleSignouts({
    String? unitNumber,
    String? employeeId,
    bool? isSignIn,
  }) async {
    return _storage.where((item) {
      if (unitNumber != null && item.unitNumber != unitNumber) return false;
      if (employeeId != null && item.employeeId != employeeId) return false;
      if (isSignIn != null && item.isSignIn != isSignIn) return false;
      return true;
    }).toList();
  }

  @override
  Stream<List<VehicleSignoutModel>> watchVehicleSignouts({
    String? unitNumber,
    String? employeeId,
    bool? isSignIn,
  }) async* {
    yield await getVehicleSignouts(
      unitNumber: unitNumber,
      employeeId: employeeId,
      isSignIn: isSignIn,
    );
  }

  @override
  Future<VehicleSignoutModel> submitVehicleSignout(VehicleSignoutModel item) async {
    final toSave = item.copyWith(
      id: item.id.isNotEmpty ? item.id : 'vso-${DateTime.now().millisecondsSinceEpoch}',
    );
    _storage.add(toSave);
    return toSave;
  }
}

void main() {
  group('VehicleSignoutModel Tests', () {
    test('JSON serialization and deserialization', () {
      final signout = VehicleSignoutModel(
        id: 'test-123',
        isSignIn: false,
        signDate: '2026-10-05',
        vehicleType: 0,
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        unitNumber: '104',
        odometer: 54321.0,
        fuelLevelDescription: 'Full',
        fuelTypeDescription: 'Diesel',
        docRegistrationSignIn: true,
        docInsuranceSignIn: true,
        docSafetyFitnessSignIn: true,
        docCollisionReportSignIn: true,
        docScheduleMaintenanceSignIn: true,
        docSdsSignIn: true,
        checkFireExtinguisher: true,
        checkFirstAidKit: true,
        checkTriangles: true,
        checkQstraints: false,
        checkSeatBeltCutter: true,
        checkBroom: true,
        checkSnowbrush: true,
        checkCleankit: true,
        acknowledgeCheck: true,
        conditionKey: 'Good',
        conditionComments: 'Clean condition',
        parkingAddress: 'Main Yard',
        fireHallLocation: 'Station 12',
        driverSignature: 'John Doe',
        fleetDepartmentSignature: 'Fleet Manager',
        attachments: [
          VehicleSignoutAttachment(
            url: 'https://example.com/photo.jpg',
            fileName: 'photo.jpg',
            uploadedTime: '2026-10-05T12:00:00Z',
          ),
        ],
        createdAt: '2026-10-05T12:00:00Z',
        updatedAt: '2026-10-05T12:00:00Z',
      );

      final json = signout.toJson();
      expect(json['id'], 'test-123');
      expect(json['isSignIn'], false);
      expect(json['unitNumber'], '104');
      expect(json['attachments'].length, 1);

      final decoded = VehicleSignoutModel.fromJson(json);
      expect(decoded.id, 'test-123');
      expect(decoded.unitNumber, '104');
      expect(decoded.employeeName, 'John Doe');
      expect(decoded.docRegistrationSignIn, true);
      expect(decoded.attachments.first.url, 'https://example.com/photo.jpg');
    });
  });

  group('VehicleSignoutBloc Tests', () {
    late MockVehicleSignoutRepository repository;
    late VehicleSignoutBloc bloc;

    setUp(() {
      repository = MockVehicleSignoutRepository();
      bloc = VehicleSignoutBloc(repository: repository);
    });

    tearDown(() {
      bloc.close();
    });

    test('Initial state is VehicleSignoutInitial', () {
      expect(bloc.state, isA<VehicleSignoutInitial>());
    });

    test('LoadVehicleSignouts emits Loading then Loaded', () async {
      final expectedStates = [
        isA<VehicleSignoutLoading>(),
        isA<VehicleSignoutLoaded>(),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));
      bloc.add(const LoadVehicleSignouts());
    });

    test('CreateVehicleSignoutEvent submits successfully', () async {
      final model = VehicleSignoutModel(
        id: 'new-1',
        isSignIn: true,
        signDate: '2026-10-05',
        employeeId: 'EMP002',
        employeeName: 'Jane Smith',
        unitNumber: '202',
        createdAt: '2026-10-05T10:00:00Z',
        updatedAt: '2026-10-05T10:00:00Z',
      );

      final expectedStates = [
        isA<VehicleSignoutSubmitting>(),
        isA<VehicleSignoutSuccess>(),
      ];

      expectLater(bloc.stream, emitsInOrder(expectedStates));
      bloc.add(CreateVehicleSignoutEvent(model));
    });
  });
}
