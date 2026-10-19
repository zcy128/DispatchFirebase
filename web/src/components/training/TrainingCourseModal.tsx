import React, { useState, useEffect } from 'react';
import { X, GraduationCap, AlertCircle, Save, Calendar, Clock, MapPin, Video, Users, DollarSign } from 'lucide-react';
import {
  TrainingCourse,
  TrainingType,
  TrainingCategory,
  CreateTrainingCoursePayload,
  UpdateTrainingCoursePayload,
  TRAINING_CATEGORY_LABELS
} from '../../types/training';
import { TrainingService } from '../../services/trainingService';
import { useAuth } from '../../contexts/AuthContext';
import { getLocalTodayString, addDaysToDateString } from '../../utils/dateUtils';

interface TrainingCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: TrainingCourse | null;
  trainingTypes: TrainingType[];
  onSaved: () => void;
}

export const TrainingCourseModal: React.FC<TrainingCourseModalProps> = ({
  isOpen,
  onClose,
  course,
  trainingTypes,
  onSaved
}) => {
  const { currentUser } = useAuth();
  const todayStr = getLocalTodayString();
  const defaultFutureDate = addDaysToDateString(todayStr, 3);

  const [courseTypeId, setCourseTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TrainingCategory>('safety');
  const [instructorName, setInstructorName] = useState('');
  const [instructorContact, setInstructorContact] = useState('');
  const [location, setLocation] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineMeetingUrl, setOnlineMeetingUrl] = useState('');
  const [startDate, setStartDate] = useState(defaultFutureDate);
  const [endDate, setEndDate] = useState(defaultFutureDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [hours, setHours] = useState<number>(4);
  const [maxSeats, setMaxSeats] = useState<number>(20);
  const [payAmount, setPayAmount] = useState<string>('');
  const [eligibleRoles, setEligibleRoles] = useState<string[]>(['all']);
  const [materialsUrl, setMaterialsUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (course) {
      setCourseTypeId(course.courseTypeId || course.trainingTypeId || '');
      setTitle(course.title || '');
      setDescription(course.description || '');
      setCategory(course.category || 'safety');
      setInstructorName(course.instructorName || '');
      setInstructorContact(course.instructorContact || '');
      setLocation(course.location || '');
      setIsOnline(!!course.isOnline);
      setOnlineMeetingUrl(course.onlineMeetingUrl || '');
      setStartDate(course.startDate || defaultFutureDate);
      setEndDate(course.endDate || defaultFutureDate);
      setStartTime(course.startTime || '09:00');
      setEndTime(course.endTime || '13:00');
      setHours(course.hours || 4);
      setMaxSeats(course.maxSeats || 20);
      setPayAmount(course.payAmount !== undefined && course.payAmount !== null ? String(course.payAmount) : '');
      setEligibleRoles(course.eligibleRoles && course.eligibleRoles.length > 0 ? course.eligibleRoles : ['all']);
      setMaterialsUrl(course.materialsUrl || '');
      setNotes(course.notes || '');
    } else {
      const defaultType = trainingTypes.length > 0 ? trainingTypes[0] : null;
      setCourseTypeId(defaultType ? defaultType.id : '');
      setTitle(defaultType ? defaultType.name : '');
      setDescription(defaultType ? defaultType.description || '' : '');
      setCategory(defaultType ? defaultType.category : 'safety');
      setInstructorName(currentUser?.displayName || '');
      setInstructorContact(currentUser?.email || '');
      setLocation('Main Training Center');
      setIsOnline(false);
      setOnlineMeetingUrl('');
      setStartDate(defaultFutureDate);
      setEndDate(defaultFutureDate);
      setStartTime('09:00');
      setEndTime('13:00');
      setHours(defaultType ? defaultType.defaultHours || 4 : 4);
      setMaxSeats(20);
      setPayAmount('');
      setEligibleRoles(
        defaultType?.eligibleRoles && defaultType.eligibleRoles.length > 0 ? defaultType.eligibleRoles : ['all']
      );
      setMaterialsUrl('');
      setNotes('');
    }
    setError(null);
  }, [course, isOpen, trainingTypes, currentUser, defaultFutureDate]);

  if (!isOpen) return null;

  const handleTypeChange = (typeId: string) => {
    setCourseTypeId(typeId);
    const selected = trainingTypes.find((t) => t.id === typeId);
    if (selected && !course) {
      setTitle(selected.name);
      setDescription(selected.description || '');
      setCategory(selected.category);
      setHours(selected.defaultHours || 4);
      setEligibleRoles(
        selected.eligibleRoles && selected.eligibleRoles.length > 0 ? selected.eligibleRoles : ['all']
      );
    }
  };

  const handleRoleToggle = (role: string) => {
    if (role === 'all') {
      setEligibleRoles(['all']);
      return;
    }
    let updated = eligibleRoles.filter((r) => r !== 'all');
    if (updated.includes(role)) {
      updated = updated.filter((r) => r !== role);
    } else {
      updated.push(role);
    }
    if (updated.length === 0) {
      updated = ['all'];
    }
    setEligibleRoles(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a course title.');
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
    if (maxSeats < 1) {
      setError('Maximum seats must be at least 1.');
      return;
    }

    setSaving(true);
    setError(null);

    const parsedPay = payAmount.trim() !== '' ? parseFloat(payAmount) : undefined;

    try {
      if (course) {
        const payload: UpdateTrainingCoursePayload = {
          courseTypeId,
          trainingTypeId: courseTypeId,
          title: title.trim(),
          description: description.trim(),
          category,
          instructorName: instructorName.trim(),
          instructorContact: instructorContact.trim(),
          location: location.trim(),
          isOnline,
          onlineMeetingUrl: onlineMeetingUrl.trim(),
          startDate,
          endDate,
          startTime,
          endTime,
          hours: Number(hours),
          maxSeats: Number(maxSeats),
          payAmount: parsedPay,
          eligibleRoles,
          materialsUrl: materialsUrl.trim(),
          notes: notes.trim()
        };
        await TrainingService.updateCourse(course.id, payload);
      } else {
        const payload: CreateTrainingCoursePayload = {
          courseTypeId,
          trainingTypeId: courseTypeId,
          trainingTypeName: title.trim(),
          title: title.trim(),
          description: description.trim(),
          category,
          instructorName: instructorName.trim(),
          instructorContact: instructorContact.trim(),
          location: location.trim(),
          isOnline,
          onlineMeetingUrl: onlineMeetingUrl.trim(),
          startDate,
          endDate,
          startTime,
          endTime,
          hours: Number(hours),
          maxSeats: Number(maxSeats),
          payAmount: parsedPay,
          eligibleRoles,
          materialsUrl: materialsUrl.trim(),
          notes: notes.trim(),
          createdBy: currentUser?.uid || ''
        };
        await TrainingService.createCourse(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save training course:', err);
      setError(err?.message || 'Failed to save course session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {course ? 'Edit Training Course' : 'Create Training Course Session'}
              </h2>
              <p className="text-xs text-slate-400">
                Configure curriculum, scheduling, capacity, and role eligibility
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2.5 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Catalog Type Link & Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Catalog Template
              </label>
              <select
                value={courseTypeId}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Custom Course</option>
                {trainingTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TrainingCategory)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {Object.entries(TRAINING_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Course Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Defensive Driving Refresher"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Description / Objectives
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize course goals, curriculum outline, and prerequisites..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Instructor & Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Instructor Name
              </label>
              <input
                type="text"
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="e.g. Captain Marcus Vance"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Instructor Contact
              </label>
              <input
                type="text"
                value={instructorContact}
                onChange={(e) => setInstructorContact(e.target.value)}
                placeholder="training@schoolbusops.com / 555-0199"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Dates & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                <Calendar className="w-3 h-3 inline mr-1 text-slate-400" /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                <Calendar className="w-3 h-3 inline mr-1 text-slate-400" /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                <Clock className="w-3 h-3 inline mr-1 text-slate-400" /> Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                <Clock className="w-3 h-3 inline mr-1 text-slate-400" /> End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Location & Online Option */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={isOnline}
                  onChange={(e) => setIsOnline(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800 w-4 h-4"
                />
                <span className="flex items-center space-x-1.5">
                  <Video className="w-4 h-4 text-sky-400" />
                  <span>Online / Virtual Webinar</span>
                </span>
              </label>
            </div>

            {isOnline ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Online Meeting / Webinar URL
                </label>
                <input
                  type="url"
                  value={onlineMeetingUrl}
                  onChange={(e) => setOnlineMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/xyz-abcd-efg"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                  Physical Location / Training Room
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Yard 1 Fleet Training Hall, Bay 4"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Hours, Seats, Pay */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Duration (Hours)
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <Users className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />
                Max Capacity
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={maxSeats}
                onChange={(e) => setMaxSeats(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                <DollarSign className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                Compensation ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional pay"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Role Eligibility */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Eligible Roles
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRoleToggle('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  eligibleRoles.includes('all')
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Crew Members
              </button>
              <button
                type="button"
                onClick={() => handleRoleToggle('driver')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  !eligibleRoles.includes('all') && eligibleRoles.includes('driver')
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Drivers
              </button>
              <button
                type="button"
                onClick={() => handleRoleToggle('attendant')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  !eligibleRoles.includes('all') && eligibleRoles.includes('attendant')
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Attendants / Monitors
              </button>
            </div>
          </div>

          {/* Materials URL & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Materials / Handout Link
              </label>
              <input
                type="url"
                value={materialsUrl}
                onChange={(e) => setMaterialsUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Instructor Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Bring safety boots and MTO handbook"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-lg shadow-indigo-600/20 flex items-center space-x-2 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : course ? 'Update Course' : 'Create Course'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
