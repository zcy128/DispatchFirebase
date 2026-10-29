import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../models/company_contact_model.dart';

class CompanyContactsRepository {
  final FirebaseFirestore _firestore;

  CompanyContactsRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const List<CompanyContactModel> defaultContacts = [
    CompanyContactModel(
      id: 'CC-01',
      name: '24/7 Dispatch Operations Desk',
      title: 'Central Dispatch Command',
      department: 'Operations',
      phone: '613-555-0100',
      extension: 'Ext. 101',
      email: 'dispatch@dispatch.local',
      hours: '24 Hours / 7 Days',
      is24x7: true,
      notes: 'Primary channel for on-road bus issues, route diversions, and delays',
    ),
    CompanyContactModel(
      id: 'CC-02',
      name: 'Student Incident & Safety Emergency Line',
      title: 'Student Care Safety Officer',
      department: 'Emergency',
      phone: '613-555-0199',
      extension: 'Hotline',
      email: 'safety-desk@dispatch.local',
      hours: '24 Hours / 7 Days',
      is24x7: true,
      notes: 'Urgent behavioral incidents, child welfare, missing passengers',
    ),
    CompanyContactModel(
      id: 'CC-03',
      name: 'Fleet Maintenance & Roadside Recovery',
      title: 'Head Mechanic & Shop Dispatch',
      department: 'Fleet',
      phone: '613-555-0150',
      extension: 'Ext. 204',
      email: 'fleet-shop@dispatch.local',
      hours: '05:00 AM - 08:00 PM',
      is24x7: false,
      notes: 'Mechanical breakdowns, flat tires, emergency bus towing',
    ),
    CompanyContactModel(
      id: 'CC-04',
      name: 'Human Resources & Crew Staffing',
      title: 'HR Employee Relations Manager',
      department: 'HR',
      phone: '613-555-0120',
      extension: 'Ext. 305',
      email: 'hr@dispatch.local',
      hours: '08:00 AM - 05:00 PM',
      is24x7: false,
      notes: 'Staff absence coverage, benefits, CDL compliance certification',
    ),
    CompanyContactModel(
      id: 'CC-05',
      name: 'Safety Training & Recertification Office',
      title: 'Chief Driver Instructor',
      department: 'Training',
      phone: '613-555-0133',
      extension: 'Ext. 402',
      email: 'training@dispatch.local',
      hours: '07:30 AM - 04:30 PM',
      is24x7: false,
      notes: 'Driver evaluations, defensive driving refresher seminars',
    ),
    CompanyContactModel(
      id: 'CC-06',
      name: 'Driver Payroll & Compensation Office',
      title: 'Payroll Coordinator',
      department: 'Finance',
      phone: '613-555-0144',
      extension: 'Ext. 501',
      email: 'payroll@dispatch.local',
      hours: '08:30 AM - 04:30 PM',
      is24x7: false,
      notes: 'Bi-weekly timesheets, charter mileage adjustments, expense payouts',
    ),
  ];

  Stream<List<CompanyContactModel>> streamContacts() {
    try {
      return _firestore
          .collection('company_contacts')
          .snapshots()
          .map((snapshot) {
        if (snapshot.docs.isEmpty) {
          return defaultContacts;
        }
        final list = snapshot.docs.map((doc) {
          return CompanyContactModel.fromMap(doc.data(), doc.id);
        }).toList();

        list.sort((a, b) => a.id.compareTo(b.id));
        return list;
      }).handleError((err) {
        debugPrint('[CompanyContactsRepository] Stream notice: $err');
        return defaultContacts;
      });
    } catch (e) {
      debugPrint('[CompanyContactsRepository] catch error: $e');
      return Stream.value(defaultContacts);
    }
  }
}
