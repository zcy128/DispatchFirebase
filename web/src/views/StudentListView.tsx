import React, { useState } from 'react';
import { Student, StudentContact, StudentStats } from '../types/student';
import { School } from '../types/school';
import {
  Search,
  Filter,
  GraduationCap,
  School as SchoolIcon,
  Bus,
  RefreshCw,
  Phone,
  ChevronRight,
  Users,
  Edit2,
  Plus,
  Trash2,
  MessageSquare
} from 'lucide-react';
import { CreateParentChannelPayload } from '../types/chat';

interface StudentListViewProps {
  students: Student[];
  schools: School[];
  stats: StudentStats;
  loading?: boolean;
  onRefresh?: () => void;
  onSelectStudent: (student: Student) => void;
  onEditStudent?: (student: Student) => void;
  onCreateStudent?: () => void;
  onDeleteStudent?: (student: Student) => void;
  onMessageParent?: (payload: CreateParentChannelPayload) => void;
}

export const StudentListView: React.FC<StudentListViewProps> = ({
  students,
  schools,
  stats,
  onRefresh,
  onSelectStudent,
  onEditStudent,
  onCreateStudent,
  onDeleteStudent,
  onMessageParent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [routeFilter, setRouteFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [metAtBusOnly, setMetAtBusOnly] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const filteredStudents = students.filter((s) => {
    if (selectedSchoolId !== 'ALL' && s.schoolId !== Number(selectedSchoolId)) {
      return false;
    }

    if (selectedGrade !== 'ALL' && s.grade !== selectedGrade) {
      return false;
    }

    if (metAtBusOnly && !s.metatBus) {
      return false;
    }

    if (routeFilter === 'ASSIGNED' && (!s.routes || s.routes.trim() === '')) {
      return false;
    }
    if (routeFilter === 'UNASSIGNED' && s.routes && s.routes.trim() !== '') {
      return false;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = s.fullName.toLowerCase().includes(term);
      const matchNo = s.studentNo.toLowerCase().includes(term);
      const matchSchool = s.schoolName.toLowerCase().includes(term);
      const matchRoute = (s.routes || '').toLowerCase().includes(term);
      const matchPhone = (s.studentPhone || '').includes(term);
      const matchAddr = (s.studentAddress || '').toLowerCase().includes(term);
      if (!matchName && !matchNo && !matchSchool && !matchRoute && !matchPhone && !matchAddr) {
        return false;
      }
    }

    return true;
  });

  const availableGrades = ['JK', 'SK', '1', '2', '3', '4', '5', '6', '7', '8'];

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Controls: Search & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, ID (e.g. 0001), school, assigned route (OCDSB-...), phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 transition placeholder:text-slate-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {onCreateStudent && (
              <button
                onClick={onCreateStudent}
                className="px-3.5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-sky-500/20 transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Student</span>
              </button>
            )}

            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh student roster from cloud"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh Directory</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400 mr-2 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter by:</span>
          </div>

          {/* School Filter */}
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Schools ({schools.length})</option>
            {schools.map((sch) => (
              <option key={sch.schoolId} value={sch.schoolId}>
                {sch.schoolName} ({sch.studentNum || 0})
              </option>
            ))}
          </select>

          {/* Grade Filter */}
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Grades</option>
            {availableGrades.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>

          {/* Route Assignment Filter */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
            <button
              onClick={() => setRouteFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                routeFilter === 'ALL'
                  ? 'bg-sky-500/20 text-sky-300 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Routes
            </button>
            <button
              onClick={() => setRouteFilter('ASSIGNED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                routeFilter === 'ASSIGNED'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Assigned
            </button>
            <button
              onClick={() => setRouteFilter('UNASSIGNED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                routeFilter === 'UNASSIGNED'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Unassigned
            </button>
          </div>

          {/* Met at Bus toggle */}
          <button
            onClick={() => setMetAtBusOnly(!metAtBusOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 ${
              metAtBusOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <span>★ Met at Bus Only</span>
          </button>

          {(selectedSchoolId !== 'ALL' || selectedGrade !== 'ALL' || routeFilter !== 'ALL' || metAtBusOnly || searchTerm) && (
            <button
              onClick={() => {
                setSelectedSchoolId('ALL');
                setSelectedGrade('ALL');
                setRouteFilter('ALL');
                setMetAtBusOnly(false);
                setSearchTerm('');
              }}
              className="text-xs text-rose-400 hover:underline ml-auto font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.totalStudents}</div>
            <div className="text-[11px] text-slate-400 font-medium">Total Registered Students</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            <SchoolIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{schools.length}</div>
            <div className="text-[11px] text-slate-400 font-medium">Schools Served</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.routesCovered}</div>
            <div className="text-[11px] text-slate-400 font-medium">Active Routes Covered</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">{stats.activeStudents}</div>
            <div className="text-[11px] text-slate-400 font-medium">Active Bus Riders</div>
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="font-bold text-white text-sm">
            Student Roster ({filteredStudents.length} of {students.length})
          </div>
          <div className="text-xs text-slate-400">
            Real-time onSnapshot sync active
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <GraduationCap className="w-8 h-8 mx-auto text-slate-600" />
            <div className="font-semibold text-sm">No students match current filter criteria</div>
            <div className="text-xs text-slate-600">Try clearing search terms or selecting another school</div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">School & Bell</th>
                    <th className="py-3 px-4">Assigned Routes</th>
                    <th className="py-3 px-4">Primary Contact</th>
                    <th className="py-3 px-4">Home Address</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStudents.map((s) => {
                    const primaryContact = s.contacts?.find((c: StudentContact) => c.primaryContact) || s.contacts?.[0];
                    const routeList = s.routes
                      ? s.routes.split(',').map((r: string) => r.trim()).filter(Boolean)
                      : [];

                    return (
                      <tr
                        key={s.id}
                        onClick={() => onSelectStudent(s)}
                        className="hover:bg-slate-800/40 transition cursor-pointer group"
                      >
                        {/* Name & ID */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-400 text-xs">
                              {s.firstName[0]}
                              {s.lastName[0]}
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-sky-400 transition flex items-center space-x-1">
                                <span>{s.studentName}</span>
                                {s.metatBus && (
                                  <span className="text-amber-400 text-xs font-bold" title="Met at Bus">
                                    *
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-1.5 font-mono text-[11px] text-slate-400">
                                <span>ID: {s.studentNo}</span>
                                <span>•</span>
                                <span className="text-indigo-400 font-semibold">Gr. {s.grade}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* School */}
                        <td className="py-3 px-4">
                          <div className="text-slate-200 font-medium flex items-center space-x-1">
                            <SchoolIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">{s.schoolName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            School #{s.schoolId}
                          </div>
                        </td>

                        {/* Routes */}
                        <td className="py-3 px-4">
                          {routeList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {routeList.map((rt: string) => (
                                <span
                                  key={rt}
                                  className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[11px] font-semibold"
                                >
                                  <Bus className="w-3 h-3 mr-1" />
                                  {rt}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">Unassigned</span>
                          )}
                        </td>

                        {/* Primary Contact */}
                        <td className="py-3 px-4">
                          {primaryContact ? (
                            <div className="space-y-0.5">
                              <div className="text-slate-200 font-medium">
                                {primaryContact.contactName}
                                {primaryContact.relationship && (
                                  <span className="text-slate-400 text-[10px] ml-1">
                                    ({primaryContact.relationship})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 pt-0.5">
                                {primaryContact.mobilePhone && (
                                  <a
                                    href={`tel:${primaryContact.mobilePhone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-amber-400 hover:underline font-mono text-[11px] flex items-center space-x-1"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{primaryContact.mobilePhone}</span>
                                  </a>
                                )}
                                {onMessageParent && (primaryContact.mobilePhone || primaryContact.email) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMessageParent({
                                        parentContact: primaryContact.mobilePhone || primaryContact.email || '',
                                        parentName: primaryContact.contactName,
                                        studentId: s.id,
                                        studentName: s.fullName,
                                        busUnitNumber: s.routes ? s.routes.split(',')[0].trim() : '',
                                        routeNo: s.routes || '',
                                        schoolName: s.schoolName,
                                        grade: s.grade,
                                      });
                                    }}
                                    className="text-indigo-400 hover:text-indigo-300 hover:underline font-semibold text-[11px] flex items-center space-x-1"
                                    title="Open operations chat with parent"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>Chat</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">None</span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="py-3 px-4">
                          <div className="text-slate-300 text-[11px] truncate max-w-[200px]" title={s.studentAddress}>
                            {s.studentAddress || 'N/A'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                              s.active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end space-x-1.5 text-slate-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {onEditStudent && (
                              <button
                                onClick={() => onEditStudent(s)}
                                title="Edit student"
                                className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteStudent && (
                              <button
                                onClick={() => onDeleteStudent(s)}
                                title="Delete student profile"
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => onSelectStudent(s)}
                              className="flex items-center space-x-0.5 text-slate-400 hover:text-sky-400 transition"
                            >
                              <span className="text-[11px] hidden sm:inline">Profile</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards Stream */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {filteredStudents.map((s) => {
                const primaryContact = s.contacts?.find((c: StudentContact) => c.primaryContact) || s.contacts?.[0];
                const routeList = s.routes
                  ? s.routes.split(',').map((r: string) => r.trim()).filter(Boolean)
                  : [];

                return (
                  <div
                    key={s.id}
                    onClick={() => onSelectStudent(s)}
                    className="p-4 hover:bg-slate-800/40 active:bg-slate-800/70 transition cursor-pointer space-y-3"
                  >
                    {/* Top: Avatar, Name, MetAtBus, Grade, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-400 text-xs flex-shrink-0">
                          {s.firstName[0]}
                          {s.lastName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center space-x-1.5">
                            <span>{s.studentName}</span>
                            {s.metatBus && (
                              <span className="text-amber-400 text-xs font-bold" title="Must be met at bus">
                                *
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1.5 font-mono text-[11px] text-slate-400 mt-0.5">
                            <span>ID: {s.studentNo}</span>
                            <span>•</span>
                            <span className="text-indigo-400 font-semibold">Gr. {s.grade}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                          s.active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* School & Route Tags */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center space-x-1 text-slate-300 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60 max-w-[220px] truncate">
                        <SchoolIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{s.schoolName}</span>
                      </div>

                      {routeList.length > 0 ? (
                        routeList.map((rt: string) => (
                          <span
                            key={rt}
                            className="inline-flex items-center px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[11px] font-semibold"
                          >
                            <Bus className="w-3 h-3 mr-1" />
                            {rt}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-[11px] italic bg-slate-800/50 px-2 py-1 rounded-lg">
                          No Route Assigned
                        </span>
                      )}
                    </div>

                    {/* Contact & Profile Action */}
                    <div
                      className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center space-x-2">
                        {primaryContact && primaryContact.mobilePhone ? (
                          <a
                            href={`tel:${primaryContact.mobilePhone}`}
                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg font-mono font-medium transition active:scale-95"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{primaryContact.contactName || 'Parent'}: {primaryContact.mobilePhone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 text-xs italic">
                            {primaryContact ? primaryContact.contactName : 'No contact registered'}
                          </span>
                        )}
                        {onMessageParent && primaryContact && (primaryContact.mobilePhone || primaryContact.email) && (
                          <button
                            type="button"
                            onClick={() => {
                              onMessageParent({
                                parentContact: primaryContact.mobilePhone || primaryContact.email || '',
                                parentName: primaryContact.contactName,
                                studentId: s.id,
                                studentName: s.fullName,
                                busUnitNumber: s.routes ? s.routes.split(',')[0].trim() : '',
                                routeNo: s.routes || '',
                                schoolName: s.schoolName,
                                grade: s.grade,
                              });
                            }}
                            className="flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-xs font-semibold transition"
                            title="Chat with Parent"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        {onEditStudent && (
                          <button
                            type="button"
                            onClick={() => onEditStudent(s)}
                            className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-slate-800 transition"
                            title="Edit student"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectStudent(s)}
                          className="flex items-center space-x-1 text-slate-400 hover:text-sky-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition text-xs font-semibold"
                        >
                          <span>Profile</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
