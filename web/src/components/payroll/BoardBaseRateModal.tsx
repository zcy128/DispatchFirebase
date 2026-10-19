import React, { useState, useEffect } from 'react';
import { X, Building2, Save, AlertCircle } from 'lucide-react';
import { SchoolBoardBaseRatesDTO, BusRoutePayrollRate } from '../../types/payroll';

interface BoardBaseRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardDTO: SchoolBoardBaseRatesDTO | null;
  onSaveRate: (rate: Partial<BusRoutePayrollRate>) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const BoardBaseRateModal: React.FC<BoardBaseRateModalProps> = ({
  isOpen,
  onClose,
  boardDTO,
  onSaveRate,
  onRefresh,
}) => {
  const [driverAmPay, setDriverAmPay] = useState<string>('');
  const [driverAmEi, setDriverAmEi] = useState<string>('');
  const [driverMidPay, setDriverMidPay] = useState<string>('');
  const [driverMidEi, setDriverMidEi] = useState<string>('');
  const [driverPmPay, setDriverPmPay] = useState<string>('');
  const [driverPmEi, setDriverPmEi] = useState<string>('');

  const [attAmPay, setAttAmPay] = useState<string>('');
  const [attAmEi, setAttAmEi] = useState<string>('');
  const [attMidPay, setAttMidPay] = useState<string>('');
  const [attMidEi, setAttMidEi] = useState<string>('');
  const [attPmPay, setAttPmPay] = useState<string>('');
  const [attPmEi, setAttPmEi] = useState<string>('');

  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (boardDTO) {
      setDriverAmPay(boardDTO.driver.am.payRate !== undefined ? String(boardDTO.driver.am.payRate) : '42.50');
      setDriverAmEi(boardDTO.driver.am.eiHours !== undefined ? String(boardDTO.driver.am.eiHours) : '2.50');
      setDriverMidPay(boardDTO.driver.midday.payRate !== undefined ? String(boardDTO.driver.midday.payRate) : '38.00');
      setDriverMidEi(boardDTO.driver.midday.eiHours !== undefined ? String(boardDTO.driver.midday.eiHours) : '2.00');
      setDriverPmPay(boardDTO.driver.pm.payRate !== undefined ? String(boardDTO.driver.pm.payRate) : '42.50');
      setDriverPmEi(boardDTO.driver.pm.eiHours !== undefined ? String(boardDTO.driver.pm.eiHours) : '2.50');

      setAttAmPay(boardDTO.attendant.am.payRate !== undefined ? String(boardDTO.attendant.am.payRate) : '28.00');
      setAttAmEi(boardDTO.attendant.am.eiHours !== undefined ? String(boardDTO.attendant.am.eiHours) : '2.50');
      setAttMidPay(boardDTO.attendant.midday.payRate !== undefined ? String(boardDTO.attendant.midday.payRate) : '25.00');
      setAttMidEi(boardDTO.attendant.midday.eiHours !== undefined ? String(boardDTO.attendant.midday.eiHours) : '2.00');
      setAttPmPay(boardDTO.attendant.pm.payRate !== undefined ? String(boardDTO.attendant.pm.payRate) : '28.00');
      setAttPmEi(boardDTO.attendant.pm.eiHours !== undefined ? String(boardDTO.attendant.pm.eiHours) : '2.50');

      setEffectiveDate(boardDTO.driver.am.effectiveDate || new Date().toISOString().split('T')[0]);
    }
    setErrorMsg(null);
  }, [boardDTO, isOpen]);

  if (!isOpen || !boardDTO) return null;

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const itemsToSave: Array<{
        existingId?: string;
        jobTitle: 'driver' | 'attendant';
        shiftType: 'AM' | 'MIDDAY' | 'PM';
        payRate: string;
        eiHours: string;
      }> = [
        {
          existingId: boardDTO.driver.am.rateId,
          jobTitle: 'driver',
          shiftType: 'AM',
          payRate: driverAmPay,
          eiHours: driverAmEi,
        },
        {
          existingId: boardDTO.driver.midday.rateId,
          jobTitle: 'driver',
          shiftType: 'MIDDAY',
          payRate: driverMidPay,
          eiHours: driverMidEi,
        },
        {
          existingId: boardDTO.driver.pm.rateId,
          jobTitle: 'driver',
          shiftType: 'PM',
          payRate: driverPmPay,
          eiHours: driverPmEi,
        },
        {
          existingId: boardDTO.attendant.am.rateId,
          jobTitle: 'attendant',
          shiftType: 'AM',
          payRate: attAmPay,
          eiHours: attAmEi,
        },
        {
          existingId: boardDTO.attendant.midday.rateId,
          jobTitle: 'attendant',
          shiftType: 'MIDDAY',
          payRate: attMidPay,
          eiHours: attMidEi,
        },
        {
          existingId: boardDTO.attendant.pm.rateId,
          jobTitle: 'attendant',
          shiftType: 'PM',
          payRate: attPmPay,
          eiHours: attPmEi,
        },
      ];

      for (const item of itemsToSave) {
        const pay = parseFloat(item.payRate);
        const ei = parseFloat(item.eiHours);
        if (isNaN(pay) || isNaN(ei)) continue;

        const ratePayload: Partial<BusRoutePayrollRate> = {
          id: item.existingId,
          schoolBoardId: boardDTO.schoolBoardId,
          schoolBoardName: boardDTO.schoolBoardName,
          schoolBoardCode: boardDTO.schoolBoardCode,
          jobTitle: item.jobTitle,
          shiftType: item.shiftType,
          payRate: pay,
          eiHours: ei,
          effectiveDate,
          weekDays: 'Weekdays',
        };

        await onSaveRate(ratePayload);
      }

      await onRefresh();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update board base rates.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Base Rates: {boardDTO.schoolBoardName} ({boardDTO.schoolBoardCode})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure baseline pay rates and EI hours per shift type for Drivers and Attendants.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSaveAll} className="overflow-y-auto p-6 space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Effective Date */}
          <div className="w-full max-w-xs">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Effective Date *
            </label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Driver Section */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Driver Base Rates
              </h4>
              <span className="text-xs text-slate-500">Applies to all routes under this board unless overridden</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Driver AM */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">AM Shift</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Pay Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={driverAmPay}
                    onChange={(e) => setDriverAmPay(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">EI Hours (hrs)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={driverAmEi}
                    onChange={(e) => setDriverAmEi(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Driver Midday */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">MIDDAY / NOON Shift</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Pay Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={driverMidPay}
                    onChange={(e) => setDriverMidPay(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">EI Hours (hrs)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={driverMidEi}
                    onChange={(e) => setDriverMidEi(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Driver PM */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">PM Shift</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Pay Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={driverPmPay}
                    onChange={(e) => setDriverPmPay(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">EI Hours (hrs)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={driverPmEi}
                    onChange={(e) => setDriverPmEi(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Attendant Section */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                Attendant Base Rates
              </h4>
              <span className="text-xs text-slate-500">Applies to attendants assigned under this school board</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Attendant AM */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">AM Shift</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Pay Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={attAmPay}
                    onChange={(e) => setAttAmPay(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">EI Hours (hrs)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={attAmEi}
                    onChange={(e) => setAttAmEi(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Attendant Midday */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">MIDDAY / NOON Shift</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Pay Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={attMidPay}
                    onChange={(e) => setAttMidPay(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">EI Hours (hrs)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={attMidEi}
                    onChange={(e) => setAttMidEi(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Attendant PM */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">PM Shift</span>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">Pay Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={attPmPay}
                    onChange={(e) => setAttPmPay(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">EI Hours (hrs)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={attPmEi}
                    onChange={(e) => setAttPmEi(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-400 focus:outline-none transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving All...' : 'Save Base Rates'}
          </button>
        </div>
      </div>
    </div>
  );
};
