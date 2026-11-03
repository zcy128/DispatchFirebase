import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/core/models.dart';
import 'package:parent_app/features/schedule/presentation/schedule_screen.dart';

void main() {
  group('ScheduleScreen Widget Tests', () {
    ParentStudentCommute createStudent(int id, String name, String school) {
      return ParentStudentCommute(
        studentId: id,
        studentNo: 'STU-00$id',
        studentName: name,
        grade: 'Grade 3',
        schoolName: school,
        avatarColor: '#2563EB',
        shiftType: 'AM',
        shiftId: 'shift_$id',
        routeNo: '101',
        busUnitNumber: '42',
        driverName: 'Robert Smith',
        stopLocation: 'Woodroffe Ave & Baseline Rd',
        stopType: 'PICKUP',
        scheduledTime: '07:35 AM',
        estimatedTime: '07:38 AM',
        lateMinutes: 3,
        status: 'EN_ROUTE',
      );
    }

    testWidgets('renders empty placeholder when students list is empty', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ScheduleScreen(students: []),
        ),
      );
      await tester.pump();

      expect(find.text('No route schedule available'), findsOneWidget);
    });

    testWidgets('renders master schedule and weekday timetable for active student', (tester) async {
      final students = [
        createStudent(1, 'Emma Watson', 'Broadview Public School'),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: ScheduleScreen(students: students),
        ),
      );
      await tester.pump();

      expect(find.text('Route Master Schedule'), findsOneWidget);
      expect(find.text('Route 101'), findsOneWidget);
      expect(find.text('Emma Watson'), findsOneWidget);
      expect(find.text('Broadview Public School'), findsOneWidget);
      // Fast weekday matrix
      expect(find.text('MON'), findsOneWidget);
      expect(find.text('FRI'), findsOneWidget);
    });

    testWidgets('allows switching between multiple students', (tester) async {
      int? switchedIndex;
      final students = [
        createStudent(1, 'Emma Watson', 'Broadview Public School'),
        createStudent(2, 'Lucas Watson', 'Nepean High School'),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: ScheduleScreen(
            students: students,
            onStudentChanged: (idx) => switchedIndex = idx,
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Lucas Watson'), findsOneWidget);

      // Tap on Lucas Watson pill
      await tester.tap(find.text('Lucas Watson'));
      await tester.pumpAndSettle();

      expect(switchedIndex, equals(1));
      expect(find.text('Nepean High School'), findsOneWidget);
    });

    testWidgets('allows toggling shift filter chips', (tester) async {
      final students = [
        createStudent(1, 'Emma Watson', 'Broadview Public School'),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: ScheduleScreen(students: students),
        ),
      );
      await tester.pump();

      expect(find.text('All Shifts'), findsOneWidget);
      expect(find.text('🌅 AM Morning'), findsOneWidget);

      // Tap on AM filter chip
      await tester.tap(find.text('🌅 AM Morning'));
      await tester.pumpAndSettle();

      // Verify it is tapped without exception
      expect(find.text('🌅 AM Morning'), findsOneWidget);
    });
  });
}
