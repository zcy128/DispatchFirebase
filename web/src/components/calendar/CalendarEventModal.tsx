import React, { useState, useEffect } from 'react';
import { CalendarEvent, CalendarEventType, EVENT_TYPE_CONFIGS } from '../../types/calendar';
import { useI18n } from '../../contexts/I18nContext';
import {
  X,
  Calendar,
  Tag,
  GraduationCap,
  FileText,
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';

interface CalendarEventModalProps {
  isOpen: boolean;
  event: CalendarEvent | null;
  initialDate?: string;
  onClose: () => void;
  onSave: (event: CalendarEvent) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  event,
  initialDate,
  onClose,
  onSave,
  onDelete
}) => {
  const { t } = useI18n();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarEventType>('pd_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [grades, setGrades] = useState('All Grades');
  const [description, setDescription] = useState('');
  const [isSpan, setIsSpan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (event) {
        setTitle(event.title || '');
        setType(event.type || 'pd_day');
        setStartDate(event.startDate || '');
        setEndDate(event.endDate || '');
        setIsSpan(Boolean(event.endDate && event.endDate !== event.startDate));
        setGrades(event.grades || 'All Grades');
        setDescription(event.description || '');
      } else {
        setTitle('');
        setType('pd_day');
        const defaultDate = initialDate || new Date().toISOString().split('T')[0];
        setStartDate(defaultDate);
        setEndDate('');
        setIsSpan(false);
        setGrades('All Grades');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, event, initialDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t.calendar?.titleRequired || 'Please enter an event title.');
      return;
    }
    if (!startDate) {
      setError(t.calendar?.dateRequired || 'Please select a start date.');
      return;
    }
    if (isSpan && endDate && endDate < startDate) {
      setError(t.calendar?.invalidDateRange || 'End date cannot be earlier than start date.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: CalendarEvent = {
        id: event?.id || `EVT-${Date.now()}`,
        title: title.trim(),
        type,
        startDate,
        endDate: isSpan && endDate ? endDate : undefined,
        grades: grades.trim() || 'All Grades',
        description: description.trim() || undefined,
        isBoardWide: event?.isBoardWide || false
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save calendar event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || !onDelete) return;
    if (!window.confirm(t.calendar?.confirmDelete || 'Are you sure you want to remove this event?')) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(event.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete event.');
    } finally {
      setDeleting(false);
    }
  };

  const gradePresets = ['All Grades', 'Secondary (9-12)', 'Elementary (K-8)', 'Kindergarten'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {event ? (t.calendar?.editEvent || 'Edit Calendar Event') : (t.calendar?.addEvent || 'Add Calendar Event')}
              </h3>
              <p className="text-xs text-slate-400">
                {startDate ? `${startDate}` : 'School Year Schedule'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Event Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              {t.calendar?.eventTitle || 'Event Title'} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. PD Day – All Grades, Labour Day, March Break"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <Tag className="w-3.5 h-3.5 text-teal-400" />
              <span>{t.calendar?.eventType || 'Event Type'} *</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(EVENT_TYPE_CONFIGS) as CalendarEventType[]).map((k) => {
                const conf = EVENT_TYPE_CONFIGS[k];
                const isSelected = type === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setType(k)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center space-x-2 transition text-left ${
                      isSelected
                        ? `${conf.badgeBg} ${conf.badgeText} ${conf.badgeBorder} ring-1 ring-current`
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span style={{ color: conf.dotColor }} className="text-sm font-bold leading-none">
                      {conf.symbol}
                    </span>
                    <span className="truncate">{conf.defaultLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {t.calendar?.date || 'Date'} *
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={isSpan}
                  onChange={(e) => setIsSpan(e.target.checked)}
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500 bg-slate-950"
                />
                <span>{t.calendar?.multiDaySpan || 'Multi-day span'}</span>
              </label>
            </div>

            <div className={`grid gap-3 ${isSpan ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">
                  {isSpan ? (t.calendar?.startDate || 'Start Date') : (t.calendar?.date || 'Date')}
                </span>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>

              {isSpan && (
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">
                    {t.calendar?.endDate || 'End Date'}
                  </span>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Applicable Grades */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-teal-400" />
              <span>{t.calendar?.applicableGrades || 'Applicable Grades'}</span>
            </label>
            <input
              type="text"
              value={grades}
              onChange={(e) => setGrades(e.target.value)}
              placeholder="e.g. All Grades, Secondary (9-12)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition mb-2"
            />
            <div className="flex flex-wrap gap-1.5">
              {gradePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGrades(preset)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition ${
                    grades === preset
                      ? 'bg-slate-800 text-teal-300 border-teal-500/40'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.calendar?.description || 'Notes / Description'}</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or details for parents and dispatch staff"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {event && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Deleting...' : (t.common?.delete || 'Delete')}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                {t.common?.cancel || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-900/30 flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{saving ? 'Saving...' : (t.common?.save || 'Save Event')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
