import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/defect/models/defect_model.dart';

void main() {
  group('DefectItemStatus', () {
    test('apiValue and fromApiValue round trip correctly', () {
      expect(DefectItemStatus.ok.apiValue, 'ok');
      expect(DefectItemStatus.defect.apiValue, 'defect');
      expect(DefectItemStatus.notApplicable.apiValue, 'na');

      expect(DefectItemStatus.fromApiValue('ok'), DefectItemStatus.ok);
      expect(DefectItemStatus.fromApiValue(0), DefectItemStatus.ok);
      expect(DefectItemStatus.fromApiValue('defect'), DefectItemStatus.defect);
      expect(DefectItemStatus.fromApiValue(1), DefectItemStatus.defect);
      expect(DefectItemStatus.fromApiValue('na'), DefectItemStatus.notApplicable);
      expect(DefectItemStatus.fromApiValue(2), DefectItemStatus.notApplicable);
    });
  });

  group('DefectReportStatus', () {
    test('apiValue and fromApiValue round trip correctly', () {
      expect(DefectReportStatus.submitted.apiValue, 'submitted');
      expect(DefectReportStatus.underAssessment.apiValue, 'under_assessment');
      expect(DefectReportStatus.underRepair.apiValue, 'under_repair');
      expect(DefectReportStatus.resolved.apiValue, 'resolved');

      expect(DefectReportStatus.fromApiValue('submitted'), DefectReportStatus.submitted);
      expect(DefectReportStatus.fromApiValue(1), DefectReportStatus.submitted);
      expect(DefectReportStatus.fromApiValue('under_assessment'), DefectReportStatus.underAssessment);
      expect(DefectReportStatus.fromApiValue(2), DefectReportStatus.underAssessment);
      expect(DefectReportStatus.fromApiValue('under_repair'), DefectReportStatus.underRepair);
      expect(DefectReportStatus.fromApiValue(3), DefectReportStatus.underRepair);
      expect(DefectReportStatus.fromApiValue('resolved'), DefectReportStatus.resolved);
      expect(DefectReportStatus.fromApiValue(4), DefectReportStatus.resolved);
    });
  });

  group('VehicleDefectReport serialization', () {
    test('toJson and fromJson preserves data integrity', () {
      final now = DateTime.now();
      final report = VehicleDefectReport(
        id: 'defect-101',
        vehicleId: 1021,
        vehicleUnitNumber: '1021',
        odometer: 145200,
        reportedByUserId: 'driver-1',
        reportedByName: 'John Smith',
        reportDate: '2026-09-30',
        reportTime: '15:30',
        items: const [
          DefectReportItem(
            id: 'brakes_abs_ebs',
            name: 'Brakes inc. ABS / EBS',
            category: 'Daily Check',
            status: DefectItemStatus.defect,
            notes: 'Spongy pedal',
          ),
          DefectReportItem(
            id: 'horn',
            name: 'Horn',
            category: 'Periodic Check',
            status: DefectItemStatus.ok,
          ),
        ],
        defectNotes: 'Brake pedal requires extra travel',
        noDefectsFound: false,
        confirmedAccurate: true,
        status: DefectReportStatus.underAssessment,
        assessment: const DefectAssessment(
          assessedBy: 'Fleet Lead Mike',
          repairLocation: 'Shop Bay 2',
          estimatedRepairDays: 2,
        ),
        createdAt: now,
        updatedAt: now,
      );

      final json = report.toJson();
      final parsed = VehicleDefectReport.fromJson(json);

      expect(parsed.id, report.id);
      expect(parsed.vehicleUnitNumber, '1021');
      expect(parsed.odometer, 145200);
      expect(parsed.defectCount, 1);
      expect(parsed.items.length, 2);
      expect(parsed.items.first.status, DefectItemStatus.defect);
      expect(parsed.items.first.notes, 'Spongy pedal');
      expect(parsed.assessment?.assessedBy, 'Fleet Lead Mike');
      expect(parsed.assessment?.estimatedRepairDays, 2);
    });
  });
}
