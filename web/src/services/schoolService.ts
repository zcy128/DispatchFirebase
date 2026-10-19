import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import { School, SchoolBoard, SchoolStats } from '../types/school';

export const calculateSchoolStats = (schools: School[], boards: SchoolBoard[]): SchoolStats => {
  const totalSchools = schools.length;
  const activeSchools = schools.filter(s => s.isActive).length;
  const totalBoards = boards.length;
  let totalStudents = 0;
  const boardDistribution: Record<string, number> = {};

  for (const s of schools) {
    totalStudents += s.studentNum || 0;
    const bName = s.schoolBoardCode || s.schoolBoardName || 'Other';
    boardDistribution[bName] = (boardDistribution[bName] || 0) + 1;
  }

  return {
    totalSchools,
    activeSchools,
    totalBoards,
    totalStudents,
    boardDistribution
  };
};

export const SchoolService = {
  // Pure real-time onSnapshot listener for Schools
  subscribeToSchools: (
    onUpdate: (schools: School[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      console.warn('[SchoolService] Firestore SDK not initialized, falling back to REST');
      SchoolService.list().then(onUpdate).catch(onError);
      return () => {};
    }

    try {
      const q = query(collection(db, 'schools'), orderBy('schoolName', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: School[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as School;
            list.push({
              ...data,
              id: doc.id
            });
          });
          onUpdate(list);
        },
        (error) => {
          console.error('[SchoolService] onSnapshot listener error:', error);
          if (onError) onError(error);
          SchoolService.list().then(onUpdate).catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[SchoolService] Exception creating onSnapshot listener:', e);
      SchoolService.list().then(onUpdate).catch(onError);
      return () => {};
    }
  },

  // Pure real-time onSnapshot listener for School Boards
  subscribeToSchoolBoards: (
    onUpdate: (boards: SchoolBoard[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      SchoolService.listBoards().then(onUpdate).catch(onError);
      return () => {};
    }

    try {
      const q = query(collection(db, 'school_boards'), orderBy('schoolBoardName', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: SchoolBoard[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as SchoolBoard;
            list.push({
              ...data,
              id: doc.id
            });
          });
          onUpdate(list);
        },
        (error) => {
          console.error('[SchoolBoard] onSnapshot listener error:', error);
          if (onError) onError(error);
          SchoolService.listBoards().then(onUpdate).catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[SchoolBoard] Exception creating onSnapshot listener:', e);
      SchoolService.listBoards().then(onUpdate).catch(onError);
      return () => {};
    }
  },

  list: async (): Promise<School[]> => {
    return apiRequest<School[]>('/api/schools');
  },

  getById: async (id: string): Promise<School> => {
    return apiRequest<School>(`/api/schools/${id}`);
  },

  create: async (schoolData: Partial<School>): Promise<School> => {
    try {
      return await apiRequest<School>('/api/schools', {
        method: 'POST',
        body: JSON.stringify(schoolData)
      });
    } catch (e) {
      // Direct Firestore fallback if Cloud Run API is pending
      if (db) {
        const id = schoolData.id || `SCH-${Date.now().toString().slice(-4)}`;
        const docRef = doc(db, 'schools', id);
        const newSchool = {
          ...schoolData,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as School;
        await setDoc(docRef, newSchool);
        return newSchool;
      }
      throw e;
    }
  },

  update: async (id: string, schoolData: Partial<School>): Promise<School> => {
    try {
      return await apiRequest<School>(`/api/schools/${id}`, {
        method: 'PUT',
        body: JSON.stringify(schoolData)
      });
    } catch (e) {
      if (db) {
        const docRef = doc(db, 'schools', id);
        const updated = {
          ...schoolData,
          id,
          updatedAt: new Date().toISOString()
        } as School;
        await setDoc(docRef, updated, { merge: true });
        return updated;
      }
      throw e;
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiRequest<void>(`/api/schools/${id}`, {
        method: 'DELETE'
      });
    } catch (e) {
      if (db) {
        await deleteDoc(doc(db, 'schools', id));
        return;
      }
      throw e;
    }
  },

  // School Board methods
  listBoards: async (): Promise<SchoolBoard[]> => {
    return apiRequest<SchoolBoard[]>('/api/school-boards');
  },

  createBoard: async (boardData: Partial<SchoolBoard>): Promise<SchoolBoard> => {
    try {
      return await apiRequest<SchoolBoard>('/api/school-boards', {
        method: 'POST',
        body: JSON.stringify(boardData)
      });
    } catch (e) {
      if (db) {
        const id = boardData.id || `BOARD-${(boardData.schoolBoardCode || 'NEW').toUpperCase()}`;
        const docRef = doc(db, 'school_boards', id);
        const newBoard = {
          ...boardData,
          id
        } as SchoolBoard;
        await setDoc(docRef, newBoard);
        return newBoard;
      }
      throw e;
    }
  },

  updateBoard: async (id: string, boardData: Partial<SchoolBoard>): Promise<SchoolBoard> => {
    try {
      return await apiRequest<SchoolBoard>(`/api/school-boards/${id}`, {
        method: 'PUT',
        body: JSON.stringify(boardData)
      });
    } catch (e) {
      if (db) {
        const docRef = doc(db, 'school_boards', id);
        await setDoc(docRef, { ...boardData, id }, { merge: true });
        return { ...boardData, id } as SchoolBoard;
      }
      throw e;
    }
  },

  deleteBoard: async (id: string): Promise<void> => {
    try {
      await apiRequest<void>(`/api/school-boards/${id}`, {
        method: 'DELETE'
      });
    } catch (e) {
      if (db) {
        await deleteDoc(doc(db, 'school_boards', id));
        return;
      }
      throw e;
    }
  }
};
