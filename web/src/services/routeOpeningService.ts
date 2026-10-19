import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import {
  RouteOpening,
  CreateRouteOpeningPayload,
  RouteOpeningApplicant
} from '../types/routeOpening';
import { RouteService } from './routeService';
import { DispatchService } from './dispatchService';

const COLLECTION_NAME = 'route_openings';

/**
 * Returns local today's date string in YYYY-MM-DD format.
 */
export function getTodayLocalDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Recursively strips undefined properties from objects and arrays so Firestore setDoc never fails.
 */
function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = stripUndefined(value);
    }
  }
  return cleaned as T;
}

export const RouteOpeningService = {
  /**
   * List all route openings
   */
  listOpenings: async (): Promise<RouteOpening[]> => {
    if (!db) return [];
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: RouteOpening[] = [];
      snap.forEach((d) => {
        list.push({ ...(d.data() as RouteOpening), id: d.id });
      });
      RouteOpeningService.syncEffectivePermanentOpenings(list).catch((e) =>
        console.warn('[RouteOpeningService] Auto-sync permanent openings notice:', e)
      );
      return list;
    } catch (err) {
      console.error('[RouteOpeningService] Error listing openings:', err);
      return [];
    }
  },

  /**
   * Real-time subscription to route openings
   */
  subscribeToOpenings: (
    onUpdate: (openings: RouteOpening[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!db) {
      RouteOpeningService.listOpenings().then(onUpdate).catch(onError);
      return () => {};
    }

    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: RouteOpening[] = [];
          snapshot.forEach((d) => {
            list.push({ ...(d.data() as RouteOpening), id: d.id });
          });
          onUpdate(list);
          RouteOpeningService.syncEffectivePermanentOpenings(list).catch((e) =>
            console.warn('[RouteOpeningService] Auto-sync permanent openings notice:', e)
          );
        },
        (error) => {
          console.error('[RouteOpeningService] onSnapshot listener error:', error);
          if (onError) onError(error);
          RouteOpeningService.listOpenings().then(onUpdate).catch(console.error);
        }
      );
      return unsubscribe;
    } catch (e: any) {
      console.error('[RouteOpeningService] Exception in subscription:', e);
      RouteOpeningService.listOpenings().then(onUpdate).catch(onError);
      return () => {};
    }
  },

  /**
   * Create and publish a new route opening
   */
  createOpening: async (payload: CreateRouteOpeningPayload): Promise<RouteOpening> => {
    if (!db) throw new Error('Firestore is not initialized');

    const id = `RO-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const title =
      payload.postingType === 'permanent'
        ? `Permanent Route Driver/Crew - Route ${payload.routeNo}`
        : `Temporary Route Coverage - Route ${payload.routeNo}`;

    const newOpening: RouteOpening = {
      id,
      title,
      routeId: payload.routeId,
      routeNo: payload.routeNo,
      routeName: payload.routeName,
      yardId: payload.yardId,
      yardName: payload.yardName,
      schoolBoardCode: payload.schoolBoardCode,
      postingType: payload.postingType,
      roleNeeded: payload.roleNeeded,
      effectiveStartDate: payload.effectiveStartDate,
      effectiveEndDate: payload.effectiveEndDate,
      shiftType: payload.shiftType || 'ALL',
      deadline: payload.deadline,
      compensationNote: payload.compensationNote,
      description: payload.description,
      requirements: payload.requirements,
      status: 'open',
      applicants: [],
      chatAnnouncementSent: false,
      createdBy: payload.createdBy,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const docRef = doc(db, COLLECTION_NAME, id);
    await setDoc(docRef, stripUndefined(newOpening));

    // Broadcast bulletin to Fleet Chat if selected
    if (payload.postToChat) {
      try {
        await RouteOpeningService.broadcastOpeningToChat(newOpening, payload.createdBy);
        newOpening.chatAnnouncementSent = true;
        newOpening.chatChannelId = 'channel-broadcast';
        await setDoc(docRef, { chatAnnouncementSent: true, chatChannelId: 'channel-broadcast' }, { merge: true });
      } catch (chatErr) {
        console.warn('[RouteOpeningService] Could not send chat announcement:', chatErr);
      }
    }

    return newOpening;
  },

  /**
   * Update an opening
   */
  updateOpening: async (id: string, updates: Partial<RouteOpening>): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, COLLECTION_NAME, id);
    await setDoc(docRef, stripUndefined({ ...updates, updatedAt: new Date().toISOString() }), { merge: true });
  },

  /**
   * Delete an opening
   */
  deleteOpening: async (id: string): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  /**
   * Apply / Express Interest in an opening
   */
  applyForOpening: async (
    openingId: string,
    applicant: RouteOpeningApplicant
  ): Promise<void> => {
    if (!db) throw new Error('Firestore is not initialized');
    const docRef = doc(db, COLLECTION_NAME, openingId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Opening not found');

    const opening = snap.data() as RouteOpening;
    const existing = opening.applicants || [];

    // Replace if already applied or append
    const updatedApplicants = [
      ...existing.filter((a) => a.employeeId !== applicant.employeeId),
      stripUndefined(applicant)
    ];

    await setDoc(
      docRef,
      stripUndefined({
        applicants: updatedApplicants,
        updatedAt: new Date().toISOString()
      }),
      { merge: true }
    );
  },

  /**
   * Withdraw application
   */
  withdrawApplication: async (openingId: string, employeeId: string): Promise<void> => {
    if (!db) throw new Error('Firestore is not initialized');
    const docRef = doc(db, COLLECTION_NAME, openingId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const opening = snap.data() as RouteOpening;
    const existing = opening.applicants || [];

    const updated = existing.map((a) => {
      if (a.employeeId === employeeId) {
        return { ...a, status: 'withdrawn' as const };
      }
      return a;
    });

    await setDoc(
      docRef,
      stripUndefined({
        applicants: updated,
        updatedAt: new Date().toISOString()
      }),
      { merge: true }
    );
  },

  /**
   * Apply an awarded permanent opening's crew to the route and route_shifts in Firestore + backend,
   * preserving existing vehicle and other crew role fields.
   */
  applyPermanentOpeningCrewToRoute: async (opening: RouteOpening): Promise<void> => {
    if (!db || opening.postingType !== 'permanent') return;

    const hasAwardedDriver = Boolean(opening.awardedDriverId || opening.awardedDriverName);
    const hasAwardedAttendant = Boolean(opening.awardedAttendantId || opening.awardedAttendantName);
    if (!hasAwardedDriver && !hasAwardedAttendant) return;

    const nowIso = new Date().toISOString();

    // 1. Locate the route document in Firestore
    let routeDocId = opening.routeId;
    let routeData: Record<string, any> = {};

    try {
      let routeSnap = await getDoc(doc(db, 'routes', routeDocId));
      if (!routeSnap.exists() && !routeDocId.startsWith('RT-')) {
        routeSnap = await getDoc(doc(db, 'routes', `RT-${routeDocId}`));
        if (routeSnap.exists()) routeDocId = routeSnap.id;
      }
      if (!routeSnap.exists() && opening.routeNo) {
        const qRoute = query(collection(db, 'routes'), where('routeNo', '==', opening.routeNo));
        const qSnap = await getDocs(qRoute);
        if (!qSnap.empty) {
          routeDocId = qSnap.docs[0].id;
          routeData = qSnap.docs[0].data();
        }
      } else if (routeSnap.exists()) {
        routeData = routeSnap.data();
      }
    } catch (err) {
      console.warn('[RouteOpeningService] Could not fetch route doc:', err);
    }

    const crewPatch: Record<string, any> = {};
    if (hasAwardedDriver) {
      crewPatch.driverId = opening.awardedDriverId || '';
      crewPatch.driverName = opening.awardedDriverName || '';
      if (opening.awardedDriverPhone !== undefined) {
        crewPatch.driverPhone = opening.awardedDriverPhone;
      }
    }
    if (hasAwardedAttendant) {
      crewPatch.attendantId = opening.awardedAttendantId || '';
      crewPatch.attendantName = opening.awardedAttendantName || '';
      if (opening.awardedAttendantPhone !== undefined) {
        crewPatch.attendantPhone = opening.awardedAttendantPhone;
      }
    }

    const targetShift = (opening.shiftType || 'ALL').toUpperCase().trim();
    const isAllShifts = !targetShift || targetShift === 'ALL';

    // 2. Update routes/{routeDocId} if ALL shifts (or if route has no driver/attendant yet)
    if (routeDocId) {
      try {
        if (isAllShifts) {
          await setDoc(
            doc(db, 'routes', routeDocId),
            stripUndefined({
              ...crewPatch,
              updatedAt: nowIso
            }),
            { merge: true }
          );

          // Call backend API with full preserved fields so vehicle and other crew role are never wiped
          const fullCrewPayload = {
            driverId: hasAwardedDriver ? crewPatch.driverId : (routeData.driverId || ''),
            driverName: hasAwardedDriver ? crewPatch.driverName : (routeData.driverName || ''),
            driverPhone: hasAwardedDriver
              ? (crewPatch.driverPhone ?? routeData.driverPhone ?? '')
              : (routeData.driverPhone || ''),
            attendantId: hasAwardedAttendant ? crewPatch.attendantId : (routeData.attendantId || ''),
            attendantName: hasAwardedAttendant ? crewPatch.attendantName : (routeData.attendantName || ''),
            attendantPhone: hasAwardedAttendant
              ? (crewPatch.attendantPhone ?? routeData.attendantPhone ?? '')
              : (routeData.attendantPhone || ''),
            vehicleId: routeData.vehicleId || 0,
            unitNumber: routeData.unitNumber || '',
            plateNumber: routeData.plateNumber || ''
          };
          await RouteService.assignCrew(routeDocId, fullCrewPayload).catch(() => {});
        } else {
          // Specific shift opening (e.g. AM or PM): only backfill route-level crew if currently empty
          const routeFallbackPatch: Record<string, any> = {};
          if (hasAwardedDriver && !routeData.driverName) {
            routeFallbackPatch.driverId = crewPatch.driverId;
            routeFallbackPatch.driverName = crewPatch.driverName;
            if (crewPatch.driverPhone !== undefined) routeFallbackPatch.driverPhone = crewPatch.driverPhone;
          }
          if (hasAwardedAttendant && !routeData.attendantName) {
            routeFallbackPatch.attendantId = crewPatch.attendantId;
            routeFallbackPatch.attendantName = crewPatch.attendantName;
            if (crewPatch.attendantPhone !== undefined) routeFallbackPatch.attendantPhone = crewPatch.attendantPhone;
          }
          if (Object.keys(routeFallbackPatch).length > 0) {
            await setDoc(
              doc(db, 'routes', routeDocId),
              stripUndefined({ ...routeFallbackPatch, updatedAt: nowIso }),
              { merge: true }
            );
          }
        }
      } catch (err) {
        console.warn('[RouteOpeningService] Error updating route document:', err);
      }
    }

    // 3. Update matching route_shifts in Firestore
    try {
      const shiftQueries = [
        query(collection(db, 'route_shifts'), where('routeId', '==', routeDocId))
      ];
      if (opening.routeNo) {
        shiftQueries.push(query(collection(db, 'route_shifts'), where('routeNo', '==', opening.routeNo)));
      }
      const seenShiftIds = new Set<string>();
      for (const sq of shiftQueries) {
        const sSnap = await getDocs(sq);
        for (const sDoc of sSnap.docs) {
          if (seenShiftIds.has(sDoc.id)) continue;
          seenShiftIds.add(sDoc.id);
          const sData = sDoc.data();
          const sType = String(sData.shiftType || '').toUpperCase().trim();
          if (isAllShifts || sType === targetShift) {
            await setDoc(
              doc(db, 'route_shifts', sDoc.id),
              stripUndefined({
                ...crewPatch,
                isCustomCrew: isAllShifts ? Boolean(sData.isCustomCrew) : true,
                updatedAt: nowIso
              }),
              { merge: true }
            );
          }
        }
      }
    } catch (err) {
      console.warn('[RouteOpeningService] Error updating route_shifts:', err);
    }

    // 4. Update any existing dispatch_shifts on or after effectiveStartDate
    await RouteOpeningService.applyPermanentOpeningToFutureDispatches(opening);

    // 5. Mark crewAppliedToRoute = true on the route_openings document
    try {
      await setDoc(
        doc(db, COLLECTION_NAME, opening.id),
        {
          crewAppliedToRoute: true,
          crewAppliedAt: nowIso,
          updatedAt: nowIso
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[RouteOpeningService] Could not mark crewAppliedToRoute:', err);
    }
  },

  /**
   * Update any already-generated dispatch_shifts on or after opening.effectiveStartDate
   * (unless overridden by a temporary assignment).
   */
  applyPermanentOpeningToFutureDispatches: async (opening: RouteOpening): Promise<void> => {
    if (!db || opening.postingType !== 'permanent' || !opening.effectiveStartDate) return;
    const hasAwardedDriver = Boolean(opening.awardedDriverId || opening.awardedDriverName);
    const hasAwardedAttendant = Boolean(opening.awardedAttendantId || opening.awardedAttendantName);
    if (!hasAwardedDriver && !hasAwardedAttendant) return;

    const targetShift = (opening.shiftType || 'ALL').toUpperCase().trim();
    const isAllShifts = !targetShift || targetShift === 'ALL';
    const nowIso = new Date().toISOString();

    try {
      const qDispatches = query(
        collection(db, 'dispatch_shifts'),
        where('routeNo', '==', opening.routeNo)
      );
      const snap = await getDocs(qDispatches);
      for (const dDoc of snap.docs) {
        const dData = dDoc.data();
        const dDate = String(dData.dispatchDate || '');
        if (!dDate || dDate < opening.effectiveStartDate) continue;

        const dShift = String(dData.shiftType || '').toUpperCase().trim();
        if (!isAllShifts && dShift !== targetShift) continue;

        const patch: Record<string, any> = {};
        if (hasAwardedDriver && !dData.isTemporaryDriver) {
          patch.driverId = opening.awardedDriverId || '';
          patch.driverName = opening.awardedDriverName || '';
          if (opening.awardedDriverPhone !== undefined) {
            patch.driverPhone = opening.awardedDriverPhone;
          }
        }
        if (hasAwardedAttendant && !dData.isTemporaryAttendant) {
          patch.attendantId = opening.awardedAttendantId || '';
          patch.attendantName = opening.awardedAttendantName || '';
          if (opening.awardedAttendantPhone !== undefined) {
            patch.attendantPhone = opening.awardedAttendantPhone;
          }
        }
        if (Object.keys(patch).length > 0) {
          const finalDriverName = patch.driverName ?? dData.driverName;
          const finalUnitNumber = dData.unitNumber;
          if (finalDriverName && finalUnitNumber && dData.health === 'red') {
            patch.health = 'green';
          }
          patch.updatedAt = nowIso;
          await setDoc(doc(db, 'dispatch_shifts', dDoc.id), stripUndefined(patch), { merge: true });
        }
      }
    } catch (err) {
      console.warn('[RouteOpeningService] Notice updating future dispatch_shifts:', err);
    }
  },

  /**
   * Automatically checks all awarded permanent openings and applies their crew to routes/route_shifts
   * once today's date reaches or passes effectiveStartDate.
   */
  syncEffectivePermanentOpenings: async (openingsList?: RouteOpening[]): Promise<void> => {
    if (!db) return;
    const todayStr = getTodayLocalDateStr();

    let list = openingsList;
    if (!list) {
      const q = query(collection(db, COLLECTION_NAME), where('status', '==', 'awarded'));
      const snap = await getDocs(q);
      list = [];
      snap.forEach((d) => list!.push({ ...(d.data() as RouteOpening), id: d.id }));
    }

    for (const op of list) {
      if (
        op.postingType === 'permanent' &&
        op.status === 'awarded' &&
        !op.crewAppliedToRoute &&
        op.effectiveStartDate &&
        op.effectiveStartDate <= todayStr
      ) {
        await RouteOpeningService.applyPermanentOpeningCrewToRoute(op);
      }
    }
  },

  /**
   * Confirm and award the position to a selected applicant
   */
  confirmAndAwardOpening: async (
    opening: RouteOpening,
    applicant: RouteOpeningApplicant,
    actorName: string,
    notes?: string
  ): Promise<void> => {
    if (!db) throw new Error('Firestore is not initialized');

    const nowIso = new Date().toISOString();
    const todayStr = getTodayLocalDateStr();
    const isDriver = applicant.roleApplied === 'driver';

    const newAwardedDriverId = isDriver ? applicant.employeeId : opening.awardedDriverId;
    const newAwardedDriverName = isDriver ? applicant.fullName : opening.awardedDriverName;
    const newAwardedDriverPhone = isDriver ? (applicant.phone || '') : opening.awardedDriverPhone;
    const newAwardedAttendantId = !isDriver ? applicant.employeeId : opening.awardedAttendantId;
    const newAwardedAttendantName = !isDriver ? applicant.fullName : opening.awardedAttendantName;
    const newAwardedAttendantPhone = !isDriver ? (applicant.phone || '') : opening.awardedAttendantPhone;

    // 1. Update applicants status (if roleNeeded === 'driver_and_attendant', only reject pending applicants of the same role)
    const updatedApplicants = (opening.applicants || []).map((a) => {
      if (a.employeeId === applicant.employeeId && a.roleApplied === applicant.roleApplied) {
        return { ...a, status: 'selected' as const };
      }
      if (
        a.status === 'pending' &&
        (opening.roleNeeded !== 'driver_and_attendant' || a.roleApplied === applicant.roleApplied)
      ) {
        return { ...a, status: 'rejected' as const };
      }
      return a;
    });

    // Check if all required roles are now awarded
    const isFullyAwarded =
      opening.roleNeeded === 'driver_and_attendant'
        ? Boolean(newAwardedDriverId && newAwardedAttendantId)
        : true;

    const updatedOpening: RouteOpening = {
      ...opening,
      status: isFullyAwarded ? 'awarded' : 'reviewing',
      applicants: updatedApplicants,
      awardedDriverId: newAwardedDriverId,
      awardedDriverName: newAwardedDriverName,
      awardedDriverPhone: newAwardedDriverPhone,
      awardedAttendantId: newAwardedAttendantId,
      awardedAttendantName: newAwardedAttendantName,
      awardedAttendantPhone: newAwardedAttendantPhone,
      awardedAt: nowIso,
      awardedBy: actorName,
      awardedNotes: notes || opening.awardedNotes || '',
      crewAppliedToRoute: false,
      updatedAt: nowIso
    };

    // 2. If temporary: create a temporary assignment record and immediately sync existing dispatches in date range
    let tempAssignmentId = opening.temporaryAssignmentId;
    if (opening.postingType === 'temporary') {
      try {
        // Fetch current route crew to populate originalDriver / originalAttendant
        let origDriverId: string | undefined;
        let origDriverName: string | undefined;
        let origAttendantId: string | undefined;
        let origAttendantName: string | undefined;
        try {
          const rSnap = await getDoc(doc(db, 'routes', opening.routeId));
          if (rSnap.exists()) {
            const rData = rSnap.data();
            origDriverId = rData.driverId;
            origDriverName = rData.driverName;
            origAttendantId = rData.attendantId;
            origAttendantName = rData.attendantName;
          }
        } catch {}

        const tempRes = await DispatchService.createTemporaryAssignment({
          routeId: opening.routeId,
          routeNo: opening.routeNo,
          routeName: opening.routeName,
          shiftType: opening.shiftType || 'ALL',
          startDate: opening.effectiveStartDate,
          endDate: opening.effectiveEndDate || opening.effectiveStartDate,
          originalDriverId: isDriver ? origDriverId : undefined,
          originalDriverName: isDriver ? origDriverName : undefined,
          temporaryDriverId: isDriver ? applicant.employeeId : undefined,
          temporaryDriverName: isDriver ? applicant.fullName : undefined,
          temporaryDriverPhone: isDriver ? applicant.phone : undefined,
          originalAttendantId: !isDriver ? origAttendantId : undefined,
          originalAttendantName: !isDriver ? origAttendantName : undefined,
          temporaryAttendantId: !isDriver ? applicant.employeeId : undefined,
          temporaryAttendantName: !isDriver ? applicant.fullName : undefined,
          temporaryAttendantPhone: !isDriver ? applicant.phone : undefined,
          reason: 'Bidding Award / Route Opening Coverage',
          notes: notes || `Awarded to ${applicant.fullName} via Route Opening #${opening.id}`,
          createdBy: actorName,
          fromRouteOpeningId: opening.id
        });
        tempAssignmentId = tempRes.id;
        updatedOpening.temporaryAssignmentId = tempAssignmentId;
      } catch (tempErr) {
        console.warn('[RouteOpeningService] Temporary assignment creation notice:', tempErr);
      }
    }

    // 3. Save opening state in Firestore
    const docRef = doc(db, COLLECTION_NAME, opening.id);
    await setDoc(docRef, stripUndefined(updatedOpening), { merge: true });

    // 4. If permanent:
    //    - If effectiveStartDate <= todayStr: immediately update route & route_shifts crew (and future dispatches)
    //    - If effectiveStartDate > todayStr: keep current route crew until effectiveStartDate arrives,
    //      but update any already-generated future dispatch_shifts on or after effectiveStartDate.
    if (opening.postingType === 'permanent') {
      if (!opening.effectiveStartDate || opening.effectiveStartDate <= todayStr) {
        await RouteOpeningService.applyPermanentOpeningCrewToRoute(updatedOpening);
      } else {
        await RouteOpeningService.applyPermanentOpeningToFutureDispatches(updatedOpening);
      }
    }

    // 5. Post award message to Chat Broadcast channel
    try {
      const awardMsg = `🎉 [ROUTE ASSIGNMENT CONFIRMED]\nRoute ${opening.routeNo} (${opening.postingType === 'permanent' ? 'Permanent' : 'Temporary Coverage'}) has been awarded to ${applicant.fullName} (${applicant.roleApplied.toUpperCase()}) effective ${opening.effectiveStartDate}.\nThank you to all who applied!`;
      await RouteOpeningService.postBroadcastMessage(awardMsg, actorName);
    } catch (e) {
      console.warn('[RouteOpeningService] Award announcement notice:', e);
    }
  },

  /**
   * Broadcast an opening announcement to Fleet Chat channel-broadcast
   */
  broadcastOpeningToChat: async (opening: RouteOpening, actorName: string): Promise<void> => {
    const roleLabel =
      opening.roleNeeded === 'driver'
        ? 'Driver'
        : opening.roleNeeded === 'attendant'
        ? 'Attendant'
        : 'Driver & Attendant';

    const typeLabel =
      opening.postingType === 'permanent'
        ? `Permanent (Effective: ${opening.effectiveStartDate})`
        : `Temporary Coverage (${opening.effectiveStartDate} ~ ${opening.effectiveEndDate || opening.effectiveStartDate})`;

    const deadlineFormatted = opening.deadline.replace('T', ' ');

    const text =
      `📢 [FLEET ROUTE OPENING BULLETIN / OFFRE D'ITINÉRAIRE]\n` +
      `📍 Route: ${opening.routeNo} ${opening.routeName ? '- ' + opening.routeName : ''}\n` +
      `💼 Position: ${roleLabel} | ${typeLabel}\n` +
      `⏰ Shifts: ${opening.shiftType}\n` +
      `⏳ Application Deadline: ${deadlineFormatted}\n` +
      `${opening.description ? `📝 Details: ${opening.description}\n` : ''}` +
      `👉 Interested drivers & attendants: Open the "Route Openings" tab to preview sanitized route stops and submit your application!`;

    await RouteOpeningService.postBroadcastMessage(text, actorName);
  },

  /**
   * Helper to write message to channel-broadcast
   */
  postBroadcastMessage: async (text: string, actorName: string): Promise<void> => {
    if (!db) return;

    const channelId = 'channel-broadcast';
    const messagesColl = collection(db, 'chat_channels', channelId, 'messages');
    const nowIso = new Date().toISOString();

    await addDoc(messagesColl, {
      channelId,
      senderId: 'SYSTEM-DISPATCH',
      senderName: `Dispatch (${actorName || 'Dispatch'})`,
      text,
      createdAt: nowIso,
      timestamp: serverTimestamp()
    });

    const channelRef = doc(db, 'chat_channels', channelId);
    await setDoc(
      channelRef,
      {
        id: channelId,
        type: 'broadcast',
        name: 'All Fleet Announcements',
        lastMessage: {
          text,
          senderId: 'SYSTEM-DISPATCH',
          senderName: `Dispatch (${actorName || 'Dispatch'})`,
          createdAt: nowIso
        },
        updatedAt: nowIso
      },
      { merge: true }
    );
  }
};
