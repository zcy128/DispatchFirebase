import { collection, onSnapshot, query, where, addDoc, doc, deleteDoc, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { apiRequest } from './api';
import {
  DispatchShift,
  CreateDispatchDayResult,
  SplitShiftPart,
  DispatchPayrollSettings,
  DispatchChangeLog,
  DispatchPayrollRecord,
  PayrollDepartmentLogRecord,
  CrewCheckOutPayload,
  ApproveDispatchPayrollPayload,
  RejectDispatchPayrollPayload,
  UpdatePayrollDepartmentLogPayload,
  TemporaryAssignment,
  CreateTemporaryAssignmentPayload,
  UpdateTemporaryAssignmentPayload,
  RecordStudentAbsencePayload,
  RecordStudentAbsenceResponse,
  StudentAbsenceRecord,
  CheckInReminderSettings,
  SimulationSettings,
  SimulationRunResult,
  extractDispatchAssignedEmployeeIds,
} from '../types/dispatch';
import { DefectService } from './defectService';
import { VehicleInspectionService } from './vehicleInspectionService';
import {
  getUnavailableVehiclesForDate,
  getVehicleUnavailabilityReason,
} from '../utils/vehicleAvailabilityUtils';

export const DispatchService = {
  subscribeToDayShifts: (
    date: string,
    onUpdate: (shifts: DispatchShift[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      DispatchService.list(date)
        .then((shifts) => onUpdate(Array.isArray(shifts) ? shifts : []))
        .catch(onError);
      return () => {};
    }

    try {
      const q = query(
        collection(db, 'dispatch_shifts'),
        where('dispatchDate', '==', date)
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: DispatchShift[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as DispatchShift;
            // Auto-heal missing assignedEmployeeIds for Firestore index-level driver queries
            if (db && !data.assignedEmployeeIds && (data.driverId || data.driverName || data.attendantId || data.attendantName)) {
              const ids = extractDispatchAssignedEmployeeIds(data);
              setDoc(doc(db, 'dispatch_shifts', d.id), { assignedEmployeeIds: ids }, { merge: true }).catch(() => {});
            }
            list.push({
              ...data,
              id: d.id,
            });
          });
          // Sort chronologically by firstStopTime, then by routeNo
          list.sort((a, b) => {
            const timeDiff = (a.firstStopTime || '').localeCompare(b.firstStopTime || '');
            if (timeDiff !== 0) return timeDiff;
            return (a.routeNo || '').localeCompare(b.routeNo || '');
          });
          onUpdate(list || []);
        },
        (error) => {
          console.error('[DispatchService] onSnapshot error:', error);
          if (onError) onError(error);
          DispatchService.list(date)
            .then((shifts) => onUpdate(Array.isArray(shifts) ? shifts : []))
            .catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[DispatchService] Exception in onSnapshot listener:', e);
      DispatchService.list(date)
        .then((shifts) => onUpdate(Array.isArray(shifts) ? shifts : []))
        .catch(onError);
      return () => {};
    }
  },

  list: async (date: string, params?: Record<string, string>): Promise<DispatchShift[]> => {
    const q = new URLSearchParams({ date, ...(params || {}) }).toString();
    const res = await apiRequest<DispatchShift[]>(`/api/dispatch/shifts?${q}`);
    return Array.isArray(res) ? res : [];
  },

  getShift: async (id: string): Promise<DispatchShift> => {
    return apiRequest<DispatchShift>(`/api/dispatch/shifts/${id}`);
  },

  createDay: async (date: string, dryRun: boolean = false): Promise<CreateDispatchDayResult> => {
    const res = await apiRequest<CreateDispatchDayResult>(`/api/dispatch/create-day?date=${encodeURIComponent(date)}&dryRun=${dryRun}`, {
      method: 'POST',
    });
    if (!dryRun) {
      await DispatchService.syncDayDispatchesWithCoversAndOpenings(date).catch((err) =>
        console.warn('[DispatchService] Post-createDay cover/opening sync notice:', err)
      );
    }
    return res;
  },

  deleteDay: async (date: string): Promise<{ success: boolean; date: string }> => {
    return apiRequest<{ success: boolean; date: string }>(`/api/dispatch/delete-day?date=${encodeURIComponent(date)}`, {
      method: 'DELETE',
    });
  },

  updateShift: async (id: string, data: Partial<DispatchShift>): Promise<DispatchShift> => {
    return apiRequest<DispatchShift>(`/api/dispatch/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  recordStopArrival: async (shiftId: string, stopId: number, actualArrivalTime: string): Promise<DispatchShift> => {
    return apiRequest<DispatchShift>(`/api/dispatch/shifts/${shiftId}/stops/${stopId}/arrive`, {
      method: 'PUT',
      body: JSON.stringify({ actualArrivalTime }),
    });
  },

  checkInDriver: async (shiftId: string, checkInTime?: string, undo: boolean = false): Promise<DispatchShift> => {
    return apiRequest<DispatchShift>(`/api/dispatch/shifts/${shiftId}/check-in`, {
      method: 'PUT',
      body: JSON.stringify({ checkInTime, undo }),
    });
  },

  checkInAttendant: async (shiftId: string, checkInTime?: string, undo: boolean = false): Promise<DispatchShift> => {
    return apiRequest<DispatchShift>(`/api/dispatch/shifts/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify({
        isAttendantCheckedIn: !undo,
        attendantCheckedInAt: !undo ? (checkInTime || undefined) : null,
      }),
    });
  },

  updateStudentStatus: async (
    shiftId: string,
    stopId: number,
    studentId: number,
    status: string,
    absenceReason?: string,
    reportedBy?: string
  ): Promise<DispatchShift> => {
    const payload = {
      status,
      absenceReason,
      reportedBy,
      isPresent: status === 'picked_up' ? true : (status === 'absent' || status === 'no_show' ? false : undefined),
    };
    try {
      return await apiRequest<DispatchShift>(`/api/dispatch/shifts/${shiftId}/stops/${stopId}/students/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      return await apiRequest<DispatchShift>(`/api/public/dispatch/shifts/${shiftId}/stops/${stopId}/students/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    }
  },

  recordStudentAbsence: async (
    payload: RecordStudentAbsencePayload
  ): Promise<RecordStudentAbsenceResponse> => {
    try {
      return await apiRequest<RecordStudentAbsenceResponse>('/api/dispatch/students/absence', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return await apiRequest<RecordStudentAbsenceResponse>('/api/public/dispatch/students/absence', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
  },

  listStudentAbsences: async (
    startDate: string,
    endDate: string,
    routeNo?: string,
    studentId?: number,
    shiftType?: string
  ): Promise<StudentAbsenceRecord[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (routeNo && routeNo !== 'ALL') params.append('routeNo', routeNo);
    if (studentId) params.append('studentId', String(studentId));
    if (shiftType && shiftType !== 'ALL') params.append('shiftType', shiftType);

    const query = params.toString() ? `?${params.toString()}` : '';
    try {
      return await apiRequest<StudentAbsenceRecord[]>(`/api/dispatch/students/absences${query}`);
    } catch {
      return await apiRequest<StudentAbsenceRecord[]>(`/api/public/dispatch/students/absences${query}`);
    }
  },

  cancelStudentAbsence: async (id: string): Promise<void> => {
    try {
      await apiRequest<{ success: boolean }>(`/api/dispatch/students/absences/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {
      await apiRequest<{ success: boolean }>(`/api/public/dispatch/students/absences/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    }
  },

  splitShift: async (shiftId: string, parts: SplitShiftPart[]): Promise<DispatchShift[]> => {
    return apiRequest<DispatchShift[]>(`/api/dispatch/shifts/${shiftId}/split`, {
      method: 'POST',
      body: JSON.stringify({ parts }),
    });
  },

  getPayrollSettings: async (): Promise<DispatchPayrollSettings> => {
    try {
      return await apiRequest<DispatchPayrollSettings>('/api/dispatch/payroll-settings');
    } catch {
      return await apiRequest<DispatchPayrollSettings>('/api/public/dispatch/payroll-settings');
    }
  },

  savePayrollSettings: async (settings: DispatchPayrollSettings): Promise<DispatchPayrollSettings> => {
    try {
      return await apiRequest<DispatchPayrollSettings>('/api/dispatch/payroll-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch {
      return await apiRequest<DispatchPayrollSettings>('/api/public/dispatch/payroll-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    }
  },

  getCheckInReminderSettings: async (): Promise<CheckInReminderSettings> => {
    try {
      return await apiRequest<CheckInReminderSettings>('/api/dispatch/check-in-reminder-settings');
    } catch {
      return await apiRequest<CheckInReminderSettings>('/api/public/dispatch/check-in-reminder-settings');
    }
  },

  saveCheckInReminderSettings: async (settings: CheckInReminderSettings): Promise<CheckInReminderSettings> => {
    try {
      return await apiRequest<CheckInReminderSettings>('/api/dispatch/check-in-reminder-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch {
      return await apiRequest<CheckInReminderSettings>('/api/public/dispatch/check-in-reminder-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    }
  },

  getSimulationSettings: async (): Promise<SimulationSettings> => {
    try {
      return await apiRequest<SimulationSettings>('/api/dispatch/simulation-settings');
    } catch {
      return await apiRequest<SimulationSettings>('/api/public/dispatch/simulation-settings');
    }
  },

  saveSimulationSettings: async (settings: SimulationSettings): Promise<SimulationSettings> => {
    try {
      return await apiRequest<SimulationSettings>('/api/dispatch/simulation-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch {
      return await apiRequest<SimulationSettings>('/api/public/dispatch/simulation-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    }
  },

  runSimulation: async (date?: string, forceOverwrite: boolean = true): Promise<SimulationRunResult> => {
    const payload = { date: date || '', forceOverwrite };
    try {
      return await apiRequest<SimulationRunResult>('/api/dispatch/simulation/run', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return await apiRequest<SimulationRunResult>('/api/public/dispatch/simulation/run', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
  },

  subscribeToChangeLogs: (
    date: string,
    onUpdate: (logs: DispatchChangeLog[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      DispatchService.listChangeLogs(date)
        .then((logs) => onUpdate(Array.isArray(logs) ? logs : []))
        .catch(onError);
      return () => {};
    }

    try {
      const q = query(
        collection(db, 'dispatch_change_logs'),
        where('dispatchDate', '==', date)
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: DispatchChangeLog[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as DispatchChangeLog;
            list.push({
              ...data,
              id: d.id,
            });
          });
          list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          onUpdate(list || []);
        },
        (error) => {
          console.error('[DispatchService] Change logs onSnapshot error:', error);
          if (onError) onError(error);
          DispatchService.listChangeLogs(date)
            .then((logs) => onUpdate(Array.isArray(logs) ? logs : []))
            .catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[DispatchService] Exception in change log listener:', e);
      DispatchService.listChangeLogs(date)
        .then((logs) => onUpdate(Array.isArray(logs) ? logs : []))
        .catch(onError);
      return () => {};
    }
  },

  listChangeLogs: async (date: string): Promise<DispatchChangeLog[]> => {
    try {
      const res = await apiRequest<DispatchChangeLog[]>(`/api/dispatch/change-logs?date=${encodeURIComponent(date)}`);
      return Array.isArray(res) ? res : [];
    } catch {
      const res = await apiRequest<DispatchChangeLog[]>(`/api/public/dispatch/change-logs?date=${encodeURIComponent(date)}`);
      return Array.isArray(res) ? res : [];
    }
  },

  createChangeLog: async (log: Omit<DispatchChangeLog, 'id' | 'timestamp'> & { timestamp?: number }): Promise<DispatchChangeLog> => {
    const payload = {
      ...log,
      timestamp: log.timestamp || Date.now(),
    };
    try {
      return await apiRequest<DispatchChangeLog>('/api/dispatch/change-logs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<DispatchChangeLog>('/api/public/dispatch/change-logs', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const col = collection(db, 'dispatch_change_logs');
          const docRef = await addDoc(col, payload);
          return { ...payload, id: docRef.id } as DispatchChangeLog;
        }
        throw err;
      }
    }
  },

  listDispatchPayrolls: async (date: string): Promise<DispatchPayrollRecord[]> => {
    try {
      const res = await apiRequest<DispatchPayrollRecord[]>(`/api/dispatch/payrolls?date=${encodeURIComponent(date)}`);
      return Array.isArray(res) ? res : [];
    } catch {
      try {
        const res = await apiRequest<DispatchPayrollRecord[]>(`/api/public/dispatch/payrolls?date=${encodeURIComponent(date)}`);
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    }
  },

  subscribeToDispatchPayrolls: (
    date: string,
    onUpdate: (records: DispatchPayrollRecord[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      DispatchService.listDispatchPayrolls(date)
        .then((records) => onUpdate(Array.isArray(records) ? records : []))
        .catch(onError);
      return () => {};
    }

    try {
      const q = query(
        collection(db, 'dispatch_payrolls'),
        where('dispatchDate', '==', date)
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: DispatchPayrollRecord[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as DispatchPayrollRecord;
            list.push({
              ...data,
              id: d.id,
            });
          });
          list.sort((a, b) => {
            if (a.routeNo !== b.routeNo) return (a.routeNo || '').localeCompare(b.routeNo || '');
            return (a.role || '').localeCompare(b.role || '');
          });
          onUpdate(list || []);
        },
        (error) => {
          console.error('[DispatchService] Dispatch payrolls onSnapshot error:', error);
          if (onError) onError(error);
          DispatchService.listDispatchPayrolls(date)
            .then((records) => onUpdate(Array.isArray(records) ? records : []))
            .catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[DispatchService] Exception in payroll listener:', e);
      DispatchService.listDispatchPayrolls(date)
        .then((records) => onUpdate(Array.isArray(records) ? records : []))
        .catch(onError);
      return () => {};
    }
  },

  generateDispatchPayroll: async (
    shiftId: string,
    role: 'driver' | 'attendant',
    checkInTime?: string
  ): Promise<DispatchPayrollRecord> => {
    const payload = { shiftId, role, checkInTime };
    try {
      return await apiRequest<DispatchPayrollRecord>('/api/dispatch/payrolls/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return await apiRequest<DispatchPayrollRecord>('/api/public/dispatch/payrolls/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
  },

  deleteDispatchPayroll: async (shiftId: string, role: 'driver' | 'attendant'): Promise<void> => {
    try {
      await apiRequest(`/api/dispatch/payrolls/${encodeURIComponent(shiftId)}/${encodeURIComponent(role)}`, {
        method: 'DELETE',
      });
    } catch {
      try {
        await apiRequest(`/api/public/dispatch/payrolls/${encodeURIComponent(shiftId)}/${encodeURIComponent(role)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'dispatch_payrolls', `DP-${shiftId}-${role}`);
          await deleteDoc(docRef);
        }
      }
    }
  },

  checkOutCrew: async (shiftId: string, payload: CrewCheckOutPayload): Promise<DispatchShift> => {
    const bodyPayload = {
      ...payload,
      payrollComments: payload.payrollComments || payload.comments,
    };
    try {
      return await apiRequest<DispatchShift>(`/api/dispatch/shifts/${encodeURIComponent(shiftId)}/check-out`, {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
    } catch {
      try {
        return await apiRequest<DispatchShift>(`/api/public/dispatch/shifts/${encodeURIComponent(shiftId)}/check-out`, {
          method: 'POST',
          body: JSON.stringify(bodyPayload),
        });
      } catch (err) {
        if (db) {
          const shiftRef = doc(db, 'dispatch_shifts', shiftId);
          const shiftSnap = await getDoc(shiftRef);
          if (shiftSnap.exists()) {
            const s = shiftSnap.data() as DispatchShift;
            const nowTime = payload.checkOutTime || new Date().toTimeString().slice(0, 5);
            const isDriver = payload.role === 'driver';
            const undo = Boolean(payload.undo);
            const comments = (payload.payrollComments || payload.comments || '').trim();

            const shiftUpdate: Record<string, any> = isDriver ? {
              isDriverCheckedOut: !undo,
              driverCheckedOutAt: !undo ? nowTime : null,
              driverCheckoutComments: !undo ? (comments || null) : null,
            } : {
              isAttendantCheckedOut: !undo,
              attendantCheckedOutAt: !undo ? nowTime : null,
              attendantCheckoutComments: !undo ? (comments || null) : null,
            };
            await setDoc(shiftRef, shiftUpdate, { merge: true });

            const payrollId = `DP-${shiftId}-${payload.role}`;
            const pRef = doc(db, 'dispatch_payrolls', payrollId);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              const pRec = pSnap.data() as DispatchPayrollRecord;
              const hasComments = comments !== '';
              const status = hasComments ? 'pending_approval' : 'approved';
              const syncedToFinance = !hasComments && (pRec.payRate || 0) > 0 && !undo;

              const updatedP: DispatchPayrollRecord = {
                ...pRec,
                checkOutTime: !undo ? nowTime : undefined,
                hasComments,
                payrollComments: comments || pRec.payrollComments,
                status: undo ? 'pending_checkout' : status,
                syncedToFinance,
                updatedAt: new Date().toISOString(),
              };
              await setDoc(pRef, updatedP, { merge: true });

              const logId = `PL-${shiftId}-${payload.role}`;
              const logRef = doc(db, 'payroll_logs', logId);
              if (syncedToFinance) {
                const logData: PayrollDepartmentLogRecord = {
                  id: logId,
                  dispatchPayrollId: payrollId,
                  dispatchDate: pRec.dispatchDate,
                  shiftId: pRec.shiftId,
                  routeNo: pRec.routeNo,
                  routeName: pRec.routeName,
                  shiftType: pRec.shiftType,
                  schoolBoardCode: pRec.schoolBoardCode,
                  employeeId: pRec.employeeId,
                  employeeName: pRec.employeeName,
                  role: pRec.role,
                  unitNumber: pRec.unitNumber,
                  checkInTime: pRec.checkInTime,
                  checkOutTime: nowTime,
                  payOption: pRec.payOption,
                  originalPayRate: pRec.payRate,
                  payAmount: pRec.payRate,
                  originalEiHours: pRec.eiHours,
                  eiHours: pRec.eiHours,
                  rateSource: pRec.rateSource,
                  rateDescription: pRec.rateDescription,
                  dispatcherComments: comments,
                  status: 'approved',
                  syncedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                await setDoc(logRef, logData);
              } else {
                await deleteDoc(logRef).catch(() => {});
              }
            }
            return { ...s, ...shiftUpdate } as DispatchShift;
          }
        }
        throw err;
      }
    }
  },

  approveDispatchPayroll: async (payrollId: string, payload: ApproveDispatchPayrollPayload): Promise<DispatchPayrollRecord> => {
    try {
      return await apiRequest<DispatchPayrollRecord>(`/api/dispatch/payrolls/${encodeURIComponent(payrollId)}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<DispatchPayrollRecord>(`/api/public/dispatch/payrolls/${encodeURIComponent(payrollId)}/approve`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const pRef = doc(db, 'dispatch_payrolls', payrollId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const rec = pSnap.data() as DispatchPayrollRecord;
            const nowStr = new Date().toISOString();
            const newPayRate = payload.payRate !== undefined ? payload.payRate : rec.payRate;
            const newEiHours = payload.eiHours !== undefined ? payload.eiHours : rec.eiHours;
            const newPayOption = payload.payOption || rec.payOption;
            const newComments = payload.payrollComments !== undefined ? payload.payrollComments : rec.payrollComments;

            const updatedRec: DispatchPayrollRecord = {
              ...rec,
              id: payrollId,
              payRate: newPayRate,
              eiHours: newEiHours,
              payOption: newPayOption,
              payrollComments: newComments,
              status: 'approved',
              approvedBy: payload.approvedBy || 'Dispatcher',
              approvedAt: nowStr,
              updatedBy: payload.approvedBy || 'Dispatcher',
              rejectedBy: undefined,
              rejectedAt: undefined,
              syncedToFinance: newPayRate > 0,
              updatedAt: nowStr,
            };
            await setDoc(pRef, updatedRec, { merge: true });

            const logId = payrollId.replace('DP-', 'PL-');
            const logRef = doc(db, 'payroll_logs', logId);

            if (newPayRate > 0) {
              const logSnap = await getDoc(logRef);
              let logData: PayrollDepartmentLogRecord;
              if (logSnap.exists()) {
                const existingLog = logSnap.data() as PayrollDepartmentLogRecord;
                logData = {
                  ...existingLog,
                  originalPayRate: newPayRate,
                  payAmount: newPayRate,
                  originalEiHours: newEiHours,
                  eiHours: newEiHours,
                  dispatcherComments: newComments,
                  status: 'approved',
                  approvedBy: payload.approvedBy || 'Dispatcher',
                  approvedAt: nowStr,
                  updatedBy: payload.approvedBy || 'Dispatcher',
                  updatedAt: nowStr,
                };
              } else {
                logData = {
                  id: logId,
                  dispatchPayrollId: payrollId,
                  dispatchDate: rec.dispatchDate,
                  shiftId: rec.shiftId,
                  routeNo: rec.routeNo,
                  routeName: rec.routeName,
                  shiftType: rec.shiftType,
                  schoolBoardCode: rec.schoolBoardCode,
                  employeeId: rec.employeeId,
                  employeeName: rec.employeeName,
                  role: rec.role,
                  unitNumber: rec.unitNumber,
                  checkInTime: rec.checkInTime,
                  checkOutTime: rec.checkOutTime,
                  payOption: newPayOption,
                  originalPayRate: newPayRate,
                  payAmount: newPayRate,
                  originalEiHours: newEiHours,
                  eiHours: newEiHours,
                  rateSource: rec.rateSource,
                  rateDescription: rec.rateDescription,
                  dispatcherComments: newComments,
                  status: 'approved',
                  isCharter: rec.isCharter,
                  charterTripId: rec.charterTripId,
                  charterAssignmentId: rec.charterAssignmentId,
                  clientName: rec.clientName,
                  approvedBy: payload.approvedBy || 'Dispatcher',
                  approvedAt: nowStr,
                  updatedBy: payload.approvedBy || 'Dispatcher',
                  syncedAt: nowStr,
                  updatedAt: nowStr,
                };
              }
              await setDoc(logRef, logData);
            } else {
              await deleteDoc(logRef).catch(() => {});
            }
            return updatedRec;
          }
        }
        throw err;
      }
    }
  },

  rejectDispatchPayroll: async (payrollId: string, payload: RejectDispatchPayrollPayload): Promise<DispatchPayrollRecord> => {
    try {
      return await apiRequest<DispatchPayrollRecord>(`/api/dispatch/payrolls/${encodeURIComponent(payrollId)}/reject`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<DispatchPayrollRecord>(`/api/public/dispatch/payrolls/${encodeURIComponent(payrollId)}/reject`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const pRef = doc(db, 'dispatch_payrolls', payrollId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const rec = pSnap.data() as DispatchPayrollRecord;
            const nowStr = new Date().toISOString();
            const updatedRec: DispatchPayrollRecord = {
              ...rec,
              id: payrollId,
              status: 'rejected',
              rejectedBy: payload.rejectedBy || 'Dispatcher',
              rejectedAt: nowStr,
              updatedBy: payload.rejectedBy || 'Dispatcher',
              approvedBy: undefined,
              approvedAt: undefined,
              syncedToFinance: false,
              updatedAt: nowStr,
            };
            await setDoc(pRef, updatedRec, { merge: true });

            const logId = payrollId.replace('DP-', 'PL-');
            const logRef = doc(db, 'payroll_logs', logId);
            await deleteDoc(logRef).catch(() => {});
            return updatedRec;
          }
        }
        throw err;
      }
    }
  },

  listPayrollDepartmentLogs: async (params?: Record<string, string>): Promise<PayrollDepartmentLogRecord[]> => {
    const qStr = new URLSearchParams(params || {}).toString();
    try {
      return await apiRequest<PayrollDepartmentLogRecord[]>(`/api/dispatch/payroll-logs?${qStr}`);
    } catch {
      try {
        return await apiRequest<PayrollDepartmentLogRecord[]>(`/api/public/dispatch/payroll-logs?${qStr}`);
      } catch (err) {
        if (db) {
          const date = params?.date;
          const qRef = date
            ? query(collection(db, 'payroll_logs'), where('dispatchDate', '==', date))
            : query(collection(db, 'payroll_logs'));
          const snap = await getDocs(qRef);
          const list: PayrollDepartmentLogRecord[] = [];
          snap.forEach((d) => {
            list.push({ ...d.data(), id: d.id } as PayrollDepartmentLogRecord);
          });
          return list;
        }
        throw err;
      }
    }
  },

  subscribeToPayrollDepartmentLogs: (
    date: string,
    onUpdate: (logs: PayrollDepartmentLogRecord[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      DispatchService.listPayrollDepartmentLogs(date ? { date } : undefined)
        .then((logs) => onUpdate(Array.isArray(logs) ? logs : []))
        .catch(onError);
      return () => {};
    }

    try {
      const q = date
        ? query(collection(db, 'payroll_logs'), where('dispatchDate', '==', date))
        : query(collection(db, 'payroll_logs'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: PayrollDepartmentLogRecord[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as PayrollDepartmentLogRecord;
            list.push({
              ...data,
              id: d.id,
            });
          });
          list.sort((a, b) => {
            if (a.dispatchDate !== b.dispatchDate) return (b.dispatchDate || '').localeCompare(a.dispatchDate || '');
            if (a.routeNo !== b.routeNo) return (a.routeNo || '').localeCompare(b.routeNo || '');
            return (a.role || '').localeCompare(b.role || '');
          });
          onUpdate(list || []);
        },
        (error) => {
          console.error('[DispatchService] Payroll department logs onSnapshot error:', error);
          if (onError) onError(error);
          DispatchService.listPayrollDepartmentLogs(date ? { date } : undefined)
            .then((logs) => onUpdate(Array.isArray(logs) ? logs : []))
            .catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[DispatchService] Exception in payroll log listener:', e);
      DispatchService.listPayrollDepartmentLogs(date ? { date } : undefined)
        .then((logs) => onUpdate(Array.isArray(logs) ? logs : []))
        .catch(onError);
      return () => {};
    }
  },

  syncCleanPayrollsForDate: async (date: string): Promise<{ success: boolean; date: string; synced: number }> => {
    try {
      return await apiRequest<{ success: boolean; date: string; synced: number }>(`/api/dispatch/payroll-logs/sync-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
    } catch {
      return await apiRequest<{ success: boolean; date: string; synced: number }>(`/api/public/dispatch/payroll-logs/sync-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
    }
  },

  updatePayrollDepartmentLog: async (
    logId: string,
    payload: UpdatePayrollDepartmentLogPayload
  ): Promise<PayrollDepartmentLogRecord> => {
    try {
      return await apiRequest<PayrollDepartmentLogRecord>(`/api/dispatch/payroll-logs/${encodeURIComponent(logId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        return await apiRequest<PayrollDepartmentLogRecord>(`/api/public/dispatch/payroll-logs/${encodeURIComponent(logId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'payroll_logs', logId);
          await setDoc(docRef, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
          const snap = await getDoc(docRef);
          return { ...snap.data(), id: docRef.id } as PayrollDepartmentLogRecord;
        }
        throw err;
      }
    }
  },

  listTemporaryAssignments: async (params?: Record<string, string>): Promise<TemporaryAssignment[]> => {
    const qStr = new URLSearchParams(params || {}).toString();
    try {
      const res = await apiRequest<TemporaryAssignment[]>(`/api/dispatch/temporary-assignments?${qStr}`);
      return Array.isArray(res) ? res : [];
    } catch {
      try {
        const res = await apiRequest<TemporaryAssignment[]>(`/api/public/dispatch/temporary-assignments?${qStr}`);
        return Array.isArray(res) ? res : [];
      } catch (err) {
        if (db) {
          const qRef = collection(db, 'temporary_assignments');
          const snap = await getDocs(qRef);
          const list: TemporaryAssignment[] = [];
          snap.forEach((d) => {
            list.push({ ...d.data(), id: d.id } as TemporaryAssignment);
          });
          list.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
          return list;
        }
        throw err;
      }
    }
  },

  getTemporaryAssignment: async (id: string): Promise<TemporaryAssignment> => {
    try {
      return await apiRequest<TemporaryAssignment>(`/api/dispatch/temporary-assignments/${encodeURIComponent(id)}`);
    } catch {
      try {
        return await apiRequest<TemporaryAssignment>(`/api/public/dispatch/temporary-assignments/${encodeURIComponent(id)}`);
      } catch (err) {
        if (db) {
          const snap = await getDoc(doc(db, 'temporary_assignments', id));
          if (snap.exists()) {
            return { ...snap.data(), id: snap.id } as TemporaryAssignment;
          }
        }
        throw err;
      }
    }
  },

  createTemporaryAssignment: async (payload: CreateTemporaryAssignmentPayload): Promise<TemporaryAssignment> => {
    const cleanObj = (obj: Record<string, any>) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) out[k] = v;
      }
      return out;
    };

    let created: TemporaryAssignment;
    try {
      created = await apiRequest<TemporaryAssignment>('/api/dispatch/temporary-assignments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        created = await apiRequest<TemporaryAssignment>('/api/public/dispatch/temporary-assignments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const nowStr = new Date().toISOString();
          const id = `TA-${Date.now()}`;
          const rec = cleanObj({
            ...payload,
            id,
            shiftType: payload.shiftType || 'ALL',
            endDate: payload.endDate || payload.startDate,
            status: 'active',
            createdAt: nowStr,
            updatedAt: nowStr,
          }) as TemporaryAssignment;
          await setDoc(doc(db, 'temporary_assignments', id), rec);
          created = rec;
        } else {
          throw err;
        }
      }
    }

    await DispatchService.applyTemporaryAssignmentToExistingDispatches(created).catch((e) =>
      console.warn('[DispatchService] Sync existing dispatches with temporary cover notice:', e)
    );

    // Synchronize to route_openings collection so manual assignments appear in Route Openings & Coverage board
    if (db && !payload.fromRouteOpeningId && created) {
      try {
        const roId = `RO-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const roleNeeded =
          payload.temporaryDriverId && payload.temporaryAttendantId
            ? 'driver_and_attendant'
            : payload.temporaryDriverId
            ? 'driver'
            : payload.temporaryAttendantId
            ? 'attendant'
            : 'driver';

        const manualOpening: Record<string, any> = {
          id: roId,
          title: `Temporary Route Coverage - Route ${payload.routeNo || payload.routeId}`,
          routeId: payload.routeId,
          routeNo: payload.routeNo || '',
          routeName: payload.routeName || '',
          postingType: 'temporary',
          roleNeeded,
          effectiveStartDate: payload.startDate,
          effectiveEndDate: payload.endDate || payload.startDate,
          shiftType: payload.shiftType || 'ALL',
          deadline: nowIso,
          description: payload.notes || `Manual temporary coverage assignment (${payload.reason || 'Leave'}).`,
          status: 'awarded',
          applicants: [
            ...(payload.temporaryDriverId
              ? [
                  {
                    employeeId: payload.temporaryDriverId,
                    fullName: payload.temporaryDriverName || 'Assigned Driver',
                    phone: payload.temporaryDriverPhone || '',
                    roleApplied: 'driver' as const,
                    status: 'selected' as const,
                    appliedAt: nowIso
                  }
                ]
              : []),
            ...(payload.temporaryAttendantId
              ? [
                  {
                    employeeId: payload.temporaryAttendantId,
                    fullName: payload.temporaryAttendantName || 'Assigned Attendant',
                    phone: payload.temporaryAttendantPhone || '',
                    roleApplied: 'attendant' as const,
                    status: 'selected' as const,
                    appliedAt: nowIso
                  }
                ]
              : [])
          ],
          awardedDriverId: payload.temporaryDriverId || '',
          awardedDriverName: payload.temporaryDriverName || '',
          awardedDriverPhone: payload.temporaryDriverPhone || '',
          awardedAttendantId: payload.temporaryAttendantId || '',
          awardedAttendantName: payload.temporaryAttendantName || '',
          awardedAttendantPhone: payload.temporaryAttendantPhone || '',
          temporaryVehicleId: payload.temporaryVehicleId,
          temporaryAssignmentId: created.id,
          awardedAt: nowIso,
          awardedBy: payload.createdBy || 'Dispatcher',
          awardedNotes: payload.notes || 'Manually arranged coverage by dispatcher.',
          crewAppliedToRoute: false,
          chatAnnouncementSent: false,
          createdBy: payload.createdBy || 'Dispatcher',
          createdAt: nowIso,
          updatedAt: nowIso
        };

        await setDoc(doc(db, 'route_openings', roId), cleanObj(manualOpening));
      } catch (err) {
        console.warn('[DispatchService] Auto-create route_openings doc notice:', err);
      }
    }

    return created;
  },

  updateTemporaryAssignment: async (id: string, payload: UpdateTemporaryAssignmentPayload): Promise<TemporaryAssignment> => {
    const cleanObj = (obj: Record<string, any>) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) out[k] = v;
      }
      return out;
    };

    let updated: TemporaryAssignment;
    try {
      updated = await apiRequest<TemporaryAssignment>(`/api/dispatch/temporary-assignments/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      try {
        updated = await apiRequest<TemporaryAssignment>(`/api/public/dispatch/temporary-assignments/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (db) {
          const docRef = doc(db, 'temporary_assignments', id);
          await setDoc(docRef, cleanObj({ ...payload, updatedAt: new Date().toISOString() }), { merge: true });
          const snap = await getDoc(docRef);
          updated = { ...snap.data(), id: docRef.id } as TemporaryAssignment;
        } else {
          throw err;
        }
      }
    }

    // Sync any linked route_openings document
    if (db && id) {
      try {
        const roSnap = await getDocs(
          query(collection(db, 'route_openings'), where('temporaryAssignmentId', '==', id))
        );
        for (const roDoc of roSnap.docs) {
          const roPatch: Record<string, any> = {
            updatedAt: new Date().toISOString()
          };
          if (payload.temporaryDriverId !== undefined) {
            roPatch.awardedDriverId = payload.temporaryDriverId || '';
            roPatch.awardedDriverName = payload.temporaryDriverName || '';
            roPatch.awardedDriverPhone = payload.temporaryDriverPhone || '';
          }
          if (payload.temporaryAttendantId !== undefined) {
            roPatch.awardedAttendantId = payload.temporaryAttendantId || '';
            roPatch.awardedAttendantName = payload.temporaryAttendantName || '';
            roPatch.awardedAttendantPhone = payload.temporaryAttendantPhone || '';
          }
          if (payload.temporaryVehicleId !== undefined) {
            roPatch.temporaryVehicleId = payload.temporaryVehicleId;
          }
          if (payload.startDate !== undefined) roPatch.effectiveStartDate = payload.startDate;
          if (payload.endDate !== undefined) roPatch.effectiveEndDate = payload.endDate;
          if (payload.shiftType !== undefined) roPatch.shiftType = payload.shiftType;
          if (payload.status !== undefined) {
            roPatch.status = payload.status === 'cancelled' ? 'cancelled' : 'awarded';
          }
          if (payload.notes !== undefined) roPatch.description = payload.notes;
          await setDoc(doc(db, 'route_openings', roDoc.id), cleanObj(roPatch), { merge: true });
        }
      } catch (e) {
        console.warn('[DispatchService] Sync linked route opening notice:', e);
      }
    }

    if (updated && updated.status === 'active') {
      await DispatchService.applyTemporaryAssignmentToExistingDispatches(updated).catch((e) =>
        console.warn('[DispatchService] Sync existing dispatches on update notice:', e)
      );
    }
    return updated;
  },

  /**
   * Applies an active TemporaryAssignment to any already-generated dispatch_shifts within its date range.
   */
  applyTemporaryAssignmentToExistingDispatches: async (ta: TemporaryAssignment): Promise<void> => {
    if (!db || (ta.status && ta.status !== 'active')) return;
    const nowIso = new Date().toISOString();
    const taShift = String(ta.shiftType || 'ALL').toUpperCase().trim();
    const isAllShifts = !taShift || taShift === 'ALL';

    const isDateCovered = (d: string) => {
      if (!d) return false;
      if (Array.isArray(ta.specificDates) && ta.specificDates.length > 0) {
        return ta.specificDates.includes(d);
      }
      if (ta.startDate && d < ta.startDate) return false;
      const end = ta.endDate || ta.startDate;
      if (end && d > end) return false;
      return true;
    };

    try {
      const qDispatches = ta.routeNo
        ? query(collection(db, 'dispatch_shifts'), where('routeNo', '==', ta.routeNo))
        : query(collection(db, 'dispatch_shifts'), where('routeId', '==', ta.routeId));
      const snap = await getDocs(qDispatches);

      for (const dDoc of snap.docs) {
        const dData = dDoc.data() as DispatchShift;
        if (!isDateCovered(dData.dispatchDate)) continue;

        const dShift = String(dData.shiftType || '').toUpperCase().trim();
        const shiftMatch =
          (ta.busRouteShiftId && dData.busRouteShiftId && ta.busRouteShiftId === dData.busRouteShiftId) ||
          isAllShifts ||
          dShift === taShift;
        if (!shiftMatch) continue;

        const patch: Record<string, any> = {
          temporaryAssignmentId: ta.id,
          updatedAt: nowIso,
        };
        if (ta.temporaryDriverName) {
          patch.driverId = ta.temporaryDriverId || '';
          patch.driverName = ta.temporaryDriverName;
          patch.driverPhone = ta.temporaryDriverPhone || '';
          patch.isTemporaryDriver = true;
        }
        if (ta.temporaryAttendantName) {
          patch.attendantId = ta.temporaryAttendantId || '';
          patch.attendantName = ta.temporaryAttendantName;
          patch.attendantPhone = ta.temporaryAttendantPhone || '';
          patch.isTemporaryAttendant = true;
        }
        if (ta.temporaryUnitNumber) {
          patch.vehicleId = ta.temporaryVehicleId || 0;
          patch.unitNumber = ta.temporaryUnitNumber;
          patch.plateNumber = ta.temporaryPlateNumber || '';
          patch.isTemporaryVehicle = true;
        }
        const finalDriver = patch.driverName || dData.driverName;
        const finalUnit = patch.unitNumber || dData.unitNumber;
        if (finalDriver && finalUnit && dData.health === 'red') {
          patch.health = 'green';
        }
        patch.assignedEmployeeIds = extractDispatchAssignedEmployeeIds({
          driverId: patch.driverId !== undefined ? patch.driverId : dData.driverId,
          driverName: patch.driverName !== undefined ? patch.driverName : dData.driverName,
          attendantId: patch.attendantId !== undefined ? patch.attendantId : dData.attendantId,
          attendantName: patch.attendantName !== undefined ? patch.attendantName : dData.attendantName,
        });
        await setDoc(doc(db, 'dispatch_shifts', dDoc.id), patch, { merge: true });
      }
    } catch (err) {
      console.warn('[DispatchService] applyTemporaryAssignmentToExistingDispatches error:', err);
    }
  },

  /**
   * Synchronizes all dispatch_shifts on a given date with:
   * 1) Any awarded Permanent Route Openings effective on or before `date`
   * 2) Any active Temporary Assignments (Shift Covers) covering `date` (takes highest priority)
   */
  syncDayDispatchesWithCoversAndOpenings: async (date: string): Promise<void> => {
    if (!db || !date) return;
    const nowIso = new Date().toISOString();

    try {
      // Fetch dispatches for `date`
      const dSnap = await getDocs(
        query(collection(db, 'dispatch_shifts'), where('dispatchDate', '==', date))
      );
      if (dSnap.empty) return;

      // 1. Fetch awarded permanent route openings effective on or before `date`
      const roSnap = await getDocs(
        query(collection(db, 'route_openings'), where('status', '==', 'awarded'))
      );
      const effectivePermOpenings: Record<string, any>[] = [];
      roSnap.forEach((d) => {
        const op = d.data();
        if (
          op.postingType === 'permanent' &&
          (!op.effectiveStartDate || op.effectiveStartDate <= date)
        ) {
          effectivePermOpenings.push({ ...op, id: d.id });
        }
      });

      // 2. Fetch active temporary assignments covering `date`
      const taSnap = await getDocs(
        query(collection(db, 'temporary_assignments'), where('status', '==', 'active'))
      );
      const activeCovers: TemporaryAssignment[] = [];
      taSnap.forEach((d) => {
        const ta = { ...(d.data() as TemporaryAssignment), id: d.id };
        if (Array.isArray(ta.specificDates) && ta.specificDates.length > 0) {
          if (ta.specificDates.includes(date)) activeCovers.push(ta);
          return;
        }
        if (ta.startDate && date < ta.startDate) return;
        const end = ta.endDate || ta.startDate;
        if (end && date > end) return;
        activeCovers.push(ta);
      });

      // 2.5 Fetch active vehicle defects, periodic inspections, and PM records for `date`
      const [defects, inspections, pmRecords] = await Promise.all([
        DefectService.listDefects().catch(() => []),
        VehicleInspectionService.getInspections().catch(() => []),
        VehicleInspectionService.getPMRecords().catch(() => []),
      ]);
      const unavailableMap = getUnavailableVehiclesForDate(date, defects, inspections, pmRecords);

      // 3. Apply to each dispatch shift on `date`
      for (const dDoc of dSnap.docs) {
        const shift = dDoc.data() as DispatchShift;
        const sRouteId = String(shift.routeId || '');
        const sRouteNo = String(shift.routeNo || '').toUpperCase().trim();
        const sShiftType = String(shift.shiftType || '').toUpperCase().trim();
        const patch: Record<string, any> = {};

        // Step A: Apply effective permanent route openings (baseline permanent crew)
        for (const op of effectivePermOpenings) {
          const opRouteMatch =
            (op.routeId && (op.routeId === sRouteId || `RT-${op.routeId}` === sRouteId)) ||
            (op.routeNo && String(op.routeNo).toUpperCase().trim() === sRouteNo);
          if (!opRouteMatch) continue;

          const opShift = String(op.shiftType || 'ALL').toUpperCase().trim();
          if (opShift && opShift !== 'ALL' && opShift !== sShiftType) continue;

          if (op.awardedDriverName && !shift.isTemporaryDriver) {
            patch.driverId = op.awardedDriverId || '';
            patch.driverName = op.awardedDriverName;
            if (op.awardedDriverPhone !== undefined) patch.driverPhone = op.awardedDriverPhone;
          }
          if (op.awardedAttendantName && !shift.isTemporaryAttendant) {
            patch.attendantId = op.awardedAttendantId || '';
            patch.attendantName = op.awardedAttendantName;
            if (op.awardedAttendantPhone !== undefined) patch.attendantPhone = op.awardedAttendantPhone;
          }
        }

        // Step B: Apply active temporary assignments (highest priority override for `date`)
        for (const ta of activeCovers) {
          const taRouteMatch =
            (ta.routeId && (ta.routeId === sRouteId || `RT-${ta.routeId}` === sRouteId)) ||
            (ta.routeNo && String(ta.routeNo).toUpperCase().trim() === sRouteNo);
          if (!taRouteMatch) continue;

          const taShift = String(ta.shiftType || 'ALL').toUpperCase().trim();
          const shiftMatch =
            (ta.busRouteShiftId && shift.busRouteShiftId && ta.busRouteShiftId === shift.busRouteShiftId) ||
            !taShift ||
            taShift === 'ALL' ||
            taShift === sShiftType;
          if (!shiftMatch) continue;

          patch.temporaryAssignmentId = ta.id;
          if (ta.temporaryDriverName) {
            patch.driverId = ta.temporaryDriverId || '';
            patch.driverName = ta.temporaryDriverName;
            patch.driverPhone = ta.temporaryDriverPhone || '';
            patch.isTemporaryDriver = true;
          }
          if (ta.temporaryAttendantName) {
            patch.attendantId = ta.temporaryAttendantId || '';
            patch.attendantName = ta.temporaryAttendantName;
            patch.attendantPhone = ta.temporaryAttendantPhone || '';
            patch.isTemporaryAttendant = true;
          }
          if (ta.temporaryUnitNumber) {
            patch.vehicleId = ta.temporaryVehicleId || 0;
            patch.unitNumber = ta.temporaryUnitNumber;
            patch.plateNumber = ta.temporaryPlateNumber || '';
            patch.isTemporaryVehicle = true;
          }
        }

        // Step C: Exclude vehicle if it is in Vehicle Defect or Periodic Inspection on `date`
        const candidateUnit = patch.unitNumber ?? shift.unitNumber;
        const candidateVehId = patch.vehicleId ?? shift.vehicleId;
        const unavailReason = getVehicleUnavailabilityReason(candidateUnit, candidateVehId, unavailableMap);
        if (unavailReason && (candidateUnit || candidateVehId)) {
          patch.vehicleId = 0;
          patch.unitNumber = '';
          patch.plateNumber = '';
          patch.isTemporaryVehicle = false;
          patch.health = 'red';
        }

        if (Object.keys(patch).length > 0) {
          const finalDriver = patch.driverName ?? shift.driverName;
          const finalUnit = patch.unitNumber ?? shift.unitNumber;
          if (finalDriver && finalUnit && shift.health === 'red' && patch.health !== 'red') {
            patch.health = 'green';
          }
          patch.assignedEmployeeIds = extractDispatchAssignedEmployeeIds({
            driverId: patch.driverId !== undefined ? patch.driverId : shift.driverId,
            driverName: patch.driverName !== undefined ? patch.driverName : shift.driverName,
            attendantId: patch.attendantId !== undefined ? patch.attendantId : shift.attendantId,
            attendantName: patch.attendantName !== undefined ? patch.attendantName : shift.attendantName,
          });
          patch.updatedAt = nowIso;
          await setDoc(doc(db, 'dispatch_shifts', dDoc.id), patch, { merge: true });
        }
      }
    } catch (err) {
      console.warn('[DispatchService] syncDayDispatchesWithCoversAndOpenings notice:', err);
    }
  },

  /**
   * Immediately removes a vehicle from any existing dispatch_shifts on affected dates
   * when it enters Vehicle Defect or Periodic Inspection / Preventive Maintenance.
   */
  removeUnavailableVehicleFromDispatches: async (
    unitNumber: string,
    vehicleId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<number> => {
    if (!db || (!unitNumber && !vehicleId)) return 0;
    let removedCount = 0;
    const nowIso = new Date().toISOString();
    const normUnit = String(unitNumber || '').trim().toUpperCase();

    try {
      const snap = normUnit
        ? await getDocs(query(collection(db, 'dispatch_shifts'), where('unitNumber', '==', unitNumber.trim())))
        : await getDocs(query(collection(db, 'dispatch_shifts'), where('vehicleId', '==', vehicleId)));

      for (const dDoc of snap.docs) {
        const shift = dDoc.data() as DispatchShift;
        const dDate = (shift.dispatchDate || '').slice(0, 10);
        if (startDate && dDate && dDate < startDate.slice(0, 10)) continue;
        if (endDate && dDate && dDate > endDate.slice(0, 10)) continue;

        const shiftUnit = String(shift.unitNumber || '').trim().toUpperCase();
        const matchesUnit = normUnit && shiftUnit === normUnit;
        const matchesId = vehicleId && vehicleId > 0 && Number(shift.vehicleId) === Number(vehicleId);

        if (matchesUnit || matchesId) {
          await setDoc(
            doc(db, 'dispatch_shifts', dDoc.id),
            {
              vehicleId: 0,
              unitNumber: '',
              plateNumber: '',
              isTemporaryVehicle: false,
              health: 'red',
              updatedAt: nowIso,
            },
            { merge: true }
          );
          removedCount++;
        }
      }
    } catch (err) {
      console.warn('[DispatchService] removeUnavailableVehicleFromDispatches error:', err);
    }
    return removedCount;
  },

  deleteTemporaryAssignment: async (id: string): Promise<void> => {
    try {
      await apiRequest(`/api/dispatch/temporary-assignments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {
      try {
        await apiRequest(`/api/public/dispatch/temporary-assignments/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        if (db) {
          await deleteDoc(doc(db, 'temporary_assignments', id));
          try {
            const roSnap = await getDocs(
              query(collection(db, 'route_openings'), where('temporaryAssignmentId', '==', id))
            );
            for (const roDoc of roSnap.docs) {
              await deleteDoc(doc(db, 'route_openings', roDoc.id));
            }
          } catch (e) {
            console.warn('[DispatchService] Clean up linked route opening notice:', e);
          }
          return;
        }
        throw err;
      }
    }
  },

  subscribeToTemporaryAssignments: (
    onUpdate: (assignments: TemporaryAssignment[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      DispatchService.listTemporaryAssignments()
        .then((list) => onUpdate(Array.isArray(list) ? list : []))
        .catch(onError);
      return () => {};
    }

    try {
      const q = collection(db, 'temporary_assignments');
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: TemporaryAssignment[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as TemporaryAssignment;
            list.push({
              ...data,
              id: d.id,
            });
          });
          list.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
          onUpdate(list || []);
        },
        (error) => {
          console.error('[DispatchService] Temporary assignments onSnapshot error:', error);
          if (onError) onError(error);
          DispatchService.listTemporaryAssignments()
            .then((list) => onUpdate(Array.isArray(list) ? list : []))
            .catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.error('[DispatchService] Exception in temporary assignments listener:', e);
      DispatchService.listTemporaryAssignments()
        .then((list) => onUpdate(Array.isArray(list) ? list : []))
        .catch(onError);
      return () => {};
    }
  },
};


