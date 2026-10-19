import React from 'react';
import { School } from '../../types/school';
import {
  X,
  School as SchoolIcon,
  Clock,
  MapPin,
  Phone,
  Mail,
  Users,
  Building2,
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  AlertCircle,
  Car
} from 'lucide-react';

interface SchoolDetailDrawerProps {
  school: School | null;
  onClose: () => void;
  onEdit: (school: School) => void;
  onDelete?: (school: School) => void;
  onViewStudents?: (schoolId: number) => void;
}

export const SchoolDetailDrawer: React.FC<SchoolDetailDrawerProps> = ({
  school,
  onClose,
  onEdit,
  onDelete,
  onViewStudents
}) => {
  if (!school) return null;

  const mapsUrl = school.gpsLatitude && school.gpsLongitude
    ? `https://www.google.com/maps/search/?api=1&query=${school.gpsLatitude},${school.gpsLongitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.schoolAddress || school.schoolName)}`;

  const getBoardBadgeColor = (code?: string) => {
    switch (code) {
      case 'OCDSB':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'OCSB':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'CEPEO':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 text-slate-100 h-full overflow-y-auto shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/90 sticky top-0 backdrop-blur z-10">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
                <SchoolIcon className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {school.schoolName}
                  </h2>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getBoardBadgeColor(school.schoolBoardCode)}`}>
                    <Building2 className="w-3 h-3 mr-1" />
                    {school.schoolBoardCode || 'Board'}: {school.schoolBoardName}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      school.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {school.isActive ? 'Active Campus' : 'Inactive'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {school.id || `SCH-${school.schoolId}`}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Bell Schedule Card */}
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Clock className="w-4 h-4" />
                  <span>Bell Timetable & Schedule</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Daily Schedule</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Morning Entry</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {school.startTime || '08:30'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Bus Arrival Target: ~10m before</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Dismissal Bell</span>
                  <span className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                    {school.dismissalTime || '15:00'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Departure Target: ~15m after</span>
                </div>
              </div>

              {school.earlyDismissalDay && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300 font-medium">Early Dismissal: {school.earlyDismissalDay}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400">
                    {school.earlyDismissalTime || '13:30'}
                  </span>
                </div>
              )}
            </div>

            {/* Students & Transportation Summary */}
            <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Enrolled Bus Students</h4>
                  <p className="text-xs text-slate-400">
                    {school.studentNum || 0} active students currently assigned to this campus
                  </p>
                </div>
              </div>

              {onViewStudents && (
                <button
                  onClick={() => onViewStudents(school.schoolId)}
                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-sm flex items-center space-x-1"
                >
                  <span>View Students</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Contact Person & Office */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Administration & Contacts
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                    Campus Principal / Lead
                  </span>
                  <p className="text-sm font-bold text-slate-100 mt-1">
                    {school.contactPerson || 'Office Administration'}
                  </p>
                  {school.contactPersonCellPhone && (
                    <a
                      href={`tel:${school.contactPersonCellPhone}`}
                      className="inline-flex items-center space-x-1.5 text-xs text-amber-400 hover:underline mt-2 font-mono"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{school.contactPersonCellPhone}</span>
                    </a>
                  )}
                  {school.contactPersonEmail && (
                    <a
                      href={`mailto:${school.contactPersonEmail}`}
                      className="flex items-center space-x-1.5 text-xs text-sky-400 hover:underline mt-1 truncate"
                    >
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{school.contactPersonEmail}</span>
                    </a>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                    Main Office & Dispatch Tel
                  </span>
                  <p className="text-sm font-mono font-bold text-slate-200 mt-1">
                    {school.schoolPhone || 'N/A'}
                  </p>
                  {school.schoolFax && (
                    <p className="text-xs text-slate-400 mt-1">
                      Fax: <span className="font-mono">{school.schoolFax}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Address & GPS Map Link */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Location & Directions
              </h3>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                        {school.schoolAddress || 'Address not registered'}
                      </p>
                      {school.gpsLatitude && school.gpsLongitude && (
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          GPS: {school.gpsLatitude.toFixed(4)}, {school.gpsLongitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition flex items-center space-x-1 text-xs"
                    title="Open in Google Maps"
                  >
                    <span>Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {school.parkingNotes && (
                  <div className="pt-2 border-t border-slate-700/60 text-xs">
                    <span className="font-semibold text-amber-400 flex items-center space-x-1 mb-1">
                      <Car className="w-3.5 h-3.5" />
                      <span>Bus Loading Zone / Parking Notes:</span>
                    </span>
                    <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      {school.parkingNotes}
                    </p>
                  </div>
                )}

                {school.schoolNotes && (
                  <div className="pt-2 border-t border-slate-700/60 text-xs">
                    <span className="font-semibold text-slate-300 flex items-center space-x-1 mb-1">
                      <AlertCircle className="w-3.5 h-3.5 text-sky-400" />
                      <span>General School Notes:</span>
                    </span>
                    <p className="text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      {school.schoolNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between sticky bottom-0 backdrop-blur">
          {onDelete ? (
            <button
              onClick={() => onDelete(school)}
              className="px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition text-xs font-semibold flex items-center space-x-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete School</span>
            </button>
          ) : <div />}

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
            >
              Close
            </button>
            <button
              onClick={() => onEdit(school)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit School</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
