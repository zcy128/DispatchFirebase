import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import { Student, StudentStats } from '../types/student';

export const calculateStudentStats = (students: Student[]): StudentStats => {
  const total = students.length;
  let active = 0;
  let metAtBus = 0;
  const routesSet = new Set<string>();
  const gradeDist: Record<string, number> = {};
  const schoolDist: Record<string, number> = {};

  students.forEach((s) => {
    if (s.active) active++;
    if (s.metatBus) metAtBus++;
    if (s.grade) {
      gradeDist[s.grade] = (gradeDist[s.grade] || 0) + 1;
    }
    if (s.schoolName) {
      schoolDist[s.schoolName] = (schoolDist[s.schoolName] || 0) + 1;
    }
    if (s.routes) {
      s.routes.split(',').forEach((rt) => {
        const cleaned = rt.trim();
        if (cleaned) routesSet.add(cleaned);
      });
    }
  });

  return {
    totalStudents: total,
    activeStudents: active,
    metAtBusCount: metAtBus,
    routesCovered: routesSet.size,
    gradeDistribution: gradeDist,
    schoolDistribution: schoolDist
  };
};

export const StudentService = {
  // Pure real-time onSnapshot listener (Zero API server traffic)
  subscribeToStudents: (
    onUpdate: (students: Student[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      console.warn('[StudentService] Firestore SDK not initialized, falling back to REST');
      StudentService.list().then(onUpdate).catch(onError);
      return () => {};
    }

    try {
      const q = query(collection(db, 'students'), orderBy('studentNo', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: Student[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as Student;
            list.push({
              ...data,
              id: doc.id
            });
          });
          onUpdate(list);
        },
        (error) => {
          console.error('[StudentService] onSnapshot listener error:', error);
          if (onError) onError(error);
          // Fallback to REST API
          StudentService.list().then(onUpdate).catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[StudentService] Exception creating onSnapshot listener:', e);
      StudentService.list().then(onUpdate).catch(onError);
      return () => {};
    }
  },

  list: async (params?: { search?: string; schoolId?: number; grade?: string; route?: string }): Promise<Student[]> => {
    let queryStr = '';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.schoolId) searchParams.append('schoolId', String(params.schoolId));
      if (params.grade) searchParams.append('grade', params.grade);
      if (params.route) searchParams.append('route', params.route);
      const str = searchParams.toString();
      if (str) queryStr = `?${str}`;
    }
    return apiRequest<Student[]>(`/api/students${queryStr}`);
  },

  getById: async (id: string): Promise<Student> => {
    return apiRequest<Student>(`/api/students/${id}`);
  },

  create: async (student: Partial<Student>): Promise<Student> => {
    return apiRequest<Student>('/api/students', {
      method: 'POST',
      body: JSON.stringify(student)
    });
  },

  update: async (id: string, student: Partial<Student>): Promise<Student> => {
    return apiRequest<Student>(`/api/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(student)
    });
  },

  delete: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/students/${id}`, {
      method: 'DELETE'
    });
  },

  getStats: async (): Promise<StudentStats> => {
    return apiRequest<StudentStats>('/api/students/stats');
  }
};
