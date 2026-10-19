import React, { useState, useEffect } from 'react';
import { X, Calendar, CalendarOff, AlertCircle, Save, User } from 'lucide-react';
import { TimeOffRequest, LeaveType, CreateTimeOffRequestPayload, UpdateTimeOffRequestPayload, LEAVE_TYPE_LABELS } from '../../types/timeOff';
import { Employee } from '../../types/employee';
import { TimeOffService } from '../../services/timeOffService';
import { useAuth } from '../../contexts/AuthContext';
import { getLocalTodayString, addDaysToDateString } from '../../utils/dateUtils';

interface TimeOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TimeOffRequest | null;
  employees: Employee[];
  onSaved: () => void;
}

export const TimeOffModal: React.FC<TimeOffModalProps> = ({
  isOpen,
  onClose,
  request,
  employees,
  onSaved
}) => {
  const { currentUser } = useAuth();
  const todayStr = getLocalTodayString();
  const defaultFutureDateStr = addDaysToDateString(todayStr, 3);

  const isManagement = currentUser?.role === 'admin' || currentUser?.role === 'dispatcher' || currentUser?.role === 'hr';

  const [employeeId, setEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('vacation');
  const [startDate, setStartDate] = useState(defaultFutureDateStr);
  const [endDate, setEndDate] = useState(defaultFutureDateStr);
  const [shiftType, setShiftType] = useState<string>('ALL');
  const [comments, setComments] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    if (request) {
      setEmployeeId(request.employeeId);
      setLeaveType(request.leaveType);
      setStartDate(request.startDate || defaultFutureDateStr);
      setEndDate(request.endDate || defaultFutureDateStr);
      setShiftType(request.shiftType || 'ALL');
      setComments(request.comments || '');
    } else {
      // Find matching employee for current user if available
      let defaultEmpId = '';
      if (currentUser?.employeeId) {
        const found = employees.find((e) => e.id === currentUser.employeeId || e.employeeNumber === currentUser.employeeId);
        if (found) defaultEmpId = found.id;
      }
      if (!defaultEmpId && !isManagement && employees.length > 0) {
        defaultEmpId = employees[0].id;
      }
      setEmployeeId(defaultEmpId || (employees.length > 0 ? employees[0].id : ''));
      setLeaveType('vacation');
      setStartDate(defaultFutureDateStr);
      setEndDate(defaultFutureDateStr);
      setShiftType('ALL');
      setComments('');
    }
    setError(null);
  }, [request, isOpen, employees, currentUser, isManagement, defaultFutureDateStr]);

  if (!isOpen) return null;

  const activeEmployees = employees.filter((e) => e.isActive !== false);
  const selectedEmployee = employees.find((e) => e.id === employeeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setError('Please select an employee.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }
    if (startDate > endDate) {
      setError('Start date cannot be after end date.');
      return;
    }

    setSaving(true);
    setError(null);

    const empName = selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim() : (currentUser?.displayName || 'Employee');
    const empNumber = selectedEmployee?.employeeNumber || '';

    try {
      if (request) {
        const payload: UpdateTimeOffRequestPayload = {
          leaveType,
          startDate,
          endDate,
          shiftType,
          comments
        };
        await TimeOffService.updateTimeOffRequest(request.id, payload);
      } else {
        const payload: CreateTimeOffRequestPayload = {
          employeeId,
          employeeNumber: empNumber,
          employeeName: empName,
          leaveType,
          startDate,
          endDate,
          shiftType,
          comments,
          requestedByUserId: currentUser?.uid || '',
          requestedByName: currentUser?.displayName || currentUser?.email || empName
        };
        await TimeOffService.createTimeOffRequest(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to submit time off request:', err);
      setError(err?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CalendarOff className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {request ? 'Edit Time Off Request' : 'Submit Time Off Request'}
              </h2>
              <p className="text-xs text-slate-400">
                Submit an absence or leave request for HR review and approval
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2.5 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Employee Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Employee *
            </label>
            {isManagement ? (
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={!!request}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50"
              >
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeNumber || e.role || 'Staff'})
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 flex items-center space-x-2">
                <User className="w-4 h-4 text-slate-400" />
                <span>
                  {selectedEmployee
                    ? `${selectedEmployee.firstName} ${selectedEmployee.lastName} (${selectedEmployee.employeeNumber || 'Staff'})`
                    : currentUser?.displayName || currentUser?.email || 'Current User'}
                </span>
              </div>
            )}
          </div>

          {/* Leave Type & Shift Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Leave Type *
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {Object.entries(LEAVE_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Shift Coverage *
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Shifts (Full Day)</option>
                <option value="AM">Morning (AM) Only</option>
                <option value="PM">Afternoon (PM) Only</option>
                <option value="Midday">Midday / Noon Only</option>
              </select>
            </div>
          </div>

          {/* Date Range */}
          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Requested Dates *</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDate(newStart);
                    if (endDate && newStart > endDate) {
                      setEndDate(newStart);
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Reason / Comments */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Reason & Comments
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Provide reason or any relevant details for HR review..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-sm rounded-lg flex items-center space-x-2 transition shadow-lg shadow-amber-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Submitting...' : request ? 'Update Request' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
