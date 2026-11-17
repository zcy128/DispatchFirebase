import { describe, expect, it } from 'vitest';
import { buildStudentPdf } from './studentPdfExporter';
import type { Student, StudentStop } from '../types/student';

const makeStudent = (overrides: Partial<Student> = {}): Student => ({
  id: 'STU-1',
  studentId: 9,
  studentNo: '0009',
  firstName: 'Noah',
  lastName: 'Garcia',
  fullName: 'Noah Garcia',
  studentName: 'Noah Garcia',
  grade: '10',
  gender: 'Male',
  metatBus: false,
  active: true,
  schoolId: 101,
  schoolName: 'Hillcrest High School',
  routes: 'OCDSB-001, OCDSB-031',
  studentAddress: '9430 Merivale Rd, Kanata, ON',
  studentPhone: '613-555-0101',
  contacts: [
    {
      contactId: 'C1',
      studentId: 9,
      contactIndex: 1,
      primaryContact: true,
      contactName: 'Maria Garcia',
      relationship: 'Mother',
      mobilePhone: '613-555-0102',
      email: 'maria@example.com',
      active: true,
    },
  ],
  ...overrides,
});

describe('studentPdfExporter', () => {
  it('places student profile on page 1 and stops on a separate page', () => {
    const stops: StudentStop[] = [
      {
        stopId: '1',
        time: '07:31',
        type: 'HomePickup',
        opDays: 'MTWRF',
        location: '9430 Merivale Rd, Kanata, ON',
        route: 'OCDSB-001',
        shift: 'AM',
      },
      {
        stopId: '2',
        time: '08:30',
        type: 'SchoolDropoff',
        opDays: 'MTWRF',
        location: 'Hillcrest High School',
        route: 'OCDSB-001',
        shift: 'AM',
      },
    ];

    const doc = buildStudentPdf({
      student: makeStudent(),
      stops,
    });

    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('still creates a separate page 2 for stops even when stops list is empty', () => {
    const doc = buildStudentPdf({
      student: makeStudent(),
      stops: [],
    });

    expect(doc.getNumberOfPages()).toBe(2);
  });
});
