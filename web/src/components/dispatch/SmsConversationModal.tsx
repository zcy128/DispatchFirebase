import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Send,
  Phone,
  RefreshCw,
  CheckCircle2,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { SmsService } from '../../services/smsService';
import type { SMSMessage } from '../../types/sms';
import type { DispatchShift } from '../../types/dispatch';

interface SmsConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientPhone: string;
  recipientName: string;
  recipientRole?: 'driver' | 'attendant' | 'parent' | 'other';
  shift?: DispatchShift | null;
  selectedDate: string;
}

export const SmsConversationModal: React.FC<SmsConversationModalProps> = ({
  isOpen,
  onClose,
  recipientPhone,
  recipientName,
  recipientRole = 'driver',
  shift,
  selectedDate,
}) => {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [messageText, setMessageText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = useCallback(async () => {
    if (!recipientPhone) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const history = await SmsService.getDailyHistory(recipientPhone, selectedDate);
      setMessages(history);
    } catch (err) {
      console.error('[SMS] Failed to fetch SMS history:', err);
      setErrorMsg('Failed to load SMS history. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [recipientPhone, selectedDate]);

  useEffect(() => {
    if (isOpen) {
      setMessageText('');
      setErrorMsg(null);
      setSuccessBanner(null);
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Periodic polling every 12 seconds when the window is open to detect incoming Twilio SMS replies
  useEffect(() => {
    if (!isOpen || !recipientPhone) return;
    const interval = setInterval(() => {
      SmsService.getDailyHistory(recipientPhone, selectedDate)
        .then((latest) => {
          if (Array.isArray(latest)) {
            setMessages((prev) => {
              if (latest.length !== prev.length) {
                return latest;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 12000);
    return () => clearInterval(interval);
  }, [isOpen, recipientPhone, selectedDate]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || !recipientPhone || sending) return;

    try {
      setSending(true);
      setErrorMsg(null);
      setSuccessBanner(null);

      const record = await SmsService.sendSMS({
        toPhone: recipientPhone,
        message: trimmed,
        recipientName,
        shiftId: shift?.id,
        routeNo: shift?.routeNo,
      });

      // Optimistically append the new outbound SMS
      setMessages((prev) => [...prev, record]);
      setMessageText('');
      setSuccessBanner('SMS dispatched successfully via Twilio Gateway.');
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      console.error('[SMS] Send error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  // Character and SMS segment calculation
  const charCount = messageText.length;
  const segments = charCount === 0 ? 0 : Math.ceil(charCount / 160);

  const applyTemplate = (templateText: string) => {
    setMessageText(templateText);
  };

  const routeNo = shift?.routeNo || 'your route';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  SMS with {recipientName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                  {recipientRole}
                </span>
                {shift && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    Route {shift.routeNo} ({shift.shiftType})
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{recipientPhone}</span>
                <span>•</span>
                <span>Date: {selectedDate}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Twilio Gateway
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchHistory}
              disabled={loading}
              title="Refresh messages"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success or Error Banner */}
        {successBanner && (
          <div className="px-5 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}
        {errorMsg && (
          <div className="px-5 py-2 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2 animate-in fade-in">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Message Log / Timeline for Today */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/50 dark:bg-slate-900/50 min-h-[220px] max-h-[46vh]">
          {loading && messages.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
              <p className="text-xs font-medium">Loading today&apos;s SMS records from Twilio Gateway...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center text-slate-400 max-w-sm mx-auto">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No SMS Exchange Recorded for Today
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Outbound messages sent via Twilio and incoming replies from <strong>{recipientPhone}</strong> will be logged here in real time.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOutbound = msg.direction === 'outbound';
              const timeDisplay = msg.createdAt
                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                    {isOutbound ? (
                      <>
                        <ArrowUpRight className="w-3 h-3 text-blue-500" />
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {msg.senderName || 'Dispatcher'}
                        </span>
                        <span>•</span>
                        <span>{timeDisplay}</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {recipientName}
                        </span>
                        <span>•</span>
                        <span>{timeDisplay}</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs leading-relaxed ${
                      isOutbound
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>

                  {isOutbound && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 px-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-blue-500" />
                      <span className="capitalize">{msg.status || 'sent'}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Template Selector */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Templates:</span>
          </span>
          <button
            type="button"
            onClick={() =>
              applyTemplate(
                `Hi ${recipientName}, dispatch reminder: please check in for Route ${routeNo} as soon as you arrive.`
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-900 transition shrink-0 font-medium"
          >
            Check-In Reminder
          </button>
          <button
            type="button"
            onClick={() =>
              applyTemplate(
                `Dispatch Notice: Route ${routeNo} has an advisory delay recorded. Please proceed safely and report updates.`
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-900 transition shrink-0 font-medium"
          >
            Delay Notice
          </button>
          <button
            type="button"
            onClick={() =>
              applyTemplate(
                `URGENT: Please call the Dispatch office as soon as you have safely stopped the vehicle.`
              )
            }
            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 transition shrink-0 font-medium"
          >
            Urgent Callback
          </button>
          <button
            type="button"
            onClick={() =>
              applyTemplate(
                `Reminder: Please complete your mandatory pre-trip commercial vehicle inspection before departure.`
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-900 transition shrink-0 font-medium"
          >
            Pre-Trip Inspection
          </button>
        </div>

        {/* Composer Form */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
          <div>
            <textarea
              rows={3}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`Type SMS message to ${recipientName} (${recipientPhone})...`}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none shadow-2xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <span>
                {charCount} / 160 chars {segments > 0 ? `(${segments} segment${segments > 1 ? 's' : ''})` : ''}
              </span>
              <a
                href={`sms:${recipientPhone}`}
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-sans font-semibold"
                title="Open system default SMS app on your device"
              >
                <span>Native SMS</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send SMS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
