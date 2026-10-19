import React, { useState, useEffect } from 'react';
import { X, BookOpen, AlertCircle, Save } from 'lucide-react';
import {
  TrainingType,
  TrainingCategory,
  CreateTrainingTypePayload,
  UpdateTrainingTypePayload,
  TRAINING_CATEGORY_LABELS
} from '../../types/training';
import { TrainingService } from '../../services/trainingService';

interface TrainingTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainingType: TrainingType | null;
  onSaved: () => void;
}

export const TrainingTypeModal: React.FC<TrainingTypeModalProps> = ({
  isOpen,
  onClose,
  trainingType,
  onSaved
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TrainingCategory>('safety');
  const [defaultHours, setDefaultHours] = useState<number>(4);
  const [validityMonths, setValidityMonths] = useState<number>(12);
  const [isRequired, setIsRequired] = useState(false);
  const [passingScore, setPassingScore] = useState<number>(80);
  const [eligibleRoles, setEligibleRoles] = useState<string[]>(['all']);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trainingType) {
      setName(trainingType.name || '');
      setCode(trainingType.code || '');
      setDescription(trainingType.description || '');
      setCategory(trainingType.category || 'safety');
      setDefaultHours(trainingType.defaultHours || 4);
      setValidityMonths(trainingType.validityMonths || 12);
      setIsRequired(!!trainingType.isRequired);
      setPassingScore(trainingType.passingScore || 80);
      setEligibleRoles(
        trainingType.eligibleRoles && trainingType.eligibleRoles.length > 0 ? trainingType.eligibleRoles : ['all']
      );
    } else {
      setName('');
      setCode('');
      setDescription('');
      setCategory('safety');
      setDefaultHours(4);
      setValidityMonths(12);
      setIsRequired(false);
      setPassingScore(80);
      setEligibleRoles(['all']);
    }
    setError(null);
  }, [trainingType, isOpen]);

  if (!isOpen) return null;

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
    if (!name.trim()) {
      setError('Course name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Course code is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (trainingType) {
        const payload: UpdateTrainingTypePayload = {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          category,
          defaultHours: Number(defaultHours),
          validityMonths: Number(validityMonths),
          isRequired,
          eligibleRoles,
          passingScore: Number(passingScore)
        };
        await TrainingService.updateTrainingType(trainingType.id, payload);
      } else {
        const payload: CreateTrainingTypePayload = {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          category,
          defaultHours: Number(defaultHours),
          validityMonths: Number(validityMonths),
          isRequired,
          eligibleRoles,
          passingScore: Number(passingScore)
        };
        await TrainingService.createTrainingType(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save training course type:', err);
      setError(err?.message || 'Failed to save course template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {trainingType ? 'Edit Course Template' : 'Add Course Template'}
              </h2>
              <p className="text-xs text-slate-400">Standardized catalog curriculum item</p>
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

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Course Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Defensive Driving Refresher"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DD-101"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TrainingCategory)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {Object.entries(TRAINING_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline standard curriculum scope, prerequisites, or topics..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Hours
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={defaultHours}
                onChange={(e) => setDefaultHours(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Validity (Mos)
              </label>
              <input
                type="number"
                min="0"
                value={validityMonths}
                onChange={(e) => setValidityMonths(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Pass Score %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(parseInt(e.target.value, 10) || 80)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-200">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-800 w-4 h-4"
              />
              <span className="font-medium">Mandatory Annual / Compliance Requirement</span>
            </label>
          </div>

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
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Crew
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
                Attendants
              </button>
            </div>
          </div>

          {/* Actions */}
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
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-lg shadow-emerald-600/20 flex items-center space-x-2 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : trainingType ? 'Update Template' : 'Create Template'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
