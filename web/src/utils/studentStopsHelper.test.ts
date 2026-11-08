import { describe, it, expect } from 'vitest';
import {
  generateDefaultStudentStops,
  extractStudentStopsFromShifts,
  resolveStudentEffectiveStops,
} from './studentStopsHelper';
import { Student } from '../types/student';
import { BusRouteShift } from '../types/route';

describe('studentStopsHelper', () => {
  describe('generateDefaultStudentStops', () => {
    it('generates 6 default stops for a student with address and route', () => {
      const stops = generateDefaultStudentStops(
        '3417 Bank St, Gloucester, ON',
        'All Saints High School',
        'OCSB-014, OCSB-044'
      );
      expect(stops).toHaveLength(6);
      expect(stops[0].type).toBe('Pickup');
      expect(stops[0].time).toBe('7:10 a.m.');
      expect(stops[0].location).toBe('3417 Bank St, Gloucester, ON');
      expect(stops[0].route).toBe('OCSB-014');
      expect(stops[1].type).toBe('School Dropoff');
      expect(stops[1].location).toBe('All Saints High School');
    });

    it('uses fallback values when address or school name is empty', () => {
      const stops = generateDefaultStudentStops('', '', '');
      expect(stops).toHaveLength(6);
      expect(stops[0].location).toBe('Home Stop (Curbside)');
      expect(stops[1].location).toBe("Children's Village School");
      expect(stops[0].route).toBe('OCDSB-001');
    });
  });

  describe('extractStudentStopsFromShifts', () => {
    it('extracts stops matching studentId from route shifts', () => {
      const mockShifts: BusRouteShift[] = [
        {
          id: 'shift-1',
          shiftId: 101,
          routeId: 'rt-1',
          routeNo: 'OCSB-014',
          routeName: 'All Saints Route 14',
          shiftType: 'AM',
          runDays: 'M T W R F',
          firstStopTime: '07:15',
          lastStopTime: '08:25',
          stops: [
            {
              stopId: 1,
              sequence: 1,
              stopLocation: '3417 Bank St',
              pullawayTime: '07:15 AM',
              stopType: 'HomePickup',
              assignedStudents: [
                {
                  studentId: 133,
                  studentNo: '0133',
                  studentName: 'Evelyn Rodriguez',
                },
              ],
            },
            {
              stopId: 2,
              sequence: 2,
              stopLocation: 'All Saints High School',
              pullawayTime: '08:25 AM',
              stopType: 'SchoolDropoff',
              assignedStudents: [
                {
                  studentId: 133,
                  studentNo: '0133',
                  studentName: 'Evelyn Rodriguez',
                },
              ],
            },
          ],
        },
      ];

      const stops = extractStudentStopsFromShifts(133, '0133', 'Evelyn Rodriguez', mockShifts);
      expect(stops).toHaveLength(2);
      expect(stops[0].location).toBe('3417 Bank St');
      expect(stops[0].time).toBe('07:15 AM');
      expect(stops[0].route).toBe('OCSB-014');
      expect(stops[1].location).toBe('All Saints High School');
    });

    it('returns empty array when shifts array is empty or no match is found', () => {
      const stops = extractStudentStopsFromShifts(999, '0999', 'Ghost Rider', []);
      expect(stops).toEqual([]);
    });
  });

  describe('resolveStudentEffectiveStops', () => {
    it('prioritizes explicit student.stops if already present', () => {
      const student: Student = {
        id: 'stu-1',
        studentId: 10,
        studentNo: '0010',
        firstName: 'John',
        lastName: 'Doe',
        studentName: 'John Doe',
        fullName: 'John Doe',
        studentAddress: '100 Main St',
        grade: '2',
        active: true,
        metatBus: false,
        schoolId: 1,
        schoolName: 'Public School A',
        stops: [
          {
            stopId: 'custom-1',
            time: '07:30 AM',
            type: 'Pickup',
            opDays: 'M T W R F',
            location: 'Custom Stop Location',
          },
        ],
      };

      const resolved = resolveStudentEffectiveStops(student);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].stopId).toBe('custom-1');
      expect(resolved[0].location).toBe('Custom Stop Location');
    });

    it('falls back to default generated stops when student has routes but no explicit stops', () => {
      const student: Student = {
        id: 'stu-2',
        studentId: 20,
        studentNo: '0020',
        firstName: 'Jane',
        lastName: 'Smith',
        studentName: 'Jane Smith',
        fullName: 'Jane Smith',
        studentAddress: '200 Elm St',
        grade: '4',
        active: true,
        metatBus: false,
        schoolId: 2,
        schoolName: 'Elementary School B',
        routes: 'OCDSB-044',
      };

      const resolved = resolveStudentEffectiveStops(student);
      expect(resolved).toHaveLength(6);
      expect(resolved[0].location).toBe('200 Elm St');
      expect(resolved[0].route).toBe('OCDSB-044');
      expect(resolved[1].location).toBe('Elementary School B');
    });
  });
});
