import React, { useState } from 'react';
import { Clock, LogOut, MessageSquare } from 'lucide-react';
import { DispatchShift } from '../../types/dispatch';

export interface CrewCheckOutModalState {
  isOpen: boolean;
  shift: DispatchShift;
  role: 'driver' | 'attendant';
  checkOutTime: string;
  comments: string;
}

interface CrewCheckOutModalProps {
  data: CrewCheckOutModalState | null;
  onClose: () => void;
  onConfirm: (
    shift: DispatchShift,
    role: 'driver' | 'attendant',
    undo: boolean,
    checkOutTime?: string,
    comments?: string
  ) => void;
}

export const CrewCheckOutModal: React.FC<CrewCheckOutModalProps> = React.memo(({
  data,
  onClose,
  onConfirm,
}) => {
  if (!data || !data.isOpen) return null;

  return (
    <CrewCheckOutModalContent
      data={data}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
});

CrewCheckOutModal.displayName = 'CrewCheckOutModal';

const CrewCheckOutModalContent: React.FC<{
  data: CrewCheckOutModalState;
  onClose: () => void;
  onConfirm: CrewCheckOutModalProps['onConfirm'];
}> = ({ data, onClose, onConfirm }) => {
  const [checkOutTime, setCheckOutTime] = useState(data.checkOutTime);
  const [comments, setComments] = useState(data.comments);

  const roleName = data.role === 'driver' ? 'Driver' : 'Attendant';
  const personName =
    data.role === 'driver'
      ? data.shift.driverName || 'Driver'
      : data.shift.attendantName || 'Attendant';

  const handleConfirm = () => {
    onClose();
    onConfirm(
      data.shift,
      data.role,
      false,
      checkOutTime,
      comments.trim() || undefined
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                Check Out {roleName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {personName} • Route {data.shift.routeNo}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-500" />
              <span>Check-Out Time</span>
            </label>
            <input
              type="time"
              value={checkOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
              <span>Payroll Comments (Optional)</span>
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Leave empty for standard check-out without issues..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-900 dark:text-purple-200 space-y-1">
            <p className="font-semibold">Workflow Rule:</p>
            <p>
              • <strong>Without comments:</strong> Automatically approved and immediately synced to Finance Department Payroll Log.
            </p>
            <p>
              • <strong>With comments:</strong> Held as Pending Approval for dispatcher review before syncing to Finance.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Confirm Check-Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
