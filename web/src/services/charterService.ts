import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import {
  CharterClient,
  CharterTrip,
  CharterAssignment,
  CharterStop,
  extractAssignedEmployeeIds,
} from '../types/charter';
import {
  DispatchPayrollRecord,
  PayrollDepartmentLogRecord
} from '../types/dispatch';

const CLIENTS_COLL = 'charter_clients';
const TRIPS_COLL = 'charter_trips';
const PAYROLL_COLL = 'dispatch_payrolls';
const PAYROLL_LOG_COLL = 'payroll_logs';

export const CharterService = {
  // ─── CHARTER CLIENTS ────────────────────────────────────────────────────────

  listClients: async (): Promise<CharterClient[]> => {
    if (!db) return [];
    try {
      const q = query(collection(db, CLIENTS_COLL));
      const snap = await getDocs(q);
      const list: CharterClient[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as CharterClient);
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    } catch (err) {
      console.error('[CharterService] listClients error:', err);
      return [];
    }
  },

  subscribeToClients: (
    onUpdate: (clients: CharterClient[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      CharterService.listClients().then(onUpdate).catch(onError);
      return () => {};
    }
    const q = query(collection(db, CLIENTS_COLL));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: CharterClient[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as CharterClient);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        onUpdate(list);
      },
      (err) => {
        console.error('[CharterService] subscribeToClients error:', err);
        if (onError) onError(err);
      }
    );
  },

  createClient: async (data: Omit<CharterClient, 'id' | 'createdAt' | 'updatedAt'>): Promise<CharterClient> => {
    if (!db) throw new Error('Firestore not initialized');
    const id = `client-${Date.now()}`;
    const now = new Date().toISOString();
    const client: CharterClient = {
      ...data,
      id,
      tripCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, CLIENTS_COLL, id), client);
    return client;
  },

  updateClient: async (id: string, data: Partial<CharterClient>): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const now = new Date().toISOString();
    await setDoc(doc(db, CLIENTS_COLL, id), { ...data, updatedAt: now }, { merge: true });
  },

  deleteClient: async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    await deleteDoc(doc(db, CLIENTS_COLL, id));
  },

  // ─── CHARTER TRIPS ──────────────────────────────────────────────────────────

  listTrips: async (date?: string): Promise<CharterTrip[]> => {
    if (!db) return [];
    try {
      let q = query(collection(db, TRIPS_COLL));
      if (date) {
        q = query(collection(db, TRIPS_COLL), where('dispatchDate', '==', date));
      }
      const snap = await getDocs(q);
      const list: CharterTrip[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as CharterTrip);
      });
      list.sort((a, b) => (b.departsAt || '').localeCompare(a.departsAt || ''));
      return list;
    } catch (err) {
      console.error('[CharterService] listTrips error:', err);
      return [];
    }
  },

  subscribeToTrips: (
    onUpdate: (trips: CharterTrip[]) => void,
    onError?: (err: Error) => void,
    date?: string
  ) => {
    if (!db) {
      CharterService.listTrips(date).then(onUpdate).catch(onError);
      return () => {};
    }
    const q = date
      ? query(collection(db, TRIPS_COLL), where('dispatchDate', '==', date))
      : query(collection(db, TRIPS_COLL));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: CharterTrip[] = [];
        snapshot.forEach((d) => {
          const trip = d.data() as CharterTrip;
          const assignedEmployeeIds =
            trip.assignedEmployeeIds || extractAssignedEmployeeIds(trip.assignments);
          list.push({ ...trip, assignedEmployeeIds, id: d.id });
        });
        list.sort((a, b) => (b.departsAt || '').localeCompare(a.departsAt || ''));
        onUpdate(list);
      },
      (err) => {
        console.error('[CharterService] subscribeToTrips error:', err);
        if (onError) onError(err);
      }
    );
  },

  getTripById: async (id: string): Promise<CharterTrip | null> => {
    if (!db) return null;
    const snap = await getDoc(doc(db, TRIPS_COLL, id));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as CharterTrip;
  },

  createTrip: async (tripData: Omit<CharterTrip, 'id' | 'createdAt' | 'updatedAt'>): Promise<CharterTrip> => {
    if (!db) throw new Error('Firestore not initialized');
    const id = `trip-${Date.now()}`;
    const now = new Date().toISOString();
    const assignedEmployeeIds = extractAssignedEmployeeIds(tripData.assignments);
    const trip: CharterTrip = {
      ...tripData,
      id,
      assignedEmployeeIds,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, TRIPS_COLL, id), trip);
    return trip;
  },

  updateTrip: async (id: string, data: Partial<CharterTrip>, actorName = 'Dispatcher'): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const now = new Date().toISOString();
    const tripRef = doc(db, TRIPS_COLL, id);
    const snap = await getDoc(tripRef);
    if (!snap.exists()) {
      throw new Error(`Charter trip ${id} not found`);
    }
    const oldTrip = snap.data() as CharterTrip;
    const assignmentsToUse = data.assignments || oldTrip.assignments;
    const assignedEmployeeIds = extractAssignedEmployeeIds(assignmentsToUse);
    const updatedTrip: CharterTrip = {
      ...oldTrip,
      ...data,
      assignedEmployeeIds,
      updatedAt: now,
    };
    await setDoc(tripRef, updatedTrip, { merge: true });

    // If assignments changed or trip header changed, re-sync payroll entries
    if (updatedTrip.assignments && updatedTrip.assignments.length > 0) {
      for (const assignment of updatedTrip.assignments) {
        await CharterService.syncAssignmentPayroll(updatedTrip, assignment, actorName);
      }
    }
  },

  deleteTrip: async (id: string): Promise<void> => {
    if (!db) throw new Error('Firestore not initialized');
    const snap = await getDoc(doc(db, TRIPS_COLL, id));
    if (snap.exists()) {
      const trip = snap.data() as CharterTrip;
      if (trip.assignments) {
        for (const a of trip.assignments) {
          await CharterService.removeAssignmentPayroll(trip.id, a.id, 'driver');
          await CharterService.removeAssignmentPayroll(trip.id, a.id, 'attendant');
        }
      }
    }
    await deleteDoc(doc(db, TRIPS_COLL, id));
  },

  // ─── ASSIGNMENTS & CREW CHECK-IN / CHECK-OUT ───────────────────────────────

  /**
   * Check in / Check out or update crew assignment, with real-time sync to:
   * 1. dispatch_payrolls (DP-CHARTER-{tripId}-{assignmentId}-{role})
   * 2. payroll_logs (PL-CHARTER-{tripId}-{assignmentId}-{role})
   */
  updateAssignmentCrew: async (
    tripId: string,
    assignmentId: string,
    crewUpdate: Partial<CharterAssignment>,
    actorName = 'Dispatcher'
  ): Promise<CharterTrip> => {
    if (!db) throw new Error('Firestore not initialized');
    const tripRef = doc(db, TRIPS_COLL, tripId);
    const snap = await getDoc(tripRef);
    if (!snap.exists()) throw new Error(`Trip ${tripId} not found`);

    const trip = snap.data() as CharterTrip;
    const assignments = trip.assignments || [];
    const index = assignments.findIndex((a) => a.id === assignmentId);
    if (index === -1) throw new Error(`Assignment ${assignmentId} not found`);

    const oldAssignment = assignments[index];
    const newAssignment: CharterAssignment = {
      ...oldAssignment,
      ...crewUpdate,
      updatedAt: new Date().toISOString(),
    };

    assignments[index] = newAssignment;
    const updatedTrip: CharterTrip = {
      ...trip,
      assignments,
      assignedEmployeeIds: extractAssignedEmployeeIds(assignments),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(tripRef, updatedTrip, { merge: true });

    // If attendant was cleared/removed, delete any previous attendant payroll record
    if (oldAssignment.attendantId && !newAssignment.attendantId) {
      await CharterService.removeAssignmentPayroll(tripId, assignmentId, 'attendant');
    }

    // Sync active payroll records for driver & attendant
    await CharterService.syncAssignmentPayroll(updatedTrip, newAssignment, actorName);

    return updatedTrip;
  },

  checkInCrew: async (
    tripId: string,
    assignmentId: string,
    role: 'driver' | 'attendant' | 'both',
    checkInTime?: string,
    actorName = 'Dispatcher'
  ): Promise<CharterTrip> => {
    const timeStr = checkInTime || new Date().toTimeString().slice(0, 5);
    const update: Partial<CharterAssignment> = {
      status: 1, // Checked In
    };
    if (role === 'driver' || role === 'both') {
      update.isDriverCheckedIn = true;
      update.driverCheckedInAt = timeStr;
    }
    if (role === 'attendant' || role === 'both') {
      update.isAttendantCheckedIn = true;
      update.attendantCheckedInAt = timeStr;
    }

    return await CharterService.updateAssignmentCrew(tripId, assignmentId, update, actorName);
  },

  checkOutCrew: async (
    tripId: string,
    assignmentId: string,
    role: 'driver' | 'attendant' | 'both',
    checkOutTime?: string,
    comments?: string,
    actorName = 'Dispatcher'
  ): Promise<CharterTrip> => {
    const timeStr = checkOutTime || new Date().toTimeString().slice(0, 5);
    const update: Partial<CharterAssignment> = {
      status: 2, // Checked Out
    };
    if (role === 'driver' || role === 'both') {
      update.isDriverCheckedOut = true;
      update.driverCheckedOutAt = timeStr;
      if (comments !== undefined) update.driverPayrollComments = comments;
    }
    if (role === 'attendant' || role === 'both') {
      update.isAttendantCheckedOut = true;
      update.attendantCheckedOutAt = timeStr;
      if (comments !== undefined) update.attendantPayrollComments = comments;
    }

    return await CharterService.updateAssignmentCrew(tripId, assignmentId, update, actorName);
  },

  undoCrewCheckIn: async (
    tripId: string,
    assignmentId: string,
    role: 'driver' | 'attendant' | 'both',
    actorName = 'Dispatcher'
  ): Promise<CharterTrip> => {
    const update: Partial<CharterAssignment> = {};
    if (role === 'driver' || role === 'both') {
      update.isDriverCheckedIn = false;
      update.driverCheckedInAt = undefined;
      update.isDriverCheckedOut = false;
      update.driverCheckedOutAt = undefined;
      update.driverPayrollComments = undefined;
      await CharterService.removeAssignmentPayroll(tripId, assignmentId, 'driver');
    }
    if (role === 'attendant' || role === 'both') {
      update.isAttendantCheckedIn = false;
      update.attendantCheckedInAt = undefined;
      update.isAttendantCheckedOut = false;
      update.attendantCheckedOutAt = undefined;
      update.attendantPayrollComments = undefined;
      await CharterService.removeAssignmentPayroll(tripId, assignmentId, 'attendant');
    }

    // Recheck assignment overall status
    if (role === 'both') {
      update.status = 0; // Pending
    }

    return await CharterService.updateAssignmentCrew(tripId, assignmentId, update, actorName);
  },

  updateAssignmentStopTime: async (
    tripId: string,
    assignmentId: string,
    stopId: string,
    stopUpdate: { arrivedAt?: string; departedAt?: string },
    actorName = 'Dispatcher'
  ): Promise<CharterTrip> => {
    if (!db) throw new Error('Firestore not initialized');
    const tripRef = doc(db, TRIPS_COLL, tripId);
    const snap = await getDoc(tripRef);
    if (!snap.exists()) throw new Error(`Trip ${tripId} not found`);

    const trip = snap.data() as CharterTrip;
    const assignments = trip.assignments || [];
    const index = assignments.findIndex((a) => a.id === assignmentId);
    if (index === -1) throw new Error(`Assignment ${assignmentId} not found`);

    const currentAsg = assignments[index];
    const baseStops: CharterStop[] =
      currentAsg.stops && currentAsg.stops.length > 0
        ? currentAsg.stops
        : (trip.stops || []).map((s) => {
            const copy: CharterStop = { ...s };
            delete copy.arrivedAt;
            delete copy.departedAt;
            return copy;
          });

    const updatedStops = baseStops.map((s) => {
      if (s.id !== stopId) return s;
      const next: CharterStop = { ...s };
      if ('arrivedAt' in stopUpdate) {
        if (stopUpdate.arrivedAt) next.arrivedAt = stopUpdate.arrivedAt;
        else delete next.arrivedAt;
      }
      if ('departedAt' in stopUpdate) {
        if (stopUpdate.departedAt) next.departedAt = stopUpdate.departedAt;
        else delete next.departedAt;
      }
      return next;
    });

    return await CharterService.updateAssignmentCrew(
      tripId,
      assignmentId,
      { stops: updatedStops },
      actorName
    );
  },

  // ─── SYNCHRONIZATION WITH DISPATCH PAYROLL & PAYROLL LOG ───────────────────

  syncAssignmentPayroll: async (
    trip: CharterTrip,
    assignment: CharterAssignment,
    actorName = 'Dispatcher'
  ): Promise<void> => {
    if (!db) return;

    // Driver check-in sync
    if (assignment.isDriverCheckedIn && assignment.driverName) {
      await CharterService.upsertCrewPayrollRecord({
        trip,
        assignment,
        role: 'driver',
        employeeId: assignment.driverId,
        employeeName: assignment.driverName,
        payOption: assignment.driverPayOption || 'STANDARD',
        payRate: assignment.driverPayRate ?? 0,
        eiHours: assignment.driverEiHours ?? 0,
        checkInTime: assignment.driverCheckedInAt || '08:00',
        checkOutTime: assignment.driverCheckedOutAt,
        comments: assignment.driverPayrollComments,
        actorName,
      });
    }

    // Attendant check-in sync
    if (assignment.isAttendantCheckedIn && assignment.attendantName) {
      await CharterService.upsertCrewPayrollRecord({
        trip,
        assignment,
        role: 'attendant',
        employeeId: assignment.attendantId || '',
        employeeName: assignment.attendantName,
        payOption: assignment.attendantPayOption || 'STANDARD',
        payRate: assignment.attendantPayRate ?? 0,
        eiHours: assignment.attendantEiHours ?? 0,
        checkInTime: assignment.attendantCheckedInAt || '08:00',
        checkOutTime: assignment.attendantCheckedOutAt,
        comments: assignment.attendantPayrollComments,
        actorName,
      });
    }
  },

  upsertCrewPayrollRecord: async (params: {
    trip: CharterTrip;
    assignment: CharterAssignment;
    role: 'driver' | 'attendant';
    employeeId: string;
    employeeName: string;
    payOption: string;
    payRate: number;
    eiHours: number;
    checkInTime: string;
    checkOutTime?: string;
    comments?: string;
    actorName: string;
  }): Promise<void> => {
    if (!db) return;

    const {
      trip,
      assignment,
      role,
      employeeId,
      employeeName,
      payOption,
      payRate,
      eiHours,
      checkInTime,
      checkOutTime,
      comments,
      actorName,
    } = params;

    const shiftId = `CHARTER-${trip.id}-${assignment.id}`;
    const payrollId = `DP-${shiftId}-${role}`;
    const logId = `PL-${shiftId}-${role}`;
    const nowIso = new Date().toISOString();

    const pRef = doc(db, PAYROLL_COLL, payrollId);
    const existingSnap = await getDoc(pRef);
    let existingRec: DispatchPayrollRecord | null = null;
    if (existingSnap.exists()) {
      existingRec = existingSnap.data() as DispatchPayrollRecord;
    }

    const hasComments = Boolean(comments && comments.trim().length > 0);
    // If not previously approved/rejected, set to pending_approval if comments or pending_checkout/pending_approval
    let currentStatus = existingRec?.status || (checkOutTime ? (hasComments ? 'pending_approval' : 'approved') : 'pending_approval');
    if (existingRec?.status === 'approved' || existingRec?.status === 'rejected') {
      currentStatus = existingRec.status;
    }

    const payrollRecord: DispatchPayrollRecord = {
      id: payrollId,
      dispatchDate: trip.dispatchDate,
      shiftId,
      routeNo: trip.tripNumber || `CHR-${trip.id.slice(-4).toUpperCase()}`,
      routeName: trip.title,
      shiftType: 'CHARTER',
      employeeId,
      employeeName,
      role,
      vehicleId: assignment.vehicleId,
      unitNumber: assignment.vehicleUnitNumber,
      checkInTime,
      checkOutTime: checkOutTime || existingRec?.checkOutTime,
      hasComments,
      payOption,
      payRate,
      eiHours,
      rateSource: 'charter_contract',
      rateDescription: `Charter Trip: ${trip.title} (${trip.clientName})`,
      payrollComments: comments || existingRec?.payrollComments,
      status: currentStatus,
      syncedToFinance: true,
      isCharter: true,
      charterTripId: trip.id,
      charterAssignmentId: assignment.id,
      clientName: trip.clientName,
      approvedBy: existingRec?.approvedBy,
      approvedAt: existingRec?.approvedAt,
      rejectedBy: existingRec?.rejectedBy,
      rejectedAt: existingRec?.rejectedAt,
      updatedBy: actorName,
      createdAt: existingRec?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    await setDoc(pRef, payrollRecord, { merge: true });

    // Sync to payroll_logs immediately as requested by user
    const logRef = doc(db, PAYROLL_LOG_COLL, logId);
    const logRecord: PayrollDepartmentLogRecord = {
      id: logId,
      dispatchPayrollId: payrollId,
      dispatchDate: trip.dispatchDate,
      shiftId,
      routeNo: payrollRecord.routeNo,
      routeName: payrollRecord.routeName,
      shiftType: 'CHARTER',
      employeeId,
      employeeName,
      role,
      unitNumber: assignment.vehicleUnitNumber,
      checkInTime,
      checkOutTime: checkOutTime || existingRec?.checkOutTime,
      payOption,
      originalPayRate: payRate,
      payAmount: payRate,
      originalEiHours: eiHours,
      eiHours,
      rateSource: 'charter_contract',
      rateDescription: `Charter Trip: ${trip.title} (${trip.clientName})`,
      dispatcherComments: comments || existingRec?.payrollComments,
      status: currentStatus === 'approved' ? 'approved' : 'processed',
      isCharter: true,
      charterTripId: trip.id,
      charterAssignmentId: assignment.id,
      clientName: trip.clientName,
      approvedBy: existingRec?.approvedBy,
      approvedAt: existingRec?.approvedAt,
      syncedAt: nowIso,
      updatedAt: nowIso,
      updatedBy: actorName,
    };

    await setDoc(logRef, logRecord, { merge: true });
  },

  removeAssignmentPayroll: async (
    tripId: string,
    assignmentId: string,
    role: 'driver' | 'attendant'
  ): Promise<void> => {
    if (!db) return;
    const shiftId = `CHARTER-${tripId}-${assignmentId}`;
    const payrollId = `DP-${shiftId}-${role}`;
    const logId = `PL-${shiftId}-${role}`;

    try {
      await deleteDoc(doc(db, PAYROLL_COLL, payrollId));
    } catch (e) {
      console.warn('Error deleting dispatch_payroll for charter:', e);
    }
    try {
      await deleteDoc(doc(db, PAYROLL_LOG_COLL, logId));
    } catch (e) {
      console.warn('Error deleting payroll_log for charter:', e);
    }
  },

  /**
   * Seed realistic sample data if collections are empty
   */
  seedSampleDataIfEmpty: async (): Promise<void> => {
    if (!db) return;
    try {
      const snap = await getDocs(query(collection(db, CLIENTS_COLL)));
      if (!snap.empty) return; // already seeded

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      const sampleClients: Omit<CharterClient, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          name: 'Ottawa-Carleton District School Board (Athletics)',
          contactName: 'Coach Robert Gagnon',
          contactPhone: '613-555-0144',
          contactEmail: 'athletics@ocdsb.ca',
          billingAddress: '133 Greenbank Rd, Nepean, ON K2H 6L3',
          notes: 'High school basketball tournament transportation',
          active: true,
        },
        {
          name: 'CEPEO - École secondaire publique Louis-Riel',
          contactName: 'Mme Sophie Lemieux',
          contactPhone: '613-555-0178',
          contactEmail: 'sophie.lemieux@cepeo.on.ca',
          billingAddress: '1655 Bearbrook Rd, Gloucester, ON K1B 4N3',
          notes: 'Science museum & parliamentary field trips',
          active: true,
        },
        {
          name: 'Gatineau Youth Soccer Association',
          contactName: 'Luc Tremblay',
          contactPhone: '819-555-0199',
          contactEmail: 'tournaments@soccerrg.qc.ca',
          billingAddress: '100 Rue de la Baie, Gatineau, QC J8T 3H5',
          notes: 'Regional weekend tournament shuttle services',
          active: true,
        },
      ];

      const clientIds: string[] = [];
      for (const sc of sampleClients) {
        const id = `client-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        clientIds.push(id);
        await setDoc(doc(db, CLIENTS_COLL, id), {
          ...sc,
          id,
          tripCount: 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Sample Charter Trip
      const tripId = `trip-sample-1`;
      const sampleTrip: CharterTrip = {
        id: tripId,
        tripNumber: 'CHR-2026-001',
        charterClientId: clientIds[0],
        clientName: sampleClients[0].name,
        title: 'Senior Boys Basketball Regional Finals',
        tripType: 1, // Athletic
        status: 2, // Assigned
        dispatchDate: today,
        departsAt: `${today}T08:30`,
        returnsAt: `${today}T15:30`,
        passengerCount: 42,
        needsAttendant: true,
        specialRequirements: 'Athletic equipment bags in rear seats. Arrive 15 min early.',
        quotedAmount: 620.0,
        billableHours: 7.0,
        billingNotes: 'Fixed rate with equipment loading surcharge',
        notes: 'Contact coach Gagnon upon arrival at Gate 3.',
        roundTrip: true,
        stops: [
          {
            id: `ST-${tripId}-1`,
            charterTripId: tripId,
            sequenceOrder: 1,
            stopType: 0,
            locationName: 'Nepean High School (Main Entrance)',
            address: '574 Broadview Ave, Ottawa, ON K2A 2L8',
            scheduledAt: `${today}T08:30`,
          },
          {
            id: `ST-${tripId}-2`,
            charterTripId: tripId,
            sequenceOrder: 2,
            stopType: 1,
            locationName: 'Carleton University Ravens Sports Complex',
            address: '1125 Colonel By Dr, Ottawa, ON K1S 5B6',
            scheduledAt: `${today}T09:15`,
          },
          {
            id: `ST-${tripId}-3`,
            charterTripId: tripId,
            sequenceOrder: 3,
            stopType: 2,
            locationName: 'Nepean High School (Return)',
            address: '574 Broadview Ave, Ottawa, ON K2A 2L8',
            scheduledAt: `${today}T15:30`,
          },
        ],
        assignments: [
          {
            id: `ASG-${tripId}-1`,
            charterTripId: tripId,
            vehicleId: 101,
            vehicleUnitNumber: 'BUS-201',
            plateNumber: 'ON-84920',
            driverId: 'EMP-DRV-101',
            driverName: 'Marc Tremblay',
            driverPhone: '613-555-0111',
            attendantId: 'EMP-ATT-201',
            attendantName: 'Claire Boucher',
            attendantPhone: '613-555-0114',
            driverPayOption: 'STANDARD',
            driverPayRate: 185.0,
            driverEiHours: 7.0,
            attendantPayOption: 'STANDARD',
            attendantPayRate: 140.0,
            attendantEiHours: 7.0,
            status: 0, // Pending check-in
            isDriverCheckedIn: false,
            isAttendantCheckedIn: false,
            notes: 'Assigned 72-passenger unit with extra luggage space',
            createdAt: now,
            updatedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, TRIPS_COLL, tripId), sampleTrip);
    } catch (err) {
      console.warn('Sample data seed note:', err);
    }
  },
};
