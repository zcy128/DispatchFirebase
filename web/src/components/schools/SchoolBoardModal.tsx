import React, { useState, useEffect } from 'react';
import { SchoolBoard } from '../../types/school';
import { X, Building2, Check } from 'lucide-react';

interface SchoolBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (boardData: Partial<SchoolBoard>) => Promise<void>;
  initialData?: SchoolBoard | null;
}

export const SchoolBoardModal: React.FC<SchoolBoardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [loading, setLoading] = useState(false);
  const [boardCode, setBoardCode] = useState('');
  const [boardName, setBoardName] = useState('');
  const [boardId, setBoardId] = useState<number>(0);

  useEffect(() => {
    if (initialData) {
      setBoardCode(initialData.schoolBoardCode || '');
      setBoardName(initialData.schoolBoardName || '');
      setBoardId(initialData.schoolBoardId || 0);
    } else {
      setBoardCode('');
      setBoardName('');
      setBoardId(0);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        schoolBoardCode: boardCode.trim().toUpperCase(),
        schoolBoardName: boardName.trim(),
        schoolBoardId: boardId || Math.floor(Math.random() * 900) + 100
      });
      onClose();
    } catch (err) {
      console.error('Failed to save school board:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {initialData ? 'Edit School Board' : 'Add School Board'}
              </h3>
              <p className="text-xs text-slate-400">Educational Authority / District Board</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Board Code (Abbreviation) *
            </label>
            <input
              type="text"
              required
              value={boardCode}
              onChange={(e) => setBoardCode(e.target.value)}
              placeholder="e.g. OCDSB, OCSB, CEPEO"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              School Board Full Name *
            </label>
            <input
              type="text"
              required
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="e.g. Ottawa-Carleton District School Board"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Saving...' : initialData ? 'Update Board' : 'Create Board'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
