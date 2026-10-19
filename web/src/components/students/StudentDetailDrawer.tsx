import React, { useState } from 'react';
import { Student } from '../../types/student';
import { School } from '../../types/school';
import {
  X,
  Phone,
  Mail,
  MapPin,
  School as SchoolIcon,
  Clock,
  Bus,
  HeartPulse,
  Users,
  Edit2,
  Trash2,
  History,
  FileText,
  MessageSquare,
  UserX
} from 'lucide-react';
import { EntityOperationLogPanel } from '../common/EntityOperationLogPanel';
import { CreateParentChannelPayload } from '../../types/chat';
import { RecordStudentAbsenceModal } from '../dispatch/RecordStudentAbsenceModal';

interface StudentDetailDrawerProps {
  student: Student | null;
  school?: School | null;
  onClose: () => void;
  onEdit?: (student: Student) => void;
  onDelete?: (student: Student) => void;
  onMessageParent?: (payload: CreateParentChannelPayload) => void;
}

export const StudentDetailDrawer: React.FC<StudentDetailDrawerProps> = ({
  student,
  school,
  onClose,
  onEdit,
  onDelete,
  onMessageParent,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'audit'>('profile');
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);

  if (!student) return null;

  const routesList = student.routes
    ? student.routes.split(',').map((r) => r.trim()).filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 text-slate-100 h-full overflow-y-auto shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/90 sticky top-0 backdrop-blur z-10">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-sky-500/20">
                {student.firstName[0]}
                {student.lastName[0]}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">{student.fullName}</h2>
                  {student.metatBus && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      ★ Met at Bus
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      student.active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {student.active ? 'Active Rider' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                    ID: {student.studentNo}
                  </span>
                  <span>•</span>
                  <span className="text-indigo-400 font-semibold">Grade: {student.grade}</span>
                  {student.gender && (
                    <>
                      <span>•</span>
                      <span>Gender: {student.gender}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(student)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition"
                  title="Edit Student"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subtab Switcher */}
          <div className="flex items-center space-x-2 px-6 pt-4 border-b border-slate-800 bg-slate-900/60">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold border-b-2 transition ${
                activeTab === 'profile'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Student Profile</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold border-b-2 transition ${
                activeTab === 'audit'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Operation History & Logs</span>
            </button>
          </div>

          {activeTab === 'audit' ? (
            <div className="p-6">
              <EntityOperationLogPanel
                targetType="student"
                targetId={student.id}
                targetIdentifier={student.studentNo}
                title={`Audit Log: ${student.fullName || student.studentName}`}
                subtitle={`Track all creation, modification, and route assignment actions for #${student.studentNo}`}
                compact={true}
              />
            </div>
          ) : (
            <div className="p-6 space-y-6">
            {/* School Logistics Card (Linked in real-time) */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold text-sky-400 uppercase tracking-wider">
                  <SchoolIcon className="w-4 h-4" />
                  <span>Enrolled School & Bell Schedule</span>
                </div>
                {school?.schoolBoardCode && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    {school.schoolBoardCode}
                  </span>
                )}
              </div>

              <div>
                <div className="font-bold text-white text-sm">
                  {school ? school.schoolName : student.schoolName}
                </div>
                <div className="flex items-start space-x-1.5 text-xs text-slate-400 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <span>{school?.schoolAddress || 'Address not listed'}</span>
                </div>
              </div>

              {/* Bell Times */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/60 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>Morning Bell</span>
                  </div>
                  <div className="text-slate-200 font-bold mt-1">
                    {school?.startTime || '08:30 AM'}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-bold flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Dismissal</span>
                  </div>
                  <div className="text-slate-200 font-bold mt-1">
                    {school?.dismissalTime || '03:00 PM'}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                  <div className="text-slate-500 text-[10px] uppercase font-bold flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-sky-400" />
                    <span>Office Contact</span>
                  </div>
                  <div className="text-slate-200 font-bold mt-1 truncate">
                    {school?.schoolPhone || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Transportation / Bus Routes */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                <Bus className="w-4 h-4" />
                <span>Transportation & Route Assignment</span>
              </div>

              {routesList.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {routesList.map((rt) => (
                    <span
                      key={rt}
                      className="inline-flex items-center px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-xs font-bold"
                    >
                      <Bus className="w-3 h-3 mr-1.5" />
                      {rt}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  No active route shift assigned yet.
                </div>
              )}
            </div>

            {/* Residential Address & Phone */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Home Address & Contact
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-200">{student.studentAddress || 'Address not listed'}</span>
                </div>

                {student.studentPhone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <a
                      href={`tel:${student.studentPhone}`}
                      className="text-amber-400 hover:underline font-mono"
                    >
                      {student.studentPhone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Scheduled Stops & Route Itinerary */}
            {student.stops && student.stops.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-sky-400 uppercase tracking-wider">
                    <Bus className="w-4 h-4" />
                    <span>Scheduled Stops & Itinerary ({student.stops.length})</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {student.stops.map((st, i) => (
                    <div
                      key={st.stopId || i}
                      className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="font-mono font-bold text-sky-400 flex items-center space-x-1 shrink-0">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{st.time}</span>
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 border ${
                            st.type.toLowerCase().includes('pickup')
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}
                        >
                          {st.type}
                        </span>
                        <span className="text-slate-300 truncate" title={st.location}>
                          {st.location}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        {st.comment && (
                          <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {st.comment}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          {st.shift}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parent & Emergency Contacts */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <Users className="w-4 h-4" />
                  <span>Parents & Emergency Contacts ({student.contacts?.length || 0})</span>
                </div>
              </div>

              {student.contacts && student.contacts.length > 0 ? (
                <div className="space-y-2.5">
                  {student.contacts.map((c) => (
                    <div
                      key={c.contactId}
                      className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-white text-xs flex items-center space-x-2">
                          <span>{c.contactName}</span>
                          {c.relationship && (
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({c.relationship})
                            </span>
                          )}
                        </div>
                        {c.primaryContact && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                            Primary
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                        {c.mobilePhone && (
                          <a
                            href={`tel:${c.mobilePhone}`}
                            className="flex items-center space-x-1 text-amber-400 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{c.mobilePhone}</span>
                          </a>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="flex items-center space-x-1 text-sky-400 hover:underline"
                          >
                            <Mail className="w-3 h-3" />
                            <span>{c.email}</span>
                          </a>
                        )}
                        {onMessageParent && (c.mobilePhone || c.email) && (
                          <button
                            type="button"
                            onClick={() => {
                              onMessageParent({
                                parentContact: c.mobilePhone || c.email || '',
                                parentName: c.contactName,
                                studentId: student.id,
                                studentName: student.fullName,
                                busUnitNumber: student.routes ? student.routes.split(',')[0].trim() : '',
                                routeNo: student.routes || '',
                                schoolName: student.schoolName || (school ? school.schoolName : ''),
                                grade: student.grade,
                              });
                            }}
                            className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 hover:underline font-semibold ml-auto"
                            title="Open direct operations chat with parent"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Chat with Parent</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No contacts registered.</div>
              )}
            </div>

            {/* Care Plans & Dispatch Notes */}
            {(student.studentDispatchNotes || student.studentSchoolNotes || student.equipments) && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  <HeartPulse className="w-4 h-4" />
                  <span>Care Plans & Special Instructions</span>
                </div>

                {student.studentDispatchNotes && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-400">Dispatch Care Plan:</div>
                    <p className="text-xs text-slate-200 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      {student.studentDispatchNotes}
                    </p>
                  </div>
                )}

                {student.studentSchoolNotes && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-400">Medical & School Notes:</div>
                    <p className="text-xs text-slate-200 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      {student.studentSchoolNotes}
                    </p>
                  </div>
                )}

                {student.equipments && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-400">Special Equipment Required:</div>
                    <span className="inline-block text-xs text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 font-medium">
                      {student.equipments}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAbsenceModalOpen(true)}
              className="px-3.5 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
              title="Log student absence (today, tomorrow, or future date)"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Log Absence</span>
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(student)}
                className="px-4 py-2 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Student</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(student)}
                className="px-3 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
                title="Delete Student Profile"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
          >
            Close Details
          </button>
        </div>
      </div>

      <RecordStudentAbsenceModal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        initialStudent={{
          studentId: student.studentId || Number(student.id.replace(/\D/g, '')) || 0,
          studentNo: student.studentNo,
          studentName: student.fullName,
          schoolName: student.schoolName || (school ? school.schoolName : ''),
          routeNo: routesList[0] || '',
        }}
      />
    </div>
  );
};
