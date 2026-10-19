import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  BellRing,
  Send,
  AlertTriangle,
  Wrench,
  Clock,
  CloudRain,
  Phone,
  Mail,
  Users,
  CheckCircle2,
  Check
} from 'lucide-react';
import {
  DispatchShift,
  DispatchShiftStop,
  DelayReasonCategory,
  ParentNotificationRecipient,
  SentParentNotificationRecord,
} from '../../types/dispatch';
import { Student } from '../../types/student';
import { DispatchService } from '../../services/dispatchService';
import { getCurrentHHmm } from '../../utils/dispatchDelayUtils';
import { useAuth } from '../../contexts/AuthContext';
import { logDispatchAction } from '../../utils/dispatchLogger';

interface ParentNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: DispatchShift | null;
  targetStopId?: number | null;
  studentsMap?: Record<number, Student>;
  onNotificationSent?: (updatedShift: DispatchShift) => void;
}

type RecipientScope = 'this_stop' | 'downstream' | 'all';

export const ParentNotificationModal: React.FC<ParentNotificationModalProps> = ({
  isOpen,
  onClose,
  shift,
  targetStopId,
  studentsMap = {},
  onNotificationSent,
}) => {
  const { currentUser } = useAuth();
  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  if (!isOpen || !shift) return null;

  const stops = Array.isArray(shift.stops) ? shift.stops : [];
  const initialStop = targetStopId ? stops.find((s) => s.stopId === targetStopId) || stops[0] : stops[0];

  const [scope, setScope] = useState<RecipientScope>(targetStopId ? 'this_stop' : 'all');
  const [selectedStopId, setSelectedStopId] = useState<number>(initialStop?.stopId || 0);
  const [reasonCategory, setReasonCategory] = useState<DelayReasonCategory>('traffic');
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [channels, setChannels] = useState<{ sms: boolean; email: boolean }>({ sms: true, email: true });
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isCustomEdited, setIsCustomEdited] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<Record<number, boolean>>({});
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const activeStop = stops.find((s) => s.stopId === selectedStopId) || stops[0];

  // Resolve students based on selected scope
  const targetStudents = useMemo(() => {
    if (!shift || stops.length === 0) return [];

    let relevantStops: DispatchShiftStop[] = [];
    if (scope === 'this_stop') {
      relevantStops = activeStop ? [activeStop] : stops;
    } else if (scope === 'downstream') {
      const activeIdx = stops.findIndex((s) => s.stopId === (activeStop?.stopId || 0));
      relevantStops = activeIdx >= 0 ? stops.slice(activeIdx) : stops;
    } else {
      relevantStops = stops;
    }

    // Collect unique students
    const map = new Map<number, { studentId: number; studentName: string; schoolName?: string }>();
    for (const st of relevantStops) {
      if (Array.isArray(st.assignedStudents)) {
        for (const s of st.assignedStudents) {
          if (!map.has(s.studentId)) {
            map.set(s.studentId, {
              studentId: s.studentId,
              studentName: s.studentName,
              schoolName: s.schoolName || st.schoolName,
            });
          }
        }
      }
    }

    return Array.from(map.values());
  }, [shift, stops, scope, activeStop]);

  // Build full recipient list with parent contact info
  const recipients: ParentNotificationRecipient[] = useMemo(() => {
    return targetStudents.map((ts) => {
      const masterStudent = studentsMap[ts.studentId];
      const primaryContact = masterStudent?.contacts?.find((c) => c.primaryContact) || masterStudent?.contacts?.[0];

      return {
        studentId: ts.studentId,
        studentName: ts.studentName,
        schoolName: ts.schoolName || masterStudent?.schoolName,
        contactName: primaryContact?.contactName || 'Parent / Guardian',
        relationship: primaryContact?.relationship || 'Parent',
        phone: primaryContact?.mobilePhone || masterStudent?.studentPhone || 'No Phone',
        email: primaryContact?.email || 'No Email',
        selected: selectedRecipients[ts.studentId] !== false,
      };
    });
  }, [targetStudents, studentsMap, selectedRecipients]);

  // Set default template text when reason or delay minutes change (unless dispatcher edited it manually)
  useEffect(() => {
    if (isCustomEdited) return;

    let reasonPhrase = 'traffic congestion and road slowdowns';
    if (reasonCategory === 'breakdown') {
      reasonPhrase = 'a vehicle mechanical issue. A technician or replacement vehicle is being coordinated';
    } else if (reasonCategory === 'weather') {
      reasonPhrase = 'severe weather and hazardous road conditions';
    } else if (reasonCategory === 'other') {
      reasonPhrase = 'an operational delay en route';
    }

    const text = `School Bus Delay Notice: Bus Route ${shift.routeNo} (${shift.shiftType}) is currently delayed by approximately ${delayMinutes} minutes due to ${reasonPhrase}. We apologize for any inconvenience and are working safely to complete the route. Thank you for your patience.`;
    setCustomMessage(text);
  }, [reasonCategory, delayMinutes, shift.routeNo, shift.shiftType, isCustomEdited]);

  const toggleRecipient = (studentId: number) => {
    setSelectedRecipients((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === false ? true : false,
    }));
  };

  const toggleSelectAll = (select: boolean) => {
    const updated: Record<number, boolean> = {};
    for (const r of recipients) {
      updated[r.studentId] = select;
    }
    setSelectedRecipients(updated);
  };

  const handleSendNotification = async () => {
    const chosenRecipients = recipients.filter((r) => r.selected);
    if (chosenRecipients.length === 0) {
      alert('Please select at least one recipient parent.');
      return;
    }

    try {
      setSending(true);

      const nowTime = getCurrentHHmm();
      const reasonLabel =
        reasonCategory === 'breakdown'
          ? 'Mechanical Breakdown'
          : reasonCategory === 'traffic'
          ? 'Traffic Congestion'
          : reasonCategory === 'weather'
          ? 'Weather Conditions'
          : 'Operational Delay';

      // Log an operational dispatch audit note onto the shift
      const notificationAudit = `[${nowTime} Parent Alert] Dispatched +${delayMinutes}m delay notification (${reasonLabel}) to ${chosenRecipients.length} parent(s).`;
      const updatedNotes = shift.notes
        ? `${shift.notes}\n${notificationAudit}`
        : notificationAudit;

      const activeChannels = (['sms', 'email'] as ('sms' | 'email')[]).filter((c) => channels[c]);
      const selectedStop = stops.find((s) => s.stopId === selectedStopId);

      const newRecord: SentParentNotificationRecord = {
        id: `notif_${Date.now()}`,
        timestamp: new Date().toISOString(),
        timeStr: nowTime,
        reasonCategory,
        reasonLabel,
        delayMinutes,
        messageText: customMessage,
        channels: activeChannels,
        recipientsCount: chosenRecipients.length,
        recipientsSummary: chosenRecipients
          .map((r) => `${r.studentName} (${r.contactName})`)
          .slice(0, 4)
          .join(', ') + (chosenRecipients.length > 4 ? ` +${chosenRecipients.length - 4} more` : ''),
        scope,
        stopId: selectedStop?.stopId,
        stopSequence: selectedStop?.sequence,
        stopLocation: selectedStop?.stopLocation,
        recipients: chosenRecipients.map((r) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          contactName: r.contactName,
          relationship: r.relationship,
          phone: r.phone,
          email: r.email,
        })),
      };

      const existingNotifications = Array.isArray(shift.parentNotifications)
        ? shift.parentNotifications
        : [];
      const updatedNotifications = [...existingNotifications, newRecord];

      const updatedShift = await DispatchService.updateShift(shift.id, {
        parentNotifications: updatedNotifications,
        notes: updatedNotes,
      });

      const channelsList: string[] = [];
      if (channels.sms) channelsList.push('SMS');
      if (channels.email) channelsList.push('Email');
      await logDispatchAction({
        date: shift.dispatchDate,
        type: 'Parent Notification',
        detail: `Sent delay alert (${delayMinutes} min delay, ${reasonLabel}) to ${chosenRecipients.length} parents via ${channelsList.join('/')}`,
        shift,
        user: actorName,
      });

      setSendSuccess(true);
      if (onNotificationSent) {
        onNotificationSent(updatedShift);
      }

      setTimeout(() => {
        setSendSuccess(false);
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Failed to send parent delay notification:', err);
      alert('Failed to send notification: ' + (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const activeRecipientsCount = recipients.filter((r) => r.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Notify Parents of Delay
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Route {shift.routeNo} • {shift.shiftType} ({shift.dispatchDate})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Reason Category Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Reason for Delay
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setReasonCategory('breakdown');
                  setIsCustomEdited(false);
                }}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition ${
                  reasonCategory === 'breakdown'
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Wrench className="w-4 h-4 text-rose-500" />
                  {reasonCategory === 'breakdown' && <Check className="w-3.5 h-3.5 text-rose-600" />}
                </div>
                <div className="text-xs font-bold">Vehicle Breakdown</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Mechanical failure / relief bus
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReasonCategory('traffic');
                  setIsCustomEdited(false);
                }}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition ${
                  reasonCategory === 'traffic'
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  {reasonCategory === 'traffic' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                </div>
                <div className="text-xs font-bold">Traffic Congestion</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Heavy traffic or detour
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReasonCategory('weather');
                  setIsCustomEdited(false);
                }}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition ${
                  reasonCategory === 'weather'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CloudRain className="w-4 h-4 text-blue-500" />
                  {reasonCategory === 'weather' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="text-xs font-bold">Weather Delay</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Snow, ice or visibility
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReasonCategory('other');
                  setIsCustomEdited(false);
                }}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition ${
                  reasonCategory === 'other'
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Clock className="w-4 h-4 text-purple-500" />
                  {reasonCategory === 'other' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                </div>
                <div className="text-xs font-bold">General Delay</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Operational adjustment
                </div>
              </button>
            </div>
          </div>

          {/* Delay Duration Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Estimated Delay Duration
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[10, 15, 20, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setDelayMinutes(mins);
                    setIsCustomEdited(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    delayMinutes === mins
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  +{mins} mins
                </button>
              ))}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-slate-500">Custom:</span>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={delayMinutes}
                  onChange={(e) => {
                    setDelayMinutes(parseInt(e.target.value, 10) || 0);
                    setIsCustomEdited(false);
                  }}
                  className="w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-center text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-500">mins</span>
              </div>
            </div>
          </div>

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Recipient Scope
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setScope('this_stop')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                  scope === 'this_stop'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                This Stop Only
              </button>
              <button
                type="button"
                onClick={() => setScope('downstream')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                  scope === 'downstream'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Downstream Stops
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                  scope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Route Students
              </button>
            </div>

            {/* Target Stop Dropdown if scope is this_stop or downstream */}
            {scope !== 'all' && stops.length > 0 && (
              <div className="mt-2.5">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Active Reference Stop
                </label>
                <select
                  value={selectedStopId}
                  onChange={(e) => setSelectedStopId(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  {stops.map((st) => (
                    <option key={st.stopId} value={st.stopId}>
                      Stop #{st.sequence}: {st.stopLocation} ({st.stopScheduleTime})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Editable Live Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Notification Message Preview (Editable)
              </label>
              <span className="text-[11px] text-slate-400">
                {customMessage.length} characters
              </span>
            </div>
            <textarea
              rows={3}
              value={customMessage}
              onChange={(e) => {
                setCustomMessage(e.target.value);
                setIsCustomEdited(true);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Channel Selection & Recipient Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.sms}
                  onChange={(e) => setChannels((prev) => ({ ...prev, sms: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                <span>SMS Alert</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.email}
                  onChange={(e) => setChannels((prev) => ({ ...prev, email: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Email Notice</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Selected: <strong>{activeRecipientsCount}</strong> of {recipients.length} parents
              </span>
              <button
                type="button"
                onClick={() => toggleSelectAll(activeRecipientsCount < recipients.length)}
                className="text-[11px] font-semibold text-amber-600 hover:underline"
              >
                {activeRecipientsCount < recipients.length ? 'Select All' : 'Deselect All'}
              </button>
            </div>
          </div>

          {/* Recipients List */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Target Parents & Guardians</span>
            </label>

            {recipients.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                No students assigned to the selected scope.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                {recipients.map((r) => (
                  <div
                    key={r.studentId}
                    onClick={() => toggleRecipient(r.studentId)}
                    className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {r.studentName}
                          <span className="font-normal text-slate-400 ml-1.5 text-[11px]">({r.contactName} • {r.relationship})</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {r.schoolName || 'School'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 font-mono shrink-0">
                      <div>{r.phone}</div>
                      <div className="text-[10px] text-slate-400">{r.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="text-xs text-slate-500">
            {sendSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Notification dispatched successfully!
              </span>
            ) : (
              <span>Ready to broadcast to {activeRecipientsCount} parents</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendNotification}
              disabled={sending || activeRecipientsCount === 0 || (!channels.sms && !channels.email)}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Broadcasting...' : `Send Notification (${activeRecipientsCount})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
