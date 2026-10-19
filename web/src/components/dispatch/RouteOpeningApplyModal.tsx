import React, { useState, useMemo } from 'react';
import { X, Send, Home, AlertCircle, Navigation } from 'lucide-react';
import { RouteOpening, RouteOpeningApplicant } from '../../types/routeOpening';
import { Employee } from '../../types/employee';
import { RouteOpeningService } from '../../services/routeOpeningService';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { calculateDriverDeadhead } from '../../utils/deadheadCalculator';
import { RouteService } from '../../services/routeService';

interface RouteOpeningApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  opening: RouteOpening;
  employees: Employee[];
  onApplied: () => void;
}

export const RouteOpeningApplyModal: React.FC<RouteOpeningApplyModalProps> = ({
  isOpen,
  onClose,
  opening,
  employees,
  onApplied
}) => {
  const { currentUser } = useAuth();
  const { t } = useI18n();

  // Find candidate employee record
  const currentEmployee = useMemo(() => {
    if (!currentUser) return null;
    return (
      employees.find((e) => {
        if (e.id === currentUser.employeeId || e.id === currentUser.uid) return true;
        if (e.employeeNumber && e.employeeNumber === currentUser.employeeId) return true;
        const empEmail = (e.personalEmail || e.workEmail || e.preferredEmail || '').toLowerCase();
        const userEmail = (currentUser.email || '').toLowerCase();
        return empEmail && userEmail && empEmail === userEmail;
      }) || null
    );
  }, [currentUser, employees]);

  const defaultRole: 'driver' | 'attendant' =
    opening.roleNeeded === 'attendant' ? 'attendant' : 'driver';

  const [roleApplied, setRoleApplied] = useState<'driver' | 'attendant'>(defaultRole);
  const [candidateName, setCandidateName] = useState<string>(
    currentEmployee?.fullName || currentUser?.displayName || ''
  );
  const [candidatePhone, setCandidatePhone] = useState<string>(
    currentEmployee?.mobilePhone || currentEmployee?.preferredPhone || ''
  );
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Deadhead calculation to route first stop
  const [deadheadMetrics, setDeadheadMetrics] = useState<{ km: number; minutes: number } | null>(null);

  React.useEffect(() => {
    if (!isOpen || !opening.routeId || !currentEmployee) return;

    let isCancelled = false;
    RouteService.getShiftsForRoute(opening.routeId)
      .then((shifts) => {
        if (isCancelled || !shifts || shifts.length === 0) return;
        const amShift = shifts.find((s) => (s.shiftType || '').toUpperCase() === 'AM') || shifts[0];
        const stops = amShift.stops || [];
        if (stops.length > 0) {
          const res = calculateDriverDeadhead(currentEmployee, stops);
          if (res) {
            setDeadheadMetrics({ km: res.pullOutKm, minutes: res.pullOutMinutes });
          }
        }
      })
      .catch((err) => {
        console.warn('[ApplyModal] Could not compute deadhead:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, opening.routeId, currentEmployee]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      setError('Please provide your candidate name.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const empId = currentEmployee?.id || currentUser?.employeeId || currentUser?.uid || `EMP-${Date.now()}`;

    const applicant: RouteOpeningApplicant = {
      employeeId: empId,
      employeeNumber: currentEmployee?.employeeNumber,
      fullName: candidateName.trim(),
      jobPosition: currentEmployee?.jobPosition || (roleApplied === 'driver' ? 'Driver' : 'Attendant'),
      phone: candidatePhone.trim() || undefined,
      email: currentUser?.email || undefined,
      roleApplied,
      appliedAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
      deadheadKm: deadheadMetrics?.km,
      deadheadDurationMinutes: deadheadMetrics?.minutes,
      status: 'pending'
    };

    try {
      await RouteOpeningService.applyForOpening(opening.id, applicant);
      onApplied();
      onClose();
    } catch (err: any) {
      console.error('[ApplyModal] Error submitting application:', err);
      setError(err?.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {t.routeOpenings?.applyBtn || 'Apply / Express Interest'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Route {opening.routeNo} • {opening.postingType === 'permanent' ? 'Permanent Run' : 'Temporary Cover'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Deadhead Proximity Badge */}
          {deadheadMetrics && (
            <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Home className="w-4 h-4 text-cyan-400" />
                <span>Your Home Distance to 1st Stop:</span>
              </div>
              <span className="font-bold text-amber-400 flex items-center gap-1 font-mono">
                <Navigation className="w-3.5 h-3.5 text-amber-500" />
                ~{deadheadMetrics.km} km ({deadheadMetrics.minutes} min)
              </span>
            </div>
          )}

          {/* Role Applied */}
          {opening.roleNeeded === 'driver_and_attendant' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Position Applying For <span className="text-rose-400">*</span>
              </label>
              <select
                value={roleApplied}
                onChange={(e) => setRoleApplied(e.target.value as 'driver' | 'attendant')}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="driver">School Bus Driver</option>
                <option value="attendant">Bus Attendant / Monitor</option>
              </select>
            </div>
          )}

          {/* Candidate Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Candidate Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              required
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Contact Phone Number
            </label>
            <input
              type="tel"
              value={candidatePhone}
              onChange={(e) => setCandidatePhone(e.target.value)}
              placeholder="e.g. 613-555-0199"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Optional Message / Availability Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Availability or Note to Dispatch (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Available for both morning and afternoon runs. Familiar with West Ottawa roadways."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Confirm & Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
