import React, { useState } from 'react';
import {
  X,
  BellRing,
  Clock,
  Wrench,
  AlertTriangle,
  CloudRain,
  Phone,
  Mail,
  Users,
  ChevronDown,
  ChevronUp,
  MapPin,
  Send,
  Calendar
} from 'lucide-react';
import { DispatchShift, SentParentNotificationRecord } from '../../types/dispatch';
import { getSentParentNotifications } from '../../utils/dispatchDelayUtils';

interface ParentNotificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: DispatchShift | null;
  onOpenSendNewAlert?: (shift: DispatchShift) => void;
  isToday?: boolean;
}

export const ParentNotificationHistoryModal: React.FC<ParentNotificationHistoryModalProps> = ({
  isOpen,
  onClose,
  shift,
  onOpenSendNewAlert,
  isToday,
}) => {
  const [expandedRecipients, setExpandedRecipients] = useState<Record<string, boolean>>({});

  if (!isOpen || !shift) return null;

  const notifications: SentParentNotificationRecord[] = getSentParentNotifications(shift);
  // Sort reverse chronological (newest first)
  const sortedNotifications = [...notifications].reverse();

  const toggleExpand = (id: string) => {
    setExpandedRecipients((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getReasonIcon = (category: string) => {
    switch (category) {
      case 'breakdown':
        return <Wrench className="w-4 h-4 text-rose-500" />;
      case 'traffic':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'weather':
        return <CloudRain className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-purple-500" />;
    }
  };

  const getReasonBadgeClass = (category: string) => {
    switch (category) {
      case 'breakdown':
        return 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800';
      case 'traffic':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800';
      case 'weather':
        return 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800';
      default:
        return 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Dispatched Parent Alerts
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                  {notifications.length} {notifications.length === 1 ? 'alert' : 'alerts'}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                  Route {shift.routeNo}
                </span>
                <span>•</span>
                <span>{shift.shiftType} Shift</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {shift.dispatchDate}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sortedNotifications.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <BellRing className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No alerts dispatched yet
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Parent delay notifications sent for this shift will appear here.
              </div>
            </div>
          ) : (
            sortedNotifications.map((notif, index) => {
              const isExpanded = !!expandedRecipients[notif.id];
              const recipientsList = notif.recipients || [];

              return (
                <div
                  key={notif.id || index}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-3 transition"
                >
                  {/* Top Meta Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getReasonBadgeClass(
                          notif.reasonCategory
                        )}`}
                      >
                        {getReasonIcon(notif.reasonCategory)}
                        <span>{notif.reasonLabel}</span>
                      </span>

                      {notif.delayMinutes > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                          +{notif.delayMinutes}m delay
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {notif.scope === 'this_stop'
                          ? `Stop #${notif.stopSequence || notif.stopId || ''}`
                          : notif.scope === 'downstream'
                          ? 'Downstream Stops'
                          : 'All Route Students'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        {notif.timeStr}
                      </span>
                      {notif.timestamp && notif.timestamp.length > 10 && (
                        <span className="text-[10px] text-slate-400">
                          ({notif.timestamp.slice(0, 10)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stop Location Context if available */}
                  {notif.stopLocation && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">Reference Location: <strong>{notif.stopLocation}</strong></span>
                    </div>
                  )}

                  {/* Dispatched Message Content */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                      Dispatched Message Body
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {notif.messageText}
                    </div>
                  </div>

                  {/* Channels & Recipients Summary */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>
                          Broadcast to <strong>{notif.recipientsCount}</strong> parent(s)
                        </span>
                      </div>

                      {notif.channels && notif.channels.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {notif.channels.includes('sms') && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <Phone className="w-2.5 h-2.5" /> SMS
                            </span>
                          )}
                          {notif.channels.includes('email') && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                              <Mail className="w-2.5 h-2.5" /> Email
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {recipientsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(notif.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <span>{isExpanded ? 'Hide Recipients' : 'View Recipients'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Expanded Recipients Details */}
                  {isExpanded && recipientsList.length > 0 && (
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-2">
                      {recipientsList.map((r, rIdx) => (
                        <div
                          key={r.studentId || rIdx}
                          className="p-2 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {r.studentName}
                            </span>
                            <span className="text-slate-400 ml-1.5 text-[11px]">
                              ({r.contactName} • {r.relationship || 'Guardian'})
                            </span>
                          </div>
                          <div className="text-right text-[11px] text-slate-500 font-mono">
                            {r.phone && <div>{r.phone}</div>}
                            {r.email && <div className="text-[10px] text-slate-400">{r.email}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="text-xs text-slate-500">
            {notifications.length > 0 ? (
              <span>Last broadcast recorded at {sortedNotifications[0]?.timeStr}</span>
            ) : (
              <span>No notifications dispatched</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isToday && onOpenSendNewAlert && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSendNewAlert(shift);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Another Alert</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
