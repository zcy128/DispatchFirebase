import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/features/company_contacts/models/company_contact_model.dart';
import 'package:driver_app/features/company_contacts/presentation/company_contacts_page.dart';
import 'package:driver_app/features/company_contacts/presentation/widgets/company_contact_card.dart';
import 'package:driver_app/features/company_contacts/presentation/widgets/company_contact_empty_state.dart';
import 'package:driver_app/features/company_contacts/presentation/widgets/company_contact_filter_pills.dart';

void main() {
  group('CompanyContactModel Tests', () {
    test('toMap and fromMap preserves all fields correctly', () {
      const original = CompanyContactModel(
        id: 'CC-99',
        name: 'Jane Doe',
        title: 'Safety Manager',
        department: 'Operations',
        phone: '613-555-9999',
        extension: 'Ext. 99',
        email: 'jane@example.com',
        hours: '08:00 AM - 05:00 PM',
        is24x7: true,
        notes: 'Available for critical emergencies only',
      );

      final map = original.toMap();
      final restored = CompanyContactModel.fromMap(map, original.id);

      expect(restored.id, original.id);
      expect(restored.name, original.name);
      expect(restored.title, original.title);
      expect(restored.department, original.department);
      expect(restored.phone, original.phone);
      expect(restored.extension, original.extension);
      expect(restored.email, original.email);
      expect(restored.hours, original.hours);
      expect(restored.is24x7, isTrue);
      expect(restored.notes, original.notes);
    });
  });

  group('Company Contacts Component Tests', () {
    testWidgets('CompanyContactFilterPills renders chips and handles selection', (tester) async {
      String selected = 'ALL';
      final depts = ['ALL', 'Operations', 'Emergency', 'Fleet'];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return CompanyContactFilterPills(
                  departments: depts,
                  selectedDepartment: selected,
                  onDepartmentSelected: (newDept) {
                    setState(() => selected = newDept);
                  },
                );
              },
            ),
          ),
        ),
      );

      expect(find.text('ALL'), findsOneWidget);
      expect(find.text('Operations'), findsOneWidget);
      expect(find.text('Emergency'), findsOneWidget);
      expect(find.text('Fleet'), findsOneWidget);

      await tester.tap(find.text('Emergency'));
      await tester.pumpAndSettle();

      expect(selected, 'Emergency');
    });

    testWidgets('CompanyContactEmptyState renders correctly with and without query', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CompanyContactEmptyState(hasQuery: false),
          ),
        ),
      );

      expect(find.text('No company contacts available'), findsOneWidget);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CompanyContactEmptyState(hasQuery: true),
          ),
        ),
      );

      expect(find.text('No matching contacts found'), findsOneWidget);
    });

    testWidgets('CompanyContactCard renders 24/7 badge, info, and handles button actions', (tester) async {
      const contact = CompanyContactModel(
        id: 'CC-01',
        name: '24/7 Dispatch Desk',
        title: 'Central Command',
        department: 'Operations',
        phone: '613-555-0100',
        extension: 'Ext. 101',
        email: 'dispatch@dispatch.local',
        hours: '24 Hours / 7 Days',
        is24x7: true,
        notes: 'Primary dispatch communication line',
      );

      bool called = false;
      bool emailed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CompanyContactCard(
              contact: contact,
              onCall: () => called = true,
              onEmail: () => emailed = true,
            ),
          ),
        ),
      );

      expect(find.text('24/7 Dispatch Desk'), findsOneWidget);
      expect(find.text('Central Command'), findsOneWidget);
      expect(find.text('24/7 LIVE'), findsOneWidget);
      expect(find.text('OPERATIONS'), findsOneWidget);
      expect(find.text('613-555-0100 (Ext. 101)'), findsOneWidget);
      expect(find.text('Primary dispatch communication line'), findsOneWidget);

      // Tap call button
      await tester.tap(find.byType(ElevatedButton));
      expect(called, isTrue);

      // Tap email button
      await tester.tap(find.byType(OutlinedButton));
      expect(emailed, isTrue);
    });

    testWidgets('CompanyContactCard renders long text safely without overflow', (tester) async {
      const contact = CompanyContactModel(
        id: 'CC-LONG',
        name: 'Very Long Operations Command Center and Regional Liaison Officer Name',
        title: 'Senior Regional Operations Coordinator & Pupil Safety Protocol Director',
        department: 'Emergency',
        phone: '1-800-555-0199',
        extension: 'Ext. 998877',
        email: 'very-long-emergency-safety-officer-direct-desk@schoolboard.example.com',
        hours: '06:00 AM - 09:00 PM EST (Monday to Friday, On-Call Weekends)',
        is24x7: true,
        notes: 'Comprehensive multi-line notes regarding escalation protocols and safety checks.',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: CompanyContactCard(
                contact: contact,
                onCall: () {},
                onEmail: () {},
              ),
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('EMERGENCY'), findsOneWidget);
      expect(find.text('24/7 LIVE'), findsOneWidget);
    });

    testWidgets('CompanyContactsPage filters contacts via search query and department', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: CompanyContactsPage(),
        ),
      );

      await tester.pumpAndSettle();

      // Check default items are loaded
      expect(find.text('Company Contacts'), findsOneWidget);
      expect(find.text('24/7 Dispatch Operations Desk'), findsOneWidget);

      // Search for "Fleet"
      await tester.enterText(find.byType(TextField), 'Fleet');
      await tester.pumpAndSettle();

      expect(find.text('Fleet Maintenance & Roadside Recovery'), findsOneWidget);
      expect(find.text('24/7 Dispatch Operations Desk'), findsNothing);

      // Clear search
      await tester.tap(find.byIcon(Icons.clear));
      await tester.pumpAndSettle();

      expect(find.text('24/7 Dispatch Operations Desk'), findsOneWidget);
    });
  });
}
