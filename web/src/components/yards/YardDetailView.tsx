import React from 'react';
import { ArrowLeft, Edit3, Phone, Mail } from 'lucide-react';
import { Yard } from '../../types/yard';
import { BusRoute } from '../../types/route';
import { School } from '../../types/school';

interface YardDetailViewProps {
  yard: Yard;
  assignedRoutes: BusRoute[];
  assignedSchools: School[];
  onBack: () => void;
  onEdit: (yard: Yard) => void;
}

export const YardDetailView: React.FC<YardDetailViewProps> = ({
  yard,
  assignedRoutes,
  assignedSchools,
  onBack,
  onEdit,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button & Title */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center space-x-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition text-sm font-semibold"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Yards</span>
          </button>
          <h1 className="text-3xl font-bold font-serif text-slate-900 dark:text-white tracking-tight">
            {yard.name}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => onEdit(yard)}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#2c3e50] hover:bg-[#1a252f] text-white text-sm font-semibold shadow transition"
        >
          <Edit3 className="w-4 h-4" />
          <span>Edit Yard</span>
        </button>
      </div>

      {/* Cards matching media_1790343113099.png */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: YARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
            YARD
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-400 mb-0.5 font-medium">Name</div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                {yard.name}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-0.5 font-medium">Supervisor</div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                {yard.supervisorName || '—'}
              </div>
              {yard.supervisorPhone && (
                <div className="text-xs text-slate-500 flex items-center space-x-1.5 mt-1 font-mono">
                  <Phone className="w-3.5 h-3.5" />
                  <a href={`tel:${yard.supervisorPhone}`} className="hover:underline">
                    {yard.supervisorPhone}
                  </a>
                </div>
              )}
              {yard.supervisorEmail && (
                <div className="text-xs text-slate-500 flex items-center space-x-1.5 mt-0.5 font-mono">
                  <Mail className="w-3.5 h-3.5" />
                  <a href={`mailto:${yard.supervisorEmail}`} className="hover:underline">
                    {yard.supervisorEmail}
                  </a>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-0.5 font-medium">Status</div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                {yard.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: SUPERVISION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
            SUPERVISION
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-400 mb-0.5 font-medium">Alternate supervisor</div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                {yard.supervisorAltName || '—'}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="text-xs text-slate-400 mb-1 font-medium">Assigned Resources</div>
              <div className="flex items-center space-x-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {assignedRoutes.length} Routes
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {assignedSchools.length} Schools
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
