import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/student_incident/models/student_incident_model.dart';
import 'package:driver_app/features/student_incident/bloc/student_incident_state.dart';

void main() {
  group('StudentIncidentStatus Enum Tests', () {
    test('fromApiValue correctly parses status values', () {
      expect(
        StudentIncidentStatus.fromApiValue('submitted'),
        equals(StudentIncidentStatus.submitted),
      );
      expect(
        StudentIncidentStatus.fromApiValue('under_investigation'),
        equals(StudentIncidentStatus.underInvestigation),
      );
      expect(
        StudentIncidentStatus.fromApiValue('investigating'),
        equals(StudentIncidentStatus.underInvestigation),
      );
      expect(
        StudentIncidentStatus.fromApiValue('parent_contacted'),
        equals(StudentIncidentStatus.parentContacted),
      );
      expect(
        StudentIncidentStatus.fromApiValue('parent_notified'),
        equals(StudentIncidentStatus.parentContacted),
      );
      expect(
        StudentIncidentStatus.fromApiValue('school_notified'),
        equals(StudentIncidentStatus.schoolNotified),
      );
      expect(
        StudentIncidentStatus.fromApiValue('closed'),
        equals(StudentIncidentStatus.closed),
      );
      expect(
        StudentIncidentStatus.fromApiValue('resolved'),
        equals(StudentIncidentStatus.closed),
      );
      expect(
        StudentIncidentStatus.fromApiValue('unknown_value'),
        equals(StudentIncidentStatus.submitted),
      );
    });

    test('label and apiValue match specifications', () {
      expect(StudentIncidentStatus.submitted.label, equals('Submitted'));
      expect(StudentIncidentStatus.underInvestigation.label, equals('Under Investigation'));
      expect(StudentIncidentStatus.parentContacted.label, equals('Parent Contacted'));
      expect(StudentIncidentStatus.schoolNotified.label, equals('School Notified'));
      expect(StudentIncidentStatus.closed.label, equals('Closed'));

      expect(StudentIncidentStatus.submitted.apiValue, equals('submitted'));
      expect(StudentIncidentStatus.underInvestigation.apiValue, equals('under_investigation'));
      expect(StudentIncidentStatus.parentContacted.apiValue, equals('parent_contacted'));
      expect(StudentIncidentStatus.schoolNotified.apiValue, equals('school_notified'));
      expect(StudentIncidentStatus.closed.apiValue, equals('closed'));
    });
  });

  group('StudentIncident Model Serialization Tests', () {
    test('StudentIncident serializes toMap and deserializes fromMap accurately', () {
      final now = DateTime.utc(2026, 9, 30, 14, 30);
      final incident = StudentIncident(
        id: 'inc-101',
        incidentDate: '2026-09-30',
        incidentTime: '14:30',
        studentId: 105,
        studentNo: 'STU-105',
        studentName: 'Alice Walker',
        grade: '10',
        schoolId: 1,
        schoolName: 'Maple Ridge High School',
        routeId: 12,
        routeNo: 'R-42',
        routeName: 'East Express',
        shiftType: 'PM',
        driverId: 'D-99',
        driverName: 'John Smith',
        location: 'Row 4 bus aisle',
        incidentTypes: const ['verbal_conflict', 'safety_violation'],
        typeOther: '',
        description: 'Argument over seating arrangements; refused to follow safety instructions.',
        otherStudentsInvolved: 'Bob Vance',
        witnesses: 'Charlie Brown',
        immediateActionTaken: 'Assigned new seat in row 2.',
        studentRemovedFromBus: false,
        firstAidRequired: false,
        parentsNotified: true,
        parentsNotificationDetail: 'Spoke with mother at 4 PM.',
        status: StudentIncidentStatus.underInvestigation,
        officeFollowUp: IncidentOfficeFollowUp(
          reviewedDate: '2026-09-30',
          administratorName: 'Principal Green',
          disciplinaryActions: const ['verbal_warning', 'parent_conference'],
          officeNotes: 'Conference scheduled for Friday.',
          isOfficeLocked: false,
          reviewedAt: now,
        ),
        createdAt: now,
        updatedAt: now,
      );

      final map = incident.toMap();
      expect(map['id'], equals('inc-101'));
      expect(map['studentName'], equals('Alice Walker'));
      expect(map['status'], equals('under_investigation'));
      expect(map['incidentTypes'], equals(['verbal_conflict', 'safety_violation']));
      expect(map['parentsNotified'], isTrue);

      final restored = StudentIncident.fromMap(map);
      expect(restored.id, equals(incident.id));
      expect(restored.studentName, equals(incident.studentName));
      expect(restored.status, equals(StudentIncidentStatus.underInvestigation));
      expect(restored.incidentTypes, equals(incident.incidentTypes));
      expect(restored.needsOfficeReview, isTrue);
      expect(restored.officeFollowUp, isNotNull);
      expect(restored.officeFollowUp!.administratorName, equals('Principal Green'));
      expect(restored.officeFollowUp!.disciplinaryActions, equals(['verbal_warning', 'parent_conference']));
    });

    test('toCreatePayload excludes system timestamps and includes correct parameters', () {
      final incident = StudentIncident(
        id: '',
        incidentDate: '2026-09-30',
        incidentTime: '08:15',
        studentId: 202,
        studentNo: 'STU-202',
        studentName: 'David Miller',
        schoolName: 'Oak Elementary',
        routeNo: 'R-10',
        driverId: 'DRV-1',
        driverName: 'Driver One',
        location: 'Bus step well',
        incidentTypes: const ['physical_altercation'],
        description: 'Pushing on stairs during exit.',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final payload = incident.toCreatePayload();
      expect(payload.containsKey('id'), isFalse);
      expect(payload['studentName'], equals('David Miller'));
      expect(payload['incidentDate'], equals('2026-09-30'));
      expect(payload['incidentTime'], equals('08:15'));
      expect(payload['incidentTypes'], equals(['physical_altercation']));
    });

    test('formattedTypesSummary formats category keys to human-readable strings', () {
      final incident = StudentIncident(
        id: '1',
        incidentDate: '2026-09-30',
        incidentTime: '08:00',
        studentName: 'Student A',
        routeNo: '1',
        driverId: '1',
        driverName: 'D',
        description: 'Test',
        incidentTypes: const ['physical_altercation', 'bullying_or_harassment'],
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      expect(
        incident.formattedTypesSummary,
        equals('Physical Altercation, Bullying / Harassment'),
      );
    });
  });

  group('StudentIncidentState and Roster Option Tests', () {
    test('StudentIncidentLoaded calculates pendingReviewCount accurately', () {
      final now = DateTime.now();
      final r1 = StudentIncident(
        id: '1',
        incidentDate: '2026-09-30',
        incidentTime: '08:00',
        studentName: 'A',
        routeNo: '1',
        driverId: '1',
        driverName: 'D',
        description: 'Test',
        status: StudentIncidentStatus.submitted,
        createdAt: now,
        updatedAt: now,
      );
      final r2 = StudentIncident(
        id: '2',
        incidentDate: '2026-09-30',
        incidentTime: '08:00',
        studentName: 'B',
        routeNo: '1',
        driverId: '1',
        driverName: 'D',
        description: 'Test',
        status: StudentIncidentStatus.closed,
        createdAt: now,
        updatedAt: now,
      );

      final state = StudentIncidentLoaded(reports: [r1, r2]);
      expect(state.pendingReviewCount, equals(1));
    });

    test('RosterStudentOption generates correct subtitle', () {
      const opt = RosterStudentOption(
        key: 'id_101',
        studentId: 101,
        studentNo: 'S-101',
        studentName: 'Emma Watson',
        grade: '9',
        schoolName: 'St. Mary High School',
        routeNo: 'Route 15',
      );

      expect(opt.displaySubtitle, equals('Gr 9 · St. Mary High School · Rte Route 15'));
    });
  });
}
