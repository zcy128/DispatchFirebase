import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, MapPin, Check, AlertTriangle, Users, CheckCircle2, UserX, Bell, MessageSquare, RotateCcw, Navigation } from 'lucide-react';
import { DispatchShift, DispatchShiftStop, DispatchStudentStatus } from '../../types/dispatch';
import { DispatchService } from '../../services/dispatchService';
import { getSentParentNotifications } from '../../utils/dispatchDelayUtils';
import { useAuth } from '../../contexts/AuthContext';
import { logDispatchAction } from '../../utils/dispatchLogger';
import { Student } from '../../types/student';
import { ShiftGoogleMapView } from '../routes/ShiftGoogleMapView';
import { convertDispatchShiftToRouteShift } from '../../utils/dispatchShiftToRoute';

interface DispatchStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: DispatchShift | null;
  initialStopId?: number | null;
  onShiftUpdated: (updatedShift: DispatchShift) => void;
  isToday?: boolean;
  onOpenNotification?: (shift: DispatchShift, stop?: DispatchShiftStop) => void;
  onOpenHistory?: (shift: DispatchShift) => void;
  initialTab?: 'stops' | 'map';
  studentsMap?: Record<number, Student>;
}

export const DispatchStopModal: React.FC<DispatchStopModalProps> = ({
  isOpen,
  onClose,
  shift,
  initialStopId,
  onShiftUpdated,
  isToday,
  onOpenNotification,
  onOpenHistory,
  initialTab = 'stops',
  studentsMap = {},
}) => {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  if (!isOpen || !shift) return null;

  const stops = Array.isArray(shift.stops) ? shift.stops : [];

  const [activeTab, setActiveTab] = useState<'stops' | 'map'>(initialTab || 'stops');

  useEffect(() => {
    setActiveTab(initialTab || 'stops');
  }, [initialTab, shift?.id]);

  const { shift: routeShift, route } = useMemo(() => {
    if (!shift) return { shift: null, route: null };
    return convertDispatchShiftToRouteShift(shift);
  }, [shift]);

  const [selectedStopId, setSelectedStopId] = useState<number>(
    initialStopId || (stops.length > 0 ? stops[0].stopId : 0)
  );

  const [customArrivalTime, setCustomArrivalTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const [savingArrival, setSavingArrival] = useState(false);
  const [updatingStudent, setUpdatingStudent] = useState<number | null>(null);

  // Absence modal state
  const [absenceTarget, setAbsenceTarget] = useState<{
    stopId: number;
    studentId: number;
    studentName: string;
  } | null>(null);
  const [absencePreset, setAbsencePreset] = useState<string>('Illness / Sick');
  const [absenceNote, setAbsenceNote] = useState<string>('');
  const [applyToAllRuns, setApplyToAllRuns] = useState<boolean>(true);
  const [savingAbsence, setSavingAbsence] = useState<boolean>(false);

  const currentStop: DispatchShiftStop | undefined =
    stops.find((s) => s.stopId === selectedStopId) || stops[0];

  const handleConfirmAbsence = async () => {
    if (!absenceTarget) return;
    try {
      setSavingAbsence(true);
      const finalReason = absenceNote.trim()
        ? `${absencePreset}: ${absenceNote.trim()}`
        : absencePreset;

      if (applyToAllRuns) {
        await DispatchService.recordStudentAbsence({
          date: shift.dispatchDate,
          studentId: absenceTarget.studentId,
          routeNo: shift.routeNo,
          shiftType: 'ALL',
          reason: finalReason,
          reportedBy: actorName,
        });
      }

      const updated = await DispatchService.updateStudentStatus(
        shift.id,
        absenceTarget.stopId,
        absenceTarget.studentId,
        'absent',
        finalReason,
        actorName
      );

      const stopObj = stops.find((s) => s.stopId === absenceTarget.stopId);
      await logDispatchAction({
        date: shift.dispatchDate,
        type: 'Student Absence Logged',
        detail: `Parent notified: Student ${absenceTarget.studentName} marked absent at Stop #${stopObj?.sequence ?? ''}. Reason: ${finalReason}`,
        shift,
        user: actorName,
      });

      onShiftUpdated(updated);
      setAbsenceTarget(null);
      setAbsenceNote('');
    } catch (err: any) {
      console.error('Failed to mark student absent:', err);
      alert('Failed to mark absent: ' + err.message);
    } finally {
      setSavingAbsence(false);
    }
  };

  const handleRecordArrival = async (stopId: number, timeStr?: string) => {
    try {
      setSavingArrival(true);
      const timeToUse = timeStr || customArrivalTime;
      const updated = await DispatchService.recordStopArrival(shift.id, stopId, timeToUse);

      const stopObj = stops.find((s) => s.stopId === stopId);
      await logDispatchAction({
        date: shift.dispatchDate,
        type: 'Stop Arrival',
        detail: `Stop #${stopObj?.sequence ?? ''} (${stopObj?.stopLocation ?? ''}) marked arrived at ${timeToUse}`,
        shift,
        user: actorName,
      });

      onShiftUpdated(updated);
    } catch (err) {
      console.error('Failed to record arrival:', err);
      alert('Failed to record arrival: ' + (err as Error).message);
    } finally {
      setSavingArrival(false);
    }
  };

  const handleStudentStatus = async (stopId: number, studentId: number, status: DispatchStudentStatus) => {
    try {
      setUpdatingStudent(studentId);
      const updated = await DispatchService.updateStudentStatus(shift.id, stopId, studentId, status);

      const stopObj = stops.find((s) => s.stopId === stopId);
      const studentObj = (stopObj?.assignedStudents || []).find((st) => st.studentId === studentId);
      await logDispatchAction({
        date: shift.dispatchDate,
        type: 'Student Boarding',
        detail: `Student ${studentObj?.studentName ?? studentId} marked as ${status} at Stop #${stopObj?.sequence ?? ''} (${stopObj?.stopLocation ?? ''})`,
        shift,
        user: actorName,
      });

      onShiftUpdated(updated);
    } catch (err) {
      console.error('Failed to update student status:', err);
      alert('Failed to update student: ' + (err as Error).message);
    } finally {
      setUpdatingStudent(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full ${activeTab === 'map' ? 'max-w-5xl h-[88vh]' : 'max-w-4xl max-h-[90vh]'} flex flex-col overflow-hidden transition-all duration-200`}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 gap-2">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-base sm:text-lg">
                {shift.routeNo}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                {shift.shiftType}
              </span>
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                • {shift.routeName}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>Driver: <strong className="text-slate-700 dark:text-slate-200">{shift.driverName || 'Unassigned'}</strong></span>
              <span>Unit: <strong className="text-slate-700 dark:text-slate-200">{shift.unitNumber || 'Unassigned'}</strong></span>
              <span>Date: <strong className="text-slate-700 dark:text-slate-200">{shift.dispatchDate}</strong></span>
            </div>
          </div>

          {/* Right Header Actions: View Mode Switcher + Close */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('stops')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'stops'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Stops Itinerary</span>
                <span className="sm:hidden">Stops</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'map'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Shift Map</span>
                <span className="sm:hidden">Map</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body: Map view or Stops list */}
        {activeTab === 'map' && routeShift && route ? (
          <div className="flex-1 w-full bg-slate-950 min-h-[500px] p-2 flex flex-col overflow-hidden">
            <ShiftGoogleMapView
              shift={routeShift}
              route={route}
              studentsMap={studentsMap}
              height="100%"
              showAdjustStops={false}
              allowZonarTrace
              vehicleId={shift.vehicleId}
              traceDate={shift.dispatchDate}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Mobile Horizontal Stop Selector Strip (visible on mobile only) */}
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
            {stops.map((st) => {
              const isSelected = st.stopId === currentStop?.stopId;
              const isArrived = !!(st.actualArrivalTime || st.stopArrivalTime);
              return (
                <button
                  key={st.stopId}
                  onClick={() => setSelectedStopId(st.stopId)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isArrived
                        ? isSelected
                          ? 'bg-white text-amber-600'
                          : 'bg-emerald-600 text-white'
                        : isSelected
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isArrived ? '✓' : st.sequence}
                  </span>
                  <span>#{st.sequence} {st.stopScheduleTime}</span>
                </button>
              );
            })}
          </div>

          {/* Stops List (Left column for Desktop) */}
          <div className="hidden md:block w-1/3 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 py-1">
              Stop Itinerary ({shift.completedStops}/{shift.totalStops})
            </div>
            {stops.map((st) => {
              const isSelected = st.stopId === currentStop?.stopId;
              const isArrived = !!(st.actualArrivalTime || st.stopArrivalTime);
              return (
                <button
                  key={st.stopId}
                  onClick={() => setSelectedStopId(st.stopId)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-slate-900 dark:text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isArrived
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-400 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isArrived ? <Check className="w-3.5 h-3.5" /> : st.sequence}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold">{st.stopScheduleTime}</span>
                      {isArrived ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                          {st.actualArrivalTime || st.stopArrivalTime}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Pending</span>
                      )}
                    </div>
                    <div className="text-xs font-medium truncate mt-0.5" title={st.stopLocation}>
                      {st.stopLocation}
                    </div>
                    {st.schoolName && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {st.schoolName}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Stop Details (Right column on Desktop, full width on Mobile) */}
          <div className="w-full md:w-2/3 flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            {currentStop ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Stop #{currentStop.sequence}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                        {currentStop.stopType}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {currentStop.stopLocation}
                    </h3>
                    {currentStop.schoolName && (
                      <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Services: <strong>{currentStop.schoolName}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Arrival Status & Quick Action */}
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-500">Scheduled</div>
                    <div className="text-lg sm:text-xl font-mono font-bold text-slate-800 dark:text-slate-100">
                      {currentStop.stopScheduleTime}
                    </div>
                  </div>
                </div>

                {/* Arrival Tracking Card */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Stop Arrival Status</span>
                    </div>
                    {currentStop.actualArrivalTime || currentStop.stopArrivalTime ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                          Arrived at {currentStop.actualArrivalTime || currentStop.stopArrivalTime}
                        </span>
                        {(currentStop.minutesLate || 0) > 0 && (
                          <span className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-1 rounded-full border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            +{currentStop.minutesLate}m late
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Waiting for vehicle arrival
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Arrival Time:</span>
                      <input
                        type="time"
                        value={customArrivalTime}
                        onChange={(e) => setCustomArrivalTime(e.target.value)}
                        className="px-2.5 py-1.5 text-xs sm:text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={() => handleRecordArrival(currentStop.stopId, customArrivalTime)}
                      disabled={savingArrival}
                      className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{currentStop.actualArrivalTime || currentStop.stopArrivalTime ? 'Update Arrival' : 'Record Arrival'}</span>
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        setCustomArrivalTime(timeNow);
                        handleRecordArrival(currentStop.stopId, timeNow);
                      }}
                      disabled={savingArrival}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                    >
                      Mark Arrived Now
                    </button>
                    <div className="flex items-center gap-2 ml-auto">
                      {onOpenHistory && getSentParentNotifications(shift).length > 0 && (
                        <button
                          onClick={() => onOpenHistory(shift)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1.5 transition"
                          title="View dispatched parent delay alerts"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Sent Alerts ({getSentParentNotifications(shift).length})</span>
                        </button>
                      )}
                      {isToday && onOpenNotification && (
                        <button
                          onClick={() => onOpenNotification(shift, currentStop)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition"
                          title="Send delay or incident notification to parents"
                        >
                          <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Notify Parents</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assigned Students */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>Assigned Passengers ({currentStop.assignedStudents?.length || 0})</span>
                    </div>
                  </div>

                  {(!currentStop.assignedStudents || currentStop.assignedStudents.length === 0) ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-sm text-slate-400">
                      No student passengers assigned to this stop (School dropoff/pickup point).
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentStop.assignedStudents.map((st) => {
                        const isStudentBusy = updatingStudent === st.studentId;
                        const isPickedUp = st.status === 'picked_up' || st.isPresent === true;
                        const isAbsent = st.status === 'absent' || st.status === 'no_show' || st.isPresent === false;
                        const isDroppedOff = st.status === 'dropped_off';
                        const status = isPickedUp ? 'picked_up' : (isDroppedOff ? 'dropped_off' : (isAbsent ? 'absent' : (st.status || 'scheduled')));
                        const timeStr = st.pickupTime || st.boardedAt;
                        return (
                          <div
                            key={st.studentId}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-800/70 shadow-sm"
                          >
                            <div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {st.studentName}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {st.studentNo ? `#${st.studentNo} • ` : ''}{st.schoolName || currentStop.schoolName}
                              </div>
                              {st.absenceReason && isAbsent && (
                                <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5 flex items-center gap-1">
                                  <UserX className="w-3 h-3 shrink-0" />
                                  <span>Parent notified: {st.absenceReason}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Status Badge */}
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  status === 'picked_up'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                                    : status === 'dropped_off'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                    : status === 'absent' || status === 'no_show'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {status.toUpperCase()}
                                {isPickedUp && timeStr ? ` (${timeStr})` : ''}
                              </span>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleStudentStatus(currentStop.stopId, st.studentId, 'picked_up')}
                                  disabled={isStudentBusy}
                                  title="Mark Picked Up"
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 transition"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleStudentStatus(currentStop.stopId, st.studentId, 'dropped_off')}
                                  disabled={isStudentBusy}
                                  title="Mark Dropped Off"
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                {isAbsent ? (
                                  <button
                                    onClick={() => handleStudentStatus(currentStop.stopId, st.studentId, 'scheduled')}
                                    disabled={isStudentBusy}
                                    title="Restore to Scheduled / Undo Absent"
                                    className="p-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-slate-100 transition"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setAbsenceTarget({
                                        stopId: currentStop.stopId,
                                        studentId: st.studentId,
                                        studentName: st.studentName,
                                      });
                                    }}
                                    disabled={isStudentBusy}
                                    title="Mark Absent (Parent Notified)"
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-400">
                Select a stop from the left itinerary.
              </div>
            )}
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Student Absence Modal Dialog */}
      {absenceTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <UserX className="w-4 h-4" />
                <span>Mark Student Absent</span>
              </div>
              <button
                onClick={() => setAbsenceTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-white">
                {absenceTarget.studentName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Route {shift.routeNo} • {shift.dispatchDate}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Parent Stated Reason:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  'Illness / Sick',
                  'Doctor Appointment',
                  'Family Vacation',
                  'Parent Driving',
                  'Personal / Other',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setAbsencePreset(reason)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                      absencePreset === reason
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Optional detail (e.g. flu, dentist)..."
                value={absenceNote}
                onChange={(e) => setAbsenceNote(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50">
              <input
                type="checkbox"
                checked={applyToAllRuns}
                onChange={(e) => setApplyToAllRuns(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span>Also apply absence to other runs today (e.g. PM / AM)</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAbsenceTarget(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAbsence}
                onClick={handleConfirmAbsence}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                {savingAbsence ? 'Saving...' : 'Confirm Absent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
