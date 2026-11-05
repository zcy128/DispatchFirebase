import { useState } from 'react';
import { Receipt, Save, X } from 'lucide-react';
import {
  PayrollDepartmentLogRecord,
  UpdatePayrollDepartmentLogPayload,
} from '../../types/dispatch';
import { DispatchService } from '../../services/dispatchService';
import { logDispatchAction } from '../../utils/dispatchLogger';

interface PayrollDeptLogEditModalProps {
  log: PayrollDepartmentLogRecord;
  actorName: string;
  onClose: () => void;
  onUpdated: (updated: PayrollDepartmentLogRecord) => void;
}

export function PayrollDeptLogEditModal({
  log,
  actorName,
  onClose,
  onUpdated,
}: PayrollDeptLogEditModalProps) {
  const [payAmount, setPayAmount] = useState(log.payAmount);
  const [eiHours, setEiHours] = useState(log.eiHours);
  const [payrollNotes, setPayrollNotes] = useState(log.payrollNotes || '');
  const [status, setStatus] = useState(log.status || 'approved');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: UpdatePayrollDepartmentLogPayload = {
        payAmount: Number(payAmount),
        eiHours: Number(eiHours),
        payrollNotes,
        status,
        updatedBy: actorName,
      };
      const updated = await DispatchService.updatePayrollDepartmentLog(log.id, payload);
      onUpdated(updated);

      const changes: string[] = [];
      if (log.payAmount !== Number(payAmount)) {
        changes.push(`Pay: $${log.payAmount.toFixed(2)} -> $${Number(payAmount).toFixed(2)}`);
      }
      if (log.eiHours !== Number(eiHours)) {
        changes.push(`EI: ${log.eiHours}h -> ${Number(eiHours)}h`);
      }
      if ((log.status || 'approved') !== status) {
        changes.push(`Status: ${log.status || 'approved'} -> ${status}`);
      }
      if ((log.payrollNotes || '') !== payrollNotes) {
        changes.push(`Notes: "${payrollNotes}"`);
      }
      const detailStr =
        changes.length > 0
          ? `Finance adjusted payroll log for ${log.employeeName} (${log.role}): [${changes.join(', ')}]`
          : `Finance updated payroll log for ${log.employeeName} (${log.role})`;

      void logDispatchAction({
        date: log.dispatchDate,
        type: 'Payroll Log Modified',
        detail: detailStr,
        shift: { id: log.shiftId, routeNo: log.routeNo, shiftType: log.shiftType },
        user: actorName,
      });

      onClose();
    } catch (err) {
      console.error('Failed to update payroll log:', err);
      alert('Failed to update record: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:divide-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">
              Edit Payroll Record ({log.employeeName})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>
                Route: <strong>{log.routeNo}</strong> ({log.shiftType})
              </span>
              <span>
                Role: <strong className="capitalize">{log.role}</strong>
              </span>
            </div>
            <div className="flex justify-between">
              <span>
                Unit #: <strong>{log.unitNumber || '-'}</strong>
              </span>
              <span>
                Original Dispatch Rate: <strong>${log.originalPayRate.toFixed(2)}</strong>
              </span>
            </div>
            {log.dispatcherComments && (
              <div className="pt-1 text-slate-500">
                Dispatch Comments: <em>{log.dispatcherComments}</em>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Adjusted Pay Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Insurable EI Hours
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={eiHours}
              onChange={(e) => setEiHours(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payroll Processing Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden"
            >
              <option value="approved">Approved (Ready for Processing)</option>
              <option value="processed">Processed</option>
              <option value="paid">Paid</option>
              <option value="on_hold">On Hold</option>
              <option value="pending_review">Pending Review</option>
              <option value="draft">Draft</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Finance / Payroll Department Internal Notes
            </label>
            <textarea
              rows={3}
              value={payrollNotes}
              onChange={(e) => setPayrollNotes(e.target.value)}
              placeholder="e.g. Rate adjusted per HR memo, verified GPS check-out time..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/75 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
