import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, ShieldCheck, User, MessageSquare, AlertCircle, Bell, Mail } from 'lucide-react';
import { TimeOffRequest, LEAVE_TYPE_LABELS, ReviewTimeOffRequestPayload, TimeOffNotificationSettings, DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS } from '../../types/timeOff';
import { Employee } from '../../types/employee';
import { TimeOffService } from '../../services/timeOffService';
import { useAuth } from '../../contexts/AuthContext';
import { safeFormatDate } from '../../utils/dateUtils';
import { logDispatchAction } from '../../utils/dispatchLogger';
import { OperationalSafetyLogService } from '../../services/operationalSafetyLogService';

interface TimeOffReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TimeOffRequest | null;
  employees?: Employee[];
  onDecisionCompleted: () => void;
}

export const TimeOffReviewModal: React.FC<TimeOffReviewModalProps> = ({
  isOpen,
  onClose,
  request,
  employees = [],
  onDecisionCompleted
}) => {
  const { currentUser } = useAuth();
  const [approvalNotes, setApprovalNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [settings, setSettings] = useState<TimeOffNotificationSettings>(DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApprovalNotes('');
      setError(null);
      TimeOffService.getNotificationSettings()
        .then((s) => {
          setSettings(s);
          // Default to approval settings initially
          setSendEmail(s.notifyOnApprovalEmail);
          setSendSms(s.notifyOnApprovalSms);
        })
        .catch(() => {
          setSettings(DEFAULT_TIMEOFF_NOTIFICATION_SETTINGS);
          setSendEmail(true);
          setSendSms(true);
        });
    }
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const actorId = currentUser?.uid || 'HR-ADMIN';
  const actorName = currentUser?.displayName || currentUser?.email || 'HR Administrator';

  const applicantEmployee = employees.find(
    (e) => e.id === request.employeeId || e.employeeNumber === request.employeeNumber
  );
  const applicantEmail =
    applicantEmployee?.preferredEmail ||
    applicantEmployee?.workEmail ||
    applicantEmployee?.personalEmail ||
    '';
  const applicantPhone =
    applicantEmployee?.preferredPhone ||
    applicantEmployee?.mobilePhone ||
    applicantEmployee?.homePhone ||
    '';

  const handleDecision = async (decision: 'approve' | 'reject') => {
    setSaving(true);
    setError(null);
    try {
      const notifiedChannels: ('email' | 'sms')[] = [];
      if (sendEmail) notifiedChannels.push('email');
      if (sendSms) notifiedChannels.push('sms');

      const payload: ReviewTimeOffRequestPayload = {
        reviewerUserId: actorId,
        reviewerName: actorName,
        approvalNotes: approvalNotes.trim(),
        notifiedChannels: notifiedChannels.length > 0 ? notifiedChannels : undefined
      };

      if (decision === 'approve') {
        await TimeOffService.approveTimeOffRequest(request.id, payload);
      } else {
        await TimeOffService.rejectTimeOffRequest(request.id, payload);
      }

      await logDispatchAction({
        date: request.startDate,
        type: 'Time Off Review',
        detail: `${decision === 'approve' ? 'Approved' : 'Rejected'} leave request for ${request.employeeName} (${request.startDate} to ${request.endDate})${
          notifiedChannels.length > 0 ? ` [Notified via ${notifiedChannels.join('/')}]` : ''
        }`,
        user: actorName,
      });

      await OperationalSafetyLogService.logOperation({
        module: 'time_off',
        action: decision === 'approve' ? 'approve' : 'reject',
        targetId: request.id,
        targetIdentifier: request.id,
        targetTitle: `${request.employeeName} (${request.leaveType || 'Leave'})`,
        status: decision === 'approve' ? 'approved' : 'rejected',
        summary: `${actorName} ${decision === 'approve' ? 'approved' : 'rejected'} time-off for ${request.employeeName} (${request.startDate} to ${request.endDate}). Type: ${request.leaveType || 'General'}.${approvalNotes.trim() ? ` Notes: "${approvalNotes.trim()}"` : ''}`,
        actor: {
          userId: actorId,
          userName: actorName,
          userEmail: currentUser?.email,
          userRole: currentUser?.role || 'HR',
        },
        diffs: [
          {
            field: 'status',
            fieldLabel: 'Request Status',
            oldValue: request.status,
            newValue: decision === 'approve' ? 'approved' : 'rejected',
          },
          ...(approvalNotes.trim() ? [{
            field: 'approvalNotes',
            fieldLabel: 'Reviewer Notes',
            oldValue: request.approvalNotes || null,
            newValue: approvalNotes.trim(),
          }] : []),
        ],
      });

      onDecisionCompleted();
      onClose();
    } catch (err: any) {
      console.error(`Failed to ${decision} request:`, err);
      setError(err?.message || `Failed to ${decision} request. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-xl flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">HR Leave Request Review</h2>
              <p className="text-xs text-slate-400">
                Review and make approval decisions on employee time-off requests
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2.5 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Request Summary Card */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-white text-sm">
                  {request.employeeName}
                </span>
                {request.employeeNumber && (
                  <span className="text-xs text-slate-400">({request.employeeNumber})</span>
                )}
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-slate-500 block">Dates Requested:</span>
                <span className="font-mono text-slate-200">
                  {request.startDate} → {request.endDate}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Shift Coverage:</span>
                <span className="font-medium text-slate-200">{request.shiftType}</span>
              </div>
            </div>

            {request.comments && (
              <div className="pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-slate-500 block mb-1">Employee Comments:</span>
                <p className="text-slate-300 italic bg-slate-800/60 p-2.5 rounded border border-slate-700/50">
                  "{request.comments}"
                </p>
              </div>
            )}

            <div className="text-[11px] text-slate-500 pt-1">
              Submitted by {request.requestedByName || 'Employee'} on {safeFormatDate(request.createdAt)}
            </div>
          </div>

          {/* Applicant Notification Alerts */}
          <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Notify Applicant Upon Decision</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Defaulted from configuration
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 w-4 h-4"
                />
                <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="text-xs min-w-0">
                  <div className="text-slate-200 font-medium">Send Email</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {applicantEmail || 'Registered email address'}
                  </div>
                </div>
              </label>

              <label className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
                <input
                  type="checkbox"
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 w-4 h-4"
                />
                <MessageSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="text-xs min-w-0">
                  <div className="text-slate-200 font-medium">Send SMS</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {applicantPhone || 'Registered mobile phone'}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Decision Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center space-x-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>HR Decision Notes / Reason</span>
            </label>
            <textarea
              rows={3}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="e.g., Approved based on standard vacation allowance. Replacement driver arranged."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  // If user hasn't explicitly customized, verify rejection preferences
                  if (sendEmail !== settings.notifyOnRejectionEmail) {
                    setSendEmail(settings.notifyOnRejectionEmail);
                  }
                  if (sendSms !== settings.notifyOnRejectionSms) {
                    setSendSms(settings.notifyOnRejectionSms);
                  }
                  handleDecision('reject');
                }}
                className="px-4 py-2 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 font-semibold text-sm rounded-lg flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleDecision('approve')}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg flex items-center space-x-1.5 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? 'Processing...' : 'Approve Request'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
