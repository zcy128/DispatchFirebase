import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:driver_app/features/pretrip/models/pretrip_model.dart';
import 'package:driver_app/features/pretrip/repository/pretrip_repository.dart';
import 'package:driver_app/features/pretrip/bloc/pretrip_bloc.dart';
import 'package:driver_app/features/pretrip/bloc/pretrip_event.dart';
import 'package:driver_app/features/pretrip/bloc/pretrip_state.dart';

// ─── Fake Repository ──────────────────────────────────────────────────────────

class FakePreTripRepository extends PreTripRepository {
  final Map<String, PreTripInspectionRecord> _store = {};
  final List<String> _vehicleUnits = ['1001', '1002', '1003'];

  @override
  Future<void> init() async {}

  @override
  Future<List<String>> getFleetVehicleUnits() async => _vehicleUnits;

  @override
  Future<bool> isVehicleInspectedToday(
      String vehicleUnit, String date) async {
    return _store.containsKey('${vehicleUnit}_$date');
  }

  @override
  Future<PreTripInspectionRecord?> getTodayInspection(
      String vehicleUnit, String date) async {
    return _store['${vehicleUnit}_$date'];
  }

  @override
  Future<PreTripInspectionRecord> submitInspection(
      PreTripInspectionRecord record) async {
    final key = '${record.vehicleUnit}_${record.inspectionDate}';
    final created = record.copyWith(id: 'fake-id-${key.hashCode}');
    _store[key] = created;
    return created;
  }

  @override
  Stream<PreTripInspectionRecord?> watchTodayStatus(
      String vehicleUnit, String date) {
    return Stream.value(_store['${vehicleUnit}_$date']);
  }
}

/// Helper to collect states from a BLoC after adding events.
Future<List<S>> collectStates<E, S>(
  PreTripBloc bloc,
  List<PreTripEvent> events, {
  Duration delay = const Duration(milliseconds: 50),
}) async {
  final states = <S>[];
  final sub = bloc.stream.listen((s) {
    if (s is S) states.add(s as S);
  });
  for (final e in events) {
    bloc.add(e);
  }
  await Future.delayed(delay);
  await sub.cancel();
  return states;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    Hive.init('test_pretrip_hive');
  });

  group('InspectionItemResult Serialization', () {
    test('toMap / fromMap round-trips all fields (pass)', () {
      const item = InspectionItemResult(
        code: 'AIR_BRAKE_01',
        title: 'Pushrod stroke within adjustment limit',
        category: 'Air Brake System',
        status: InspectionItemStatus.pass,
        notes: '',
      );
      final map = item.toMap();
      final restored = InspectionItemResult.fromMap(map);
      expect(restored.code, 'AIR_BRAKE_01');
      expect(restored.status, InspectionItemStatus.pass);
      expect(restored.notes, '');
    });

    test('serializes minorDefect status correctly', () {
      const item = InspectionItemResult(
        code: 'TIRES_01',
        title: 'Tire tread depth',
        category: 'Tires',
        status: InspectionItemStatus.minorDefect,
        notes: 'Rear right tire worn',
      );
      final map = item.toMap();
      expect(map['status'], 'minor_defect');
      final restored = InspectionItemResult.fromMap(map);
      expect(restored.status, InspectionItemStatus.minorDefect);
      expect(restored.notes, 'Rear right tire worn');
    });

    test('serializes majorDefect status correctly', () {
      const item = InspectionItemResult(
        code: 'AIR_BRAKE_01',
        title: 'Pushrod stroke',
        category: 'Air Brake System',
        status: InspectionItemStatus.majorDefect,
        notes: 'Out of adjustment',
      );
      expect(item.toMap()['status'], 'major_defect');
      expect(InspectionItemResult.fromMap(item.toMap()).status,
          InspectionItemStatus.majorDefect);
    });

    test('serializes notApplicable status as na', () {
      const item = InspectionItemResult(
        code: 'HYD_BRAKE_01',
        title: 'Hydraulic boost',
        category: 'Hydraulic Brake System',
        status: InspectionItemStatus.notApplicable,
      );
      expect(item.toMap()['status'], 'na');
      expect(InspectionItemResult.fromMap(item.toMap()).status,
          InspectionItemStatus.notApplicable);
    });

    test('copyWith updates only status and notes', () {
      const original = InspectionItemResult(
        code: 'LAMPS_01',
        title: 'Head lamps',
        category: 'Lamps',
        status: InspectionItemStatus.pass,
      );
      final updated = original.copyWith(
        status: InspectionItemStatus.minorDefect,
        notes: 'Dim headlight',
      );
      expect(updated.code, original.code);
      expect(updated.status, InspectionItemStatus.minorDefect);
      expect(updated.notes, 'Dim headlight');
    });

    test('InspectionItemStatus.fromApiValue handles all values', () {
      expect(InspectionItemStatus.fromApiValue('pass'),
          InspectionItemStatus.pass);
      expect(InspectionItemStatus.fromApiValue('minor_defect'),
          InspectionItemStatus.minorDefect);
      expect(InspectionItemStatus.fromApiValue('major_defect'),
          InspectionItemStatus.majorDefect);
      expect(InspectionItemStatus.fromApiValue('na'),
          InspectionItemStatus.notApplicable);
      // fallback
      expect(InspectionItemStatus.fromApiValue('unknown'),
          InspectionItemStatus.pass);
    });
  });

  group('PreTripInspectionRecord Serialization', () {
    final now = DateTime(2026, 9, 30, 8, 0);
    final items = buildInitialItems();

    test('toMap / fromMap round-trips correctly', () {
      final record = PreTripInspectionRecord(
        id: 'abc-123',
        vehicleUnit: '1021',
        vehicleId: 21,
        vehiclePlate: 'ABC 1234',
        inspectionDate: '2026-09-30',
        inspectionTime: '07:45',
        inspectorId: 'EMP-021',
        inspectorName: 'John Driver',
        odometer: 98765,
        overallStatus: OverallInspectionStatus.passed,
        items: items,
        defectNotes: '',
        signatureName: 'John Driver',
        createdAt: now,
        updatedAt: now,
      );
      final restored = PreTripInspectionRecord.fromMap(record.toMap());
      expect(restored.id, 'abc-123');
      expect(restored.vehicleUnit, '1021');
      expect(restored.inspectorName, 'John Driver');
      expect(restored.odometer, 98765);
      expect(restored.overallStatus, OverallInspectionStatus.passed);
      expect(restored.items.length, items.length);
    });

    test('overall status serializes to correct api values', () {
      expect(OverallInspectionStatus.passed.apiValue, 'passed');
      expect(OverallInspectionStatus.passedWithMinorDefects.apiValue,
          'passed_with_minor_defects');
      expect(OverallInspectionStatus.failedMajorDefects.apiValue,
          'failed_major_defects');
    });

    test('overall status fromApiValue with fallback', () {
      expect(OverallInspectionStatus.fromApiValue('passed'),
          OverallInspectionStatus.passed);
      expect(OverallInspectionStatus.fromApiValue('passed_with_minor_defects'),
          OverallInspectionStatus.passedWithMinorDefects);
      expect(OverallInspectionStatus.fromApiValue('failed_major_defects'),
          OverallInspectionStatus.failedMajorDefects);
      expect(OverallInspectionStatus.fromApiValue('unknown'),
          OverallInspectionStatus.passed);
    });

    test('copyWith updates specific fields only', () {
      final r = PreTripInspectionRecord(
        vehicleUnit: '1001',
        inspectionDate: '2026-09-30',
        inspectionTime: '07:00',
        inspectorId: 'EMP-001',
        inspectorName: 'Test',
        items: {},
        signatureName: 'Test',
        createdAt: now,
        updatedAt: now,
      );
      final updated = r.copyWith(odometer: 55000, vehiclePlate: 'XYZ 999');
      expect(updated.vehicleUnit, '1001');
      expect(updated.odometer, 55000);
      expect(updated.vehiclePlate, 'XYZ 999');
    });
  });

  group('kSchedule5Categories Checklist', () {
    test('has exactly 12 categories', () {
      expect(kSchedule5Categories.length, 12);
    });

    test('buildInitialItems produces entries for all items', () {
      final items = buildInitialItems();
      int totalItems = 0;
      for (final cat in kSchedule5Categories) {
        totalItems += cat.items.length;
      }
      expect(items.length, totalItems);
    });

    test('all initial items default to pass status', () {
      final items = buildInitialItems();
      for (final item in items.values) {
        expect(item.status, InspectionItemStatus.pass);
      }
    });

    test('air brake category has correct code and title', () {
      final cat = kSchedule5Categories
          .firstWhere((c) => c.code == 'AIR_BRAKE');
      expect(cat.title, 'Air Brake System');
      expect(cat.items.isNotEmpty, true);
    });

    test('stop arm category is school bus specific', () {
      final cat = kSchedule5Categories
          .firstWhere((c) => c.code == 'STOP_ARM');
      expect(cat.isSchoolBusSpecific, true);
    });

    test('item codes are all unique', () {
      final items = buildInitialItems();
      final codes = items.keys.toSet();
      expect(codes.length, items.length);
    });

    test('all category codes are unique', () {
      final codes = kSchedule5Categories.map((c) => c.code).toSet();
      expect(codes.length, kSchedule5Categories.length);
    });
  });

  group('FakePreTripRepository — isVehicleInspectedToday', () {
    late FakePreTripRepository repo;
    const testDate = '2026-09-30';

    setUp(() {
      repo = FakePreTripRepository();
    });

    test('returns false when no inspection exists', () async {
      expect(await repo.isVehicleInspectedToday('1001', testDate), false);
    });

    test('returns true after submitting an inspection', () async {
      final now = DateTime.now();
      await repo.submitInspection(PreTripInspectionRecord(
        vehicleUnit: '1001',
        inspectionDate: testDate,
        inspectionTime: '07:30',
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        items: buildInitialItems(),
        signatureName: 'Test Driver',
        createdAt: now,
        updatedAt: now,
      ));
      expect(await repo.isVehicleInspectedToday('1001', testDate), true);
    });

    test('returns false for a different vehicle', () async {
      final now = DateTime.now();
      await repo.submitInspection(PreTripInspectionRecord(
        vehicleUnit: '1001',
        inspectionDate: testDate,
        inspectionTime: '07:30',
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        items: buildInitialItems(),
        signatureName: 'Test Driver',
        createdAt: now,
        updatedAt: now,
      ));
      expect(await repo.isVehicleInspectedToday('1002', testDate), false);
    });

    test('returns false for a different date', () async {
      final now = DateTime.now();
      await repo.submitInspection(PreTripInspectionRecord(
        vehicleUnit: '1001',
        inspectionDate: testDate,
        inspectionTime: '07:30',
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        items: buildInitialItems(),
        signatureName: 'Test Driver',
        createdAt: now,
        updatedAt: now,
      ));
      expect(await repo.isVehicleInspectedToday('1001', '2026-10-01'), false);
    });

    test('getTodayInspection returns null when none exists', () async {
      final result = await repo.getTodayInspection('1001', testDate);
      expect(result, isNull);
    });

    test('getTodayInspection returns record after submission', () async {
      final now = DateTime.now();
      await repo.submitInspection(PreTripInspectionRecord(
        vehicleUnit: '1001',
        inspectionDate: testDate,
        inspectionTime: '07:30',
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        items: buildInitialItems(),
        signatureName: 'Test Driver',
        createdAt: now,
        updatedAt: now,
      ));
      final result = await repo.getTodayInspection('1001', testDate);
      expect(result, isNotNull);
      expect(result!.vehicleUnit, '1001');
    });

    test('getFleetVehicleUnits returns expected list', () async {
      final units = await repo.getFleetVehicleUnits();
      expect(units, ['1001', '1002', '1003']);
    });
  });

  group('PreTripBloc State Flow', () {
    late FakePreTripRepository repo;
    const testDate = '2026-09-30';
    const testVehicle = '1001';

    setUp(() {
      repo = FakePreTripRepository();
    });

    test('initial state is PreTripInitial', () {
      final bloc = PreTripBloc(repository: repo);
      expect(bloc.state, isA<PreTripInitial>());
      bloc.close();
    });

    test('LoadPreTripStatusEvent emits Loading then StatusLoaded (not inspected)', () async {
      final bloc = PreTripBloc(repository: repo);
      final states = <PreTripState>[];
      final sub = bloc.stream.listen(states.add);

      bloc.add(const LoadPreTripStatusEvent(
          vehicleUnit: testVehicle, date: testDate));
      await Future.delayed(const Duration(milliseconds: 100));

      expect(states.any((s) => s is PreTripLoading), true);
      final loaded = states.whereType<PreTripStatusLoaded>().firstOrNull;
      expect(loaded, isNotNull);
      expect(loaded!.isInspectedToday, false);
      expect(loaded.selectedVehicleUnit, testVehicle);
      expect(loaded.fleetVehicles.length, 3);

      await sub.cancel();
      bloc.close();
    });

    test('StartPreTripInspectionEvent emits PreTripInProgress with all items', () async {
      final bloc = PreTripBloc(repository: repo);
      final states = <PreTripState>[];
      final sub = bloc.stream.listen(states.add);

      bloc.add(const StartPreTripInspectionEvent(
        vehicleUnit: testVehicle,
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        date: testDate,
      ));
      await Future.delayed(const Duration(milliseconds: 50));

      final inProgress = states.whereType<PreTripInProgress>().firstOrNull;
      expect(inProgress, isNotNull);
      expect(inProgress!.vehicleUnit, testVehicle);
      expect(inProgress.inspectorName, 'Test Driver');
      expect(inProgress.items.isNotEmpty, true);
      expect(inProgress.defectCount, 0);
      expect(inProgress.hasMajorDefect, false);

      await sub.cancel();
      bloc.close();
    });

    test('UpdatePreTripItemEvent updates item status in InProgress state', () async {
      final bloc = PreTripBloc(repository: repo);
      final states = <PreTripState>[];
      final sub = bloc.stream.listen(states.add);

      bloc.add(const StartPreTripInspectionEvent(
        vehicleUnit: testVehicle,
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        date: testDate,
      ));
      bloc.add(const UpdatePreTripItemEvent(
        itemCode: 'AIR_BRAKE_01',
        status: InspectionItemStatus.minorDefect,
        notes: 'Slight leak',
      ));
      await Future.delayed(const Duration(milliseconds: 50));

      final lastInProgress =
          states.whereType<PreTripInProgress>().lastOrNull;
      expect(lastInProgress, isNotNull);
      expect(lastInProgress!.items['AIR_BRAKE_01']?.status,
          InspectionItemStatus.minorDefect);
      expect(lastInProgress.items['AIR_BRAKE_01']?.notes, 'Slight leak');
      expect(lastInProgress.defectCount, 1);

      await sub.cancel();
      bloc.close();
    });

    test('defectCount and hasMajorDefect computed correctly', () async {
      final bloc = PreTripBloc(repository: repo);
      final states = <PreTripState>[];
      final sub = bloc.stream.listen(states.add);

      bloc.add(const StartPreTripInspectionEvent(
        vehicleUnit: testVehicle,
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        date: testDate,
      ));
      bloc.add(const UpdatePreTripItemEvent(
        itemCode: 'AIR_BRAKE_01',
        status: InspectionItemStatus.majorDefect,
        notes: 'Out of adjustment',
      ));
      bloc.add(const UpdatePreTripItemEvent(
        itemCode: 'TIRES_01',
        status: InspectionItemStatus.minorDefect,
        notes: 'Worn tread',
      ));
      await Future.delayed(const Duration(milliseconds: 50));

      final lastInProgress =
          states.whereType<PreTripInProgress>().lastOrNull;
      expect(lastInProgress!.defectCount, 2);
      expect(lastInProgress.hasMajorDefect, true);

      await sub.cancel();
      bloc.close();
    });

    test('SubmitPreTripInspectionEvent emits Submitting then SubmitSuccess', () async {
      final bloc = PreTripBloc(repository: repo);
      final states = <PreTripState>[];
      final sub = bloc.stream.listen(states.add);

      bloc.add(const StartPreTripInspectionEvent(
        vehicleUnit: testVehicle,
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        date: testDate,
      ));
      bloc.add(const SubmitPreTripInspectionEvent(
        odometer: 99000,
        defectNotes: '',
        signatureName: 'Test Driver',
        inspectionTime: '07:45',
      ));
      await Future.delayed(const Duration(milliseconds: 100));

      expect(states.any((s) => s is PreTripSubmitting), true);
      final success = states.whereType<PreTripSubmitSuccess>().firstOrNull;
      expect(success, isNotNull);
      expect(success!.record.vehicleUnit, testVehicle);
      expect(success.record.odometer, 99000);
      expect(success.record.signatureName, 'Test Driver');

      await sub.cancel();
      bloc.close();
    });

    test('after submit, isVehicleInspectedToday returns true', () async {
      final bloc = PreTripBloc(repository: repo);
      bloc.add(const StartPreTripInspectionEvent(
        vehicleUnit: testVehicle,
        inspectorId: 'EMP-001',
        inspectorName: 'Test Driver',
        date: testDate,
      ));
      bloc.add(const SubmitPreTripInspectionEvent(
        odometer: 99000,
        defectNotes: '',
        signatureName: 'Test Driver',
        inspectionTime: '07:45',
      ));
      await Future.delayed(const Duration(milliseconds: 100));

      final inspected =
          await repo.isVehicleInspectedToday(testVehicle, testDate);
      expect(inspected, true);
      bloc.close();
    });

    test('ChangePreTripVehicleEvent updates selectedVehicleUnit', () async {
      final bloc = PreTripBloc(repository: repo);
      final states = <PreTripState>[];
      final sub = bloc.stream.listen(states.add);

      bloc.add(const LoadPreTripStatusEvent(
          vehicleUnit: '1001', date: testDate));
      await Future.delayed(const Duration(milliseconds: 50));
      bloc.add(const ChangePreTripVehicleEvent('1002'));
      await Future.delayed(const Duration(milliseconds: 50));

      final lastLoaded =
          states.whereType<PreTripStatusLoaded>().lastOrNull;
      expect(lastLoaded, isNotNull);
      expect(lastLoaded!.selectedVehicleUnit, '1002');

      await sub.cancel();
      bloc.close();
    });

    test('UpdatePreTripItemEvent is ignored when not in PreTripInProgress', () async {
      final bloc = PreTripBloc(repository: repo);
      final states = <PreTripState>[];
      final sub = bloc.stream.listen(states.add);

      // Don't start inspection — state is still PreTripInitial
      bloc.add(const UpdatePreTripItemEvent(
        itemCode: 'AIR_BRAKE_01',
        status: InspectionItemStatus.majorDefect,
      ));
      await Future.delayed(const Duration(milliseconds: 30));

      // Should emit nothing
      expect(states.isEmpty, true);

      await sub.cancel();
      bloc.close();
    });

    test('SubmitPreTripInspectionEvent is ignored when not in PreTripInProgress', () async {
      final bloc = PreTripBloc(repository: repo);
      final states = <PreTripState>[];
      final sub = bloc.stream.listen(states.add);

      bloc.add(const SubmitPreTripInspectionEvent(
        odometer: 0,
        signatureName: 'Nobody',
        inspectionTime: '08:00',
      ));
      await Future.delayed(const Duration(milliseconds: 30));

      expect(states.isEmpty, true);

      await sub.cancel();
      bloc.close();
    });
  });
}
