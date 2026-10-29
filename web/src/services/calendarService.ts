import { doc, getDoc, onSnapshot, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import { SchoolCalendar, CalendarEvent } from '../types/calendar';

export const CalendarService = {
  /**
   * Real-time subscription to all calendars in Firestore with local IndexedDB persistence
   */
  subscribeToAllCalendars: (
    onUpdate: (calendars: SchoolCalendar[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) return () => {};
    try {
      const collRef = collection(db, 'school_calendars');
      return onSnapshot(
        collRef,
        (snapshot) => {
          const list: SchoolCalendar[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as SchoolCalendar), id: d.id });
          });
          onUpdate(list);
        },
        (err) => {
          console.warn('[CalendarService] subscribeToAllCalendars notice:', err);
          if (onError) onError(err);
        }
      );
    } catch (e) {
      console.error('[CalendarService] subscribeToAllCalendars error:', e);
      return () => {};
    }
  },
  /**
   * Fetches calendar via Go backend API (with fallback to direct Firestore)
   */
  getCalendar: async (params: {
    scope: 'board' | 'school';
    boardId: number;
    schoolId?: number;
    year?: string;
  }): Promise<SchoolCalendar> => {
    const year = params.year || '2026-2027';
    const query = new URLSearchParams({
      scope: params.scope,
      boardId: String(params.boardId),
      year
    });
    if (params.schoolId) {
      query.append('schoolId', String(params.schoolId));
    }

    try {
      return await apiRequest<SchoolCalendar>(`/api/calendars?${query.toString()}`);
    } catch (apiErr) {
      console.warn('[CalendarService] API request failed, falling back to Firestore SDK:', apiErr);

      if (db) {
        // Fallback: check custom school calendar first if school scope
        if (params.scope === 'school' && params.schoolId) {
          const schoolDocRef = doc(db, 'school_calendars', `school_${params.schoolId}_${year}`);
          const schoolSnap = await getDoc(schoolDocRef);
          if (schoolSnap.exists()) {
            return { ...(schoolSnap.data() as SchoolCalendar), id: schoolSnap.id, isCustom: true };
          }
        }
        // Fallback to board calendar
        const boardDocRef = doc(db, 'school_calendars', `board_${params.boardId}_${year}`);
        const boardSnap = await getDoc(boardDocRef);
        if (boardSnap.exists()) {
          const data = boardSnap.data() as SchoolCalendar;
          return {
            ...data,
            id: boardSnap.id,
            isCustom: false
          };
        }
      }
      throw apiErr;
    }
  },

  /**
   * Subscribes to real-time updates for a calendar document
   */
  subscribeToCalendar: (
    docId: string,
    onUpdate: (cal: SchoolCalendar | null) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) return () => {};
    try {
      const docRef = doc(db, 'school_calendars', docId);
      return onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            onUpdate({ ...(snap.data() as SchoolCalendar), id: snap.id });
          } else {
            onUpdate(null);
          }
        },
        (err) => {
          console.warn('[CalendarService] onSnapshot listener error:', err);
          if (onError) onError(err);
        }
      );
    } catch (e) {
      console.error('[CalendarService] Subscription error:', e);
      return () => {};
    }
  },

  /**
   * Saves or updates a calendar (board master or custom school calendar)
   */
  saveCalendar: async (calendar: SchoolCalendar): Promise<SchoolCalendar> => {
    let saved: SchoolCalendar | null = null;
    let lastError: any = null;

    // 1. Try Go backend API server
    try {
      saved = await apiRequest<SchoolCalendar>('/api/calendars', {
        method: 'POST',
        body: JSON.stringify(calendar)
      });
    } catch (apiErr) {
      lastError = apiErr;
      console.warn('[CalendarService] API save failed, attempting Firestore SDK:', apiErr);
    }

    // 2. Direct Firestore fallback
    if (!saved && db) {
      try {
        const docId =
          calendar.id ||
          (calendar.scope === 'school' && calendar.schoolId
            ? `school_${calendar.schoolId}_${calendar.schoolYear}`
            : `board_${calendar.boardId}_${calendar.schoolYear}`);

        const docRef = doc(db, 'school_calendars', docId);
        const payload = {
          ...calendar,
          id: docId,
          updatedAt: new Date().toISOString()
        };
        await setDoc(docRef, payload, { merge: true });
        saved = payload;
      } catch (fsErr) {
        lastError = fsErr;
        console.error('[CalendarService] Direct Firestore save failed:', fsErr);
      }
    }

    if (!saved) {
      throw lastError || new Error('Failed to save calendar.');
    }
    return saved;
  },

  /**
   * Creates a dedicated custom calendar for a school by copying all board events as baseline
   */
  createCustomSchoolCalendar: async (params: {
    schoolId: number;
    schoolName: string;
    boardCalendar: SchoolCalendar;
    schoolYear: string;
  }): Promise<SchoolCalendar> => {
    // Clone events from board calendar with fresh IDs
    const clonedEvents: CalendarEvent[] = (params.boardCalendar.events || []).map((ev) => ({
      ...ev,
      id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      isBoardWide: false
    }));

    const customCal: SchoolCalendar = {
      id: `school_${params.schoolId}_${params.schoolYear}`,
      scope: 'school',
      boardId: params.boardCalendar.boardId,
      boardCode: params.boardCalendar.boardCode,
      schoolId: params.schoolId,
      schoolName: params.schoolName,
      schoolYear: params.schoolYear,
      isCustom: true,
      events: clonedEvents,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return await CalendarService.saveCalendar(customCal);
  },

  /**
   * Reverts a school's calendar back to board master by deleting the custom calendar record
   */
  revertSchoolCalendar: async (schoolId: number, year: string): Promise<void> => {
    let reverted = false;

    // 1. Try Go API
    try {
      await apiRequest<void>(`/api/calendars/school?schoolId=${schoolId}&year=${year}`, {
        method: 'DELETE'
      });
      reverted = true;
    } catch (apiErr) {
      console.warn('[CalendarService] API revert failed, attempting Firestore SDK:', apiErr);
    }

    // 2. Direct Firestore fallback
    if (!reverted && db) {
      try {
        const docRef = doc(db, 'school_calendars', `school_${schoolId}_${year}`);
        await deleteDoc(docRef);
        reverted = true;
      } catch (fsErr) {
        console.error('[CalendarService] Firestore deleteDoc failed:', fsErr);
        throw fsErr;
      }
    }
  }
};
