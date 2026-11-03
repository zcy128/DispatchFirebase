import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/pretrip/models/pretrip_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Pretrip Enums & API Values Mapping', () {
    test('InspectionItemStatus correctly maps to and from API values', () {
      expect(InspectionItemStatus.fromApiValue('pass'), equals(InspectionItemStatus.pass));
      expect(InspectionItemStatus.fromApiValue('minor_defect'), equals(InspectionItemStatus.minorDefect));
      expect(InspectionItemStatus.fromApiValue('major_defect'), equals(InspectionItemStatus.majorDefect));
      expect(InspectionItemStatus.fromApiValue('na'), equals(InspectionItemStatus.notApplicable));
      expect(InspectionItemStatus.fromApiValue('unknown'), equals(InspectionItemStatus.pass));

      expect(InspectionItemStatus.pass.apiValue, equals('pass'));
      expect(InspectionItemStatus.minorDefect.apiValue, equals('minor_defect'));
      expect(InspectionItemStatus.majorDefect.apiValue, equals('major_defect'));
      expect(InspectionItemStatus.notApplicable.apiValue, equals('na'));

      expect(InspectionItemStatus.pass.label, equals('Pass'));
      expect(InspectionItemStatus.minorDefect.label, equals('Minor Defect'));
      expect(InspectionItemStatus.majorDefect.label, equals('Major Defect'));
      expect(InspectionItemStatus.notApplicable.label, equals('N/A'));
    });

    test('OverallInspectionStatus correctly maps to and from API values', () {
      expect(OverallInspectionStatus.fromApiValue('passed'), equals(OverallInspectionStatus.passed));
      expect(OverallInspectionStatus.fromApiValue('passed_with_minor_defects'), equals(OverallInspectionStatus.passedWithMinorDefects));
      expect(OverallInspectionStatus.fromApiValue('failed_major_defects'), equals(OverallInspectionStatus.failedMajorDefects));
      expect(OverallInspectionStatus.fromApiValue('other'), equals(OverallInspectionStatus.passed));

      expect(OverallInspectionStatus.passed.apiValue, equals('passed'));
      expect(OverallInspectionStatus.passedWithMinorDefects.apiValue, equals('passed_with_minor_defects'));
      expect(OverallInspectionStatus.failedMajorDefects.apiValue, equals('failed_major_defects'));

      expect(OverallInspectionStatus.passed.label, equals('Passed'));
      expect(OverallInspectionStatus.passedWithMinorDefects.label, equals('Passed — Minor Defects'));
      expect(OverallInspectionStatus.failedMajorDefects.label, equals('Failed — Major Defects'));
    });
  });

  group('Overall Inspection Status Calculation Rules', () {
    OverallInspectionStatus evaluateOverallStatus(Map<String, InspectionItemResult> items) {
      final hasMajor = items.values.any((i) => i.status == InspectionItemStatus.majorDefect);
      final hasMinor = items.values.any((i) => i.status == InspectionItemStatus.minorDefect);
      return hasMajor
          ? OverallInspectionStatus.failedMajorDefects
          : (hasMinor
              ? OverallInspectionStatus.passedWithMinorDefects
              : OverallInspectionStatus.passed);
    }

    test('evaluates to passed when all items are pass or na', () {
      final items = {
        'brakes': const InspectionItemResult(code: 'brakes', title: 'Brakes', category: 'Mechanical', status: InspectionItemStatus.pass),
        'lights': const InspectionItemResult(code: 'lights', title: 'Lights', category: 'Electrical', status: InspectionItemStatus.pass),
        'wheelchair_lift': const InspectionItemResult(code: 'wheelchair_lift', title: 'Lift', category: 'Accessibility', status: InspectionItemStatus.notApplicable),
      };

      expect(evaluateOverallStatus(items), equals(OverallInspectionStatus.passed));
    });

    test('evaluates to passedWithMinorDefects when minor defect is present without major defect', () {
      final items = {
        'brakes': const InspectionItemResult(code: 'brakes', title: 'Brakes', category: 'Mechanical', status: InspectionItemStatus.pass),
        'washer_fluid': const InspectionItemResult(code: 'washer_fluid', title: 'Washer Fluid Low', category: 'Fluids', status: InspectionItemStatus.minorDefect),
      };

      expect(evaluateOverallStatus(items), equals(OverallInspectionStatus.passedWithMinorDefects));
    });

    test('evaluates to failedMajorDefects when any major defect exists, regardless of minor defects or pass counts', () {
      final items = {
        'brakes': const InspectionItemResult(code: 'brakes', title: 'Service Brakes Ineffective', category: 'Mechanical', status: InspectionItemStatus.majorDefect),
        'washer_fluid': const InspectionItemResult(code: 'washer_fluid', title: 'Washer Fluid Low', category: 'Fluids', status: InspectionItemStatus.minorDefect),
        'lights': const InspectionItemResult(code: 'lights', title: 'Headlights', category: 'Electrical', status: InspectionItemStatus.pass),
      };

      expect(evaluateOverallStatus(items), equals(OverallInspectionStatus.failedMajorDefects));
    });
  });

  group('PreTripInspectionRecord Serialization & Integrity', () {
    test('record serializes to map and deserializes without losing odometer or items', () {
      final record = PreTripInspectionRecord(
        id: 'rec-001',
        vehicleUnit: 'BUS-42',
        vehicleId: 42,
        vehiclePlate: 'ONT-889',
        inspectionDate: '2026-11-02',
        inspectionTime: '06:45',
        inspectorId: 'EMP-2001',
        inspectorName: 'John Doe',
        odometer: 145230,
        overallStatus: OverallInspectionStatus.passedWithMinorDefects,
        items: const {
          'tires': InspectionItemResult(
            code: 'tires',
            title: 'Tires & Wheels',
            category: 'Safety',
            status: InspectionItemStatus.pass,
          ),
          'wipers': InspectionItemResult(
            code: 'wipers',
            title: 'Wipers Worn',
            category: 'Visibility',
            status: InspectionItemStatus.minorDefect,
            notes: 'Left wiper streaking slightly',
          ),
        },
        defectNotes: 'Reported left wiper to maintenance shop',
        signatureName: 'John Doe',
        createdAt: DateTime(2026, 11, 2, 6, 45),
        updatedAt: DateTime(2026, 11, 2, 6, 45),
      );

      final map = record.toMap();
      final revived = PreTripInspectionRecord.fromMap(map);

      expect(revived.id, equals('rec-001'));
      expect(revived.odometer, equals(145230));
      expect(revived.overallStatus, equals(OverallInspectionStatus.passedWithMinorDefects));
      expect(revived.items.length, equals(2));
      expect(revived.items['wipers']?.notes, equals('Left wiper streaking slightly'));
      expect(revived.signatureName, equals('John Doe'));
    });
  });
}
