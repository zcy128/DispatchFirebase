import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  UserCheck,
  UserPlus,
  UserX,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Edit,
  ExternalLink
} from 'lucide-react';
import {
  TrainingCourse,
  TrainingRegistration,
  TRAINING_COURSE_STATUS_LABELS,
  TRAINING_REGISTRATION_STATUS_LABELS,
  TRAINING_CATEGORY_LABELS
} from '../../types/training';
import { Employee } from '../../types/employee';
import { TrainingService } from '../../services/trainingService';
import { useAuth } from '../../contexts/AuthContext';

interface TrainingCourseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: TrainingCourse;
  employees: Employee[];
  onRefresh: () => void;
  onEdit: (course: TrainingCourse) => void;
}

export const TrainingCourseDetailModal: React.FC<TrainingCourseDetailModalProps> = ({
  isOpen,
  onClose,
  course,
  employees,
  onRefresh,
  onEdit
}) => {
  const { currentUser } = useAuth();
  const isManagement = currentUser?.role === 'admin' || currentUser?.role === 'dispatcher' || currentUser?.role === 'hr';

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [addingAttendee, setAddingAttendee] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const attendees: TrainingRegistration[] = course.attendees || [];
  const currentEmpId = currentUser?.employeeId || '';
  const isUserRegistered = attendees.some(
    (a) =>
      (currentEmpId && a.employeeId === currentEmpId) ||
      (currentUser?.uid && a.employeeId === currentUser.uid) ||
      (currentUser?.email && a.employeeId === currentUser.email)
  );

  const availableEmployees = employees.filter(
    (e) => e.isActive !== false && !attendees.some((a) => a.employeeId === e.id)
  );

  const handlePublish = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await TrainingService.publishCourse(course.id);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish course.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCourse = async () => {
    if (!window.confirm('Are you sure you want to cancel this training course session?')) return;
    setActionLoading(true);
    setError(null);
    try {
      await TrainingService.cancelCourse(course.id, 'Cancelled by administrator');
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel course.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteCourse = async () => {
    if (!window.confirm('Mark this training session as completed?')) return;
    setActionLoading(true);
    setError(null);
    try {
      await TrainingService.completeCourse(course.id);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete course.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterEmployee = async () => {
    if (!selectedEmployeeId) return;
    const emp = employees.find((e) => e.id === selectedEmployeeId);
    if (!emp) return;

    setAddingAttendee(true);
    setError(null);
    try {
      await TrainingService.registerAttendee(course.id, {
        employeeId: emp.id,
        employeeNumber: emp.employeeNumber || '',
        employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
        employeeRole: emp.role || 'Staff'
      });
      setSelectedEmployeeId('');
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to register attendee.');
    } finally {
      setAddingAttendee(false);
    }
  };

  const handleSelfRegister = async () => {
    const matched = employees.find((e) => e.id === currentEmpId || e.employeeNumber === currentEmpId);
    const empId = matched ? matched.id : currentUser?.uid || 'user';
    const empName = matched
      ? `${matched.firstName} ${matched.lastName}`.trim()
      : currentUser?.displayName || currentUser?.email || 'Self';
    const empRole = matched?.role || 'driver';

    setActionLoading(true);
    setError(null);
    try {
      await TrainingService.registerAttendee(course.id, {
        employeeId: empId,
        employeeNumber: matched?.employeeNumber || '',
        employeeName: empName,
        employeeRole: empRole
      });
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to register.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAttendeeStatus = async (
    attendeeId: string,
    status: 'checked_in' | 'completed' | 'no_show' | 'cancelled_by_office'
  ) => {
    setUpdatingId(attendeeId);
    setError(null);
    try {
      await TrainingService.updateAttendeeStatus(course.id, attendeeId, {
        status,
        passed: status === 'completed' ? true : undefined,
        score: status === 'completed' ? 100 : undefined
      });
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to update attendee status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'draft':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'completed':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'cancelled':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getRegistrationBadgeClass = (status: string) => {
    switch (status) {
      case 'registered':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'checked_in':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'no_show':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'cancelled_by_user':
      case 'cancelled_by_office':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const isFull = (course.registeredCount || attendees.length) >= (course.maxSeats || 20);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">{course.title}</h2>
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusBadgeClass(
                    course.status
                  )}`}
                >
                  {TRAINING_COURSE_STATUS_LABELS[course.status] || course.status}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-800 text-slate-300 rounded border border-slate-700">
                  {TRAINING_CATEGORY_LABELS[course.category || 'safety'] || course.category || 'Safety'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Instructor: {course.instructorName || 'TBD'} {course.instructorContact ? `(${course.instructorContact})` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isManagement && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(course);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2.5 text-rose-400 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Date & Time</span>
              </div>
              <div className="text-sm font-semibold text-white mt-1">
                {course.startDate}
                {course.endDate && course.endDate !== course.startDate ? ` ~ ${course.endDate}` : ''}
              </div>
              <div className="text-xs text-slate-400">
                {course.startTime || '09:00'} - {course.endTime || '13:00'} ({course.hours || 0} hrs)
              </div>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>Enrollment</span>
              </div>
              <div className="text-sm font-semibold text-white mt-1">
                {attendees.length} / {course.maxSeats} Seats
              </div>
              <div className="text-xs text-slate-400">
                {isFull ? (
                  <span className="text-rose-400 font-medium">Session Full</span>
                ) : (
                  <span className="text-emerald-400">{course.maxSeats - attendees.length} open</span>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Location</span>
              </div>
              <div className="text-sm font-semibold text-white mt-1 truncate">
                {course.isOnline ? 'Virtual Webinar' : course.location || 'Fleet Room'}
              </div>
              <div className="text-xs text-slate-400">
                {course.isOnline && course.onlineMeetingUrl ? (
                  <a
                    href={course.onlineMeetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline flex items-center space-x-1"
                  >
                    <span>Open link</span>
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                ) : (
                  course.location || 'On-site'
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center space-x-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>Compensation</span>
              </div>
              <div className="text-sm font-semibold text-white mt-1">
                {course.payAmount && course.payAmount > 0 ? `$${course.payAmount.toFixed(2)}` : 'Regular / Unpaid'}
              </div>
              <div className="text-xs text-slate-400">
                Eligible: {course.eligibleRoles ? course.eligibleRoles.join(', ') : 'All'}
              </div>
            </div>
          </div>

          {/* Description & Materials */}
          {(course.description || course.materialsUrl || course.notes) && (
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-800/60 space-y-2">
              {course.description && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Objectives & Outline</h4>
                  <p className="text-sm text-slate-200 mt-1 whitespace-pre-line">{course.description}</p>
                </div>
              )}
              {course.notes && (
                <div className="pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Instructor Notes</h4>
                  <p className="text-sm text-slate-300 mt-0.5">{course.notes}</p>
                </div>
              )}
              {course.materialsUrl && (
                <div className="pt-2 flex items-center space-x-2 text-xs">
                  <span className="text-slate-400 font-semibold uppercase">Handouts & Slides:</span>
                  <a
                    href={course.materialsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center space-x-1"
                  >
                    <span>Access Training Materials</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Management Lifecycle Bar */}
          {isManagement && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/40 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Course Actions:</span> Change status or notify roster.
              </div>
              <div className="flex items-center space-x-2">
                {course.status === 'draft' && (
                  <button
                    onClick={handlePublish}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish Course</span>
                  </button>
                )}
                {course.status === 'published' && (
                  <>
                    <button
                      onClick={handleCompleteCourse}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete Session</span>
                    </button>
                    <button
                      onClick={handleCancelCourse}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium rounded-lg shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel Session</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Non-management self enroll button */}
          {!isManagement && course.status === 'published' && (
            <div className="p-4 bg-indigo-950/30 border border-indigo-900/40 rounded-lg flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Employee Self-Registration</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  {isUserRegistered
                    ? 'You are enrolled in this training course session.'
                    : isFull
                    ? 'This session is currently at full capacity.'
                    : 'Enroll now to secure your seat and receive certification upon completion.'}
                </p>
              </div>
              {!isUserRegistered && !isFull && (
                <button
                  onClick={handleSelfRegister}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-md transition disabled:opacity-50"
                >
                  {actionLoading ? 'Enrolling...' : 'Register for Course'}
                </button>
              )}
            </div>
          )}

          {/* Attendee Roster Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  <span>Enrolled Attendees Roster ({attendees.length})</span>
                </h3>
                <p className="text-xs text-slate-400">Track check-ins, evaluation scores, and certifications</p>
              </div>

              {/* Add Attendee Input for management */}
              {isManagement && course.status !== 'cancelled' && (
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 max-w-xs"
                  >
                    <option value="">Select Employee to Enroll...</option>
                    {availableEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.employeeNumber || e.role || 'Staff'})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleRegisterEmployee}
                    disabled={!selectedEmployeeId || addingAttendee || isFull}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 transition whitespace-nowrap shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{addingAttendee ? 'Adding...' : 'Add Crew'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Attendees Table */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60">
              {attendees.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No crew members currently registered for this course session.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Crew Member</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Registered At</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {attendees.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-3 font-medium text-white">
                            <div>{a.employeeName}</div>
                            {a.employeeNumber && (
                              <div className="text-[10px] text-slate-400">ID: {a.employeeNumber}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 capitalize text-slate-300">{a.employeeRole || 'Crew'}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getRegistrationBadgeClass(
                                a.status
                              )}`}
                            >
                              {TRAINING_REGISTRATION_STATUS_LABELS[a.status] || a.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {a.registeredAt ? a.registeredAt.split('T')[0] : 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                            {isManagement && (
                              <>
                                {a.status === 'registered' && (
                                  <button
                                    onClick={() => handleUpdateAttendeeStatus(a.id, 'checked_in')}
                                    disabled={updatingId === a.id}
                                    className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium transition"
                                  >
                                    Check In
                                  </button>
                                )}
                                {(a.status === 'registered' || a.status === 'checked_in') && (
                                  <button
                                    onClick={() => handleUpdateAttendeeStatus(a.id, 'completed')}
                                    disabled={updatingId === a.id}
                                    className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-medium transition"
                                  >
                                    Pass / Complete
                                  </button>
                                )}
                                {a.status !== 'no_show' && a.status !== 'completed' && (
                                  <button
                                    onClick={() => handleUpdateAttendeeStatus(a.id, 'no_show')}
                                    disabled={updatingId === a.id}
                                    className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded text-[11px] font-medium transition"
                                  >
                                    No-Show
                                  </button>
                                )}
                                {a.status !== 'cancelled_by_office' && a.status !== 'completed' && (
                                  <button
                                    onClick={() => handleUpdateAttendeeStatus(a.id, 'cancelled_by_office')}
                                    disabled={updatingId === a.id}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded transition"
                                    title="Cancel Registration"
                                  >
                                    <UserX className="w-3.5 h-3.5 inline" />
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="text-xs text-slate-400">Course ID: {course.id}</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
