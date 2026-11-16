import React, { useState, useMemo, useEffect, useRef, useDeferredValue, Suspense } from 'react';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import {
  Building2,
  Plus,
  RotateCw,
  Search,
  Check,
  GripVertical,
  Bus,
  School as SchoolIcon,
  X,
  Edit3
} from 'lucide-react';
import { Yard } from '../types/yard';
import { BusRoute } from '../types/route';
import { School } from '../types/school';
import { Employee } from '../types/employee';
const YardModal = React.lazy(() =>
  import('../components/yards/YardModal').then((m) => ({ default: m.YardModal }))
);
const YardDetailView = React.lazy(() =>
  import('../components/yards/YardDetailView').then((m) => ({ default: m.YardDetailView }))
);
import { YardService } from '../services/yardService';

interface YardListViewProps {
  yards: Yard[];
  routes: BusRoute[];
  schools: School[];
  employees: Employee[];
  loading?: boolean;
  onRefresh?: () => void;
  onRoutesUpdate?: () => void;
  onSchoolsUpdate?: () => void;
  onYardsUpdate?: () => void;
}

export const YardListView: React.FC<YardListViewProps> = ({
  yards,
  routes,
  schools,
  employees,
  loading = false,
  onRefresh,
  onRoutesUpdate,
  onSchoolsUpdate,
  onYardsUpdate,
}) => {
  const [assignmentMode, setAssignmentMode] = useState<'routes' | 'schools'>('routes');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingYard, setEditingYard] = useState<Yard | null>(null);
  const [viewingDetailYard, setViewingDetailYard] = useState<Yard | null>(null);
  const [activeDragOverYardId, setActiveDragOverYardId] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Local state for instant optimistic UI responsiveness
  const [localRoutes, setLocalRoutes] = useState<BusRoute[]>(routes);
  const [localSchools, setLocalSchools] = useState<School[]>(schools);

  useEffect(() => {
    setLocalRoutes(routes);
  }, [routes]);

  useEffect(() => {
    setLocalSchools(schools);
  }, [schools]);

  // Robust drag reference to prevent browser dataTransfer sanitization issues
  const draggedItemRef = useRef<{ type: 'route' | 'school'; id: string | number } | null>(null);

  // Pre-index yards by ID and lowercase name for O(1) matching
  const { yardsByYardId, yardsByNameLower, assignedYardIdsSet, assignedYardNamesLowerSet } = useMemo(() => {
    const byId = new Map<number, Yard>();
    const byName = new Map<string, Yard>();
    const idSet = new Set<number>();
    const nameSet = new Set<string>();

    for (const y of yards) {
      if (y.yardId !== undefined && y.yardId !== null) {
        const numId = Number(y.yardId);
        byId.set(numId, y);
        idSet.add(numId);
      }
      if (y.name) {
        const lower = y.name.trim().toLowerCase();
        byName.set(lower, y);
        nameSet.add(lower);
      }
    }
    return {
      yardsByYardId: byId,
      yardsByNameLower: byName,
      assignedYardIdsSet: idSet,
      assignedYardNamesLowerSet: nameSet,
    };
  }, [yards]);

  // Map routes by yard
  const routesByYard = useMemo(() => {
    const map: Record<string, BusRoute[]> = {};
    for (const y of yards) {
      map[y.id] = [];
    }

    for (const r of localRoutes) {
      let matchedYard: Yard | undefined;
      if (r.yardId !== undefined && r.yardId !== null) {
        matchedYard = yardsByYardId.get(Number(r.yardId));
      }
      if (!matchedYard && r.yardName) {
        matchedYard = yardsByNameLower.get(r.yardName.trim().toLowerCase());
      }
      if (matchedYard) {
        map[matchedYard.id]?.push(r);
      }
    }
    return map;
  }, [yards, localRoutes, yardsByYardId, yardsByNameLower]);

  // Map schools by yard
  const schoolsByYard = useMemo(() => {
    const map: Record<string, School[]> = {};
    for (const y of yards) {
      map[y.id] = [];
    }

    for (const s of localSchools) {
      if (s.yardId !== undefined && s.yardId !== null && Number(s.yardId) > 0) {
        const matchedYard = yardsByYardId.get(Number(s.yardId));
        if (matchedYard) {
          map[matchedYard.id]?.push(s);
        }
      }
    }
    return map;
  }, [yards, localSchools, yardsByYardId]);

  // Filtered sidebar items (sorted with Unassigned items at top)
  const sidebarItems = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();

    if (assignmentMode === 'routes') {
      const list = localRoutes.filter((r) => {
        if (!term) return true;
        return (
          r.routeNo.toLowerCase().includes(term) ||
          r.routeName.toLowerCase().includes(term) ||
          (r.yardName && r.yardName.toLowerCase().includes(term))
        );
      });

      return list.sort((a, b) => {
        const aAssigned =
          (a.yardId !== undefined && assignedYardIdsSet.has(Number(a.yardId))) ||
          (a.yardName ? assignedYardNamesLowerSet.has(a.yardName.toLowerCase()) : false);
        const bAssigned =
          (b.yardId !== undefined && assignedYardIdsSet.has(Number(b.yardId))) ||
          (b.yardName ? assignedYardNamesLowerSet.has(b.yardName.toLowerCase()) : false);
        if (!aAssigned && bAssigned) return -1;
        if (aAssigned && !bAssigned) return 1;
        return a.routeNo.localeCompare(b.routeNo);
      });
    } else {
      const list = localSchools.filter((s) => {
        if (!term) return true;
        return (
          s.schoolName.toLowerCase().includes(term) ||
          (s.schoolBoardName && s.schoolBoardName.toLowerCase().includes(term)) ||
          (s.schoolBoardCode && s.schoolBoardCode.toLowerCase().includes(term)) ||
          String(s.schoolId).includes(term)
        );
      });

      return list.sort((a, b) => {
        const aAssigned = a.yardId !== undefined && Number(a.yardId) > 0 && assignedYardIdsSet.has(Number(a.yardId));
        const bAssigned = b.yardId !== undefined && Number(b.yardId) > 0 && assignedYardIdsSet.has(Number(b.yardId));
        if (!aAssigned && bAssigned) return -1;
        if (aAssigned && !bAssigned) return 1;
        return a.schoolName.localeCompare(b.schoolName);
      });
    }
  }, [assignmentMode, localRoutes, localSchools, assignedYardIdsSet, assignedYardNamesLowerSet, deferredSearchTerm]);

  // Helper to match routes belonging to a school
  const isRouteServicingSchool = (route: BusRoute, school?: School) => {
    if (!school) return false;
    const schName = (school.schoolName || '').trim().toLowerCase();
    if (schName && route.routeName && route.routeName.toLowerCase().includes(schName)) {
      return true;
    }
    if (route.shifts && Array.isArray(route.shifts)) {
      return route.shifts.some((s) => {
        const serviced = (s.schoolsServiced || '').toLowerCase();
        return schName && serviced.includes(schName);
      });
    }
    return false;
  };

  // Direct assignment handlers
  const handleAssignRouteDirectly = async (targetYard: Yard, routeId: string) => {
    // 1. Optimistic UI update
    setLocalRoutes((prev) =>
      prev.map((r) =>
        r.id === routeId ? { ...r, yardId: targetYard.yardId, yardName: targetYard.name } : r
      )
    );

    // 2. Persist to API
    setAssignmentError(null);
    try {
      await YardService.assignRoute(targetYard.yardId, targetYard.name, routeId);
      if (onRoutesUpdate) onRoutesUpdate();
    } catch (err) {
      console.error('Failed to assign route to yard:', err);
      setLocalRoutes(routes); // Revert
      setAssignmentError('Failed to save route assignment. Please try again.');
    }
  };

  const handleAssignSchoolDirectly = async (targetYard: Yard, schoolId: string | number) => {
    const sId = String(schoolId);
    const targetSchool = localSchools.find(
      (s) => String(s.schoolId) === sId || String(s.id) === sId
    );

    // 1. Optimistic UI update: assign school AND cascade to all matching routes
    setLocalSchools((prev) =>
      prev.map((s) =>
        String(s.schoolId) === sId || String(s.id) === sId ? { ...s, yardId: targetYard.yardId } : s
      )
    );
    setLocalRoutes((prev) =>
      prev.map((r) =>
        isRouteServicingSchool(r, targetSchool)
          ? { ...r, yardId: targetYard.yardId, yardName: targetYard.name }
          : r
      )
    );

    // 2. Persist to API
    setAssignmentError(null);
    try {
      const res = await YardService.assignSchool(targetYard.yardId, sId, targetYard.name);
      if (res?.affectedRoutes && res.affectedRoutes.length > 0) {
        const affectedSet = new Set(res.affectedRoutes);
        setLocalRoutes((prev) =>
          prev.map((r) =>
            affectedSet.has(r.id)
              ? { ...r, yardId: targetYard.yardId, yardName: targetYard.name }
              : r
          )
        );
      }
      if (onSchoolsUpdate) onSchoolsUpdate();
      if (onRoutesUpdate) onRoutesUpdate();
    } catch (err) {
      console.error('Failed to assign school to yard:', err);
      setLocalSchools(schools); // Revert
      setLocalRoutes(routes);   // Revert
      setAssignmentError('Failed to save school assignment. Please try again.');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, type: 'route' | 'school', id: string | number) => {
    draggedItemRef.current = { type, id };
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, yardId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDragOverYardId !== yardId) {
      setActiveDragOverYardId(yardId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, yardId: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    if (activeDragOverYardId === yardId) {
      setActiveDragOverYardId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetYard: Yard) => {
    e.preventDefault();
    setActiveDragOverYardId(null);

    let item = draggedItemRef.current;
    if (!item) {
      try {
        const dataStr = e.dataTransfer.getData('text/plain');
        if (dataStr) {
          item = JSON.parse(dataStr);
        }
      } catch {
        // ignore
      }
    }
    draggedItemRef.current = null;
    if (!item) return;

    if (item.type === 'route') {
      await handleAssignRouteDirectly(targetYard, String(item.id));
    } else if (item.type === 'school') {
      await handleAssignSchoolDirectly(targetYard, item.id);
    }
  };

  // Quick unassign handlers
  const handleUnassignRoute = async (routeId: string) => {
    setLocalRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, yardId: 0, yardName: '' } : r))
    );
    try {
      await YardService.unassignRoute(routeId);
      if (onRoutesUpdate) onRoutesUpdate();
    } catch (err) {
      console.error('Failed to unassign route:', err);
      setLocalRoutes(routes);
    }
  };

  const handleUnassignSchool = async (schoolId: string | number) => {
    const sId = String(schoolId);
    const targetSchool = localSchools.find(
      (s) => String(s.schoolId) === sId || String(s.id) === sId
    );

    // Optimistic UI update: unassign school AND its routes
    setLocalSchools((prev) =>
      prev.map((s) =>
        String(s.schoolId) === sId || String(s.id) === sId ? { ...s, yardId: undefined } : s
      )
    );
    setLocalRoutes((prev) =>
      prev.map((r) =>
        isRouteServicingSchool(r, targetSchool)
          ? { ...r, yardId: 0, yardName: '' }
          : r
      )
    );

    try {
      const res = await YardService.unassignSchool(sId);
      if (res?.affectedRoutes && res.affectedRoutes.length > 0) {
        const affectedSet = new Set(res.affectedRoutes);
        setLocalRoutes((prev) =>
          prev.map((r) =>
            affectedSet.has(r.id)
              ? { ...r, yardId: 0, yardName: '' }
              : r
          )
        );
      }
      if (onSchoolsUpdate) onSchoolsUpdate();
      if (onRoutesUpdate) onRoutesUpdate();
    } catch (err) {
      console.error('Failed to unassign school:', err);
      setLocalSchools(schools);
      setLocalRoutes(routes);
    }
  };

  // Yard create & edit handlers
  const handleOpenAddYard = () => {
    setEditingYard(null);
    setIsModalOpen(true);
  };

  const handleOpenEditYard = (yard: Yard) => {
    setEditingYard(yard);
    setIsModalOpen(true);
  };

  const handleSaveYard = async (payload: any) => {
    if (editingYard) {
      await YardService.update(editingYard.id, payload);
    } else {
      await YardService.create(payload);
    }
    if (onYardsUpdate) onYardsUpdate();
    if (onRefresh) onRefresh();
  };

  if (viewingDetailYard) {
    const currentDetailYard = yards.find((y) => y.id === viewingDetailYard.id) || viewingDetailYard;
    return (
      <Suspense fallback={null}>
        <YardDetailView
          yard={currentDetailYard}
          assignedRoutes={routesByYard[currentDetailYard.id] || []}
          assignedSchools={schoolsByYard[currentDetailYard.id] || []}
          onBack={() => setViewingDetailYard(null)}
          onEdit={(y) => {
            setEditingYard(y);
            setIsModalOpen(true);
          }}
        />
      </Suspense>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Yards"
        subtitle="Drag & drop Schools or Bus Routes to assign them to Yards."
        actions={
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleOpenAddYard}
              className="inline-flex items-center space-x-2 px-4 py-2 min-h-[36px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <Plus className="w-4 h-4 stroke-[3]" aria-hidden="true" />
              <span>Add Yard</span>
            </button>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh yards"
                className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                title="Refresh Yards"
              >
                <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            )}
          </div>
        }
      />

      {assignmentError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between"
        >
          <span>{assignmentError}</span>
          <button
            type="button"
            onClick={() => setAssignmentError(null)}
            aria-label="Dismiss assignment error"
            className="p-1 min-w-[24px] min-h-[24px] flex items-center justify-center rounded text-rose-500 hover:text-rose-300 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Main Two-Column Drag & Drop Area */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left Column: Yard Cards */}
        <div className="flex-1 w-full space-y-4">
          {yards.map((yard) => {
            const yardRoutes = routesByYard[yard.id] || [];
            const yardSchools = schoolsByYard[yard.id] || [];
            const countLabel =
              assignmentMode === 'routes'
                ? `${yardRoutes.length} Routes`
                : `${yardSchools.length} Schools (${yardRoutes.length} Routes)`;
            const isDragOver = activeDragOverYardId === yard.id;

            return (
              <div
                key={yard.id}
                onDragOver={(e) => handleDragOver(e, yard.id)}
                onDragLeave={(e) => handleDragLeave(e, yard.id)}
                onDrop={(e) => handleDrop(e, yard)}
                className={`bg-slate-900 rounded-2xl border transition-all shadow-xs p-5 space-y-4 ${
                  isDragOver
                    ? 'border-2 border-dashed border-amber-500  shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-800 hover:border-slate-300 hover:border-slate-700'
                }`}
              >
                {/* Yard Card Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                        <Building2 className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <h2 className="text-base font-bold font-serif text-slate-200">
                        <button
                          type="button"
                          onClick={() => setViewingDetailYard(yard)}
                          aria-label={`View details for ${yard.name}`}
                          className="text-left hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                        >
                          {yard.name}
                        </button>
                      </h2>
                    </div>
                    <div className="text-xs text-slate-500 pl-9.5">
                      <span>Supervisor: </span>
                      <span className="font-semibold text-slate-300">
                        {yard.supervisorName || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Count Pill */}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border font-mono">
                      {countLabel}
                    </span>

                    {/* Status Pill */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        yard.isActive
                          ? '  '
                          : '  '
                      }`}
                    >
                      {yard.isActive ? 'Active' : 'Inactive'}
                    </span>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditYard(yard)}
                      aria-label={`Edit ${yard.name}`}
                      title={`Edit ${yard.name}`}
                      className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                    >
                      <Edit3 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Drop Zone with Assigned Chips */}
                <div
                  onDragOver={(e) => handleDragOver(e, yard.id)}
                  onDrop={(e) => handleDrop(e, yard)}
                  className="pt-1 min-h-[48px]"
                >
                  {assignmentMode === 'routes' ? (
                    yardRoutes.length === 0 ? (
                      <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                        No routes assigned. Drag routes from the panel on the right.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        {yardRoutes.map((rt) => (
                          <div
                            key={rt.id}
                            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-xs font-semibold shadow-xs"
                          >
                            <Bus className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                            <span>{rt.routeNo}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnassignRoute(rt.id);
                              }}
                              aria-label={`Unassign ${rt.routeNo} from ${yard.name}`}
                              title={`Unassign ${rt.routeNo} from ${yard.name}`}
                              className="ml-1 min-w-[24px] min-h-[24px] flex items-center justify-center rounded-full hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                            >
                              <X className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : yardSchools.length === 0 ? (
                    <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                      No schools assigned. Drag schools from the panel on the right.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {yardSchools.map((sch) => (
                        <div
                          key={sch.schoolId}
                          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-xs font-semibold shadow-xs"
                        >
                          <SchoolIcon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                          <span>{sch.schoolName}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnassignSchool(sch.id || sch.schoolId);
                            }}
                            aria-label={`Unassign ${sch.schoolName} from ${yard.name}`}
                            title={`Unassign ${sch.schoolName} from ${yard.name}`}
                            className="ml-1 min-w-[24px] min-h-[24px] flex items-center justify-center rounded-full hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                          >
                            <X className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Draggable Sidebar */}
        <div className="w-full lg:w-96 shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 sticky top-4">
          {/* Segmented Control matching media_1790343043597.png */}
          <div
            role="tablist"
            aria-label="Assignment mode"
            className="grid grid-cols-2 rounded-xl p-1 bg-slate-800 border border-slate-700 text-xs font-semibold"
          >
            <button
              type="button"
              role="tab"
              aria-selected={assignmentMode === 'schools'}
              onClick={() => setAssignmentMode('schools')}
              className={`py-2 px-3 min-h-[32px] rounded-lg flex items-center justify-center space-x-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                assignmentMode === 'schools'
                  ? 'bg-[#d8a427] text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {assignmentMode === 'schools' && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />}
              <span>By School</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={assignmentMode === 'routes'}
              onClick={() => setAssignmentMode('routes')}
              className={`py-2 px-3 min-h-[32px] rounded-lg flex items-center justify-center space-x-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                assignmentMode === 'routes'
                  ? 'bg-[#d8a427] text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {assignmentMode === 'routes' && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />}
              <span>By Bus Route</span>
            </button>
          </div>

          {/* Search Box */}
          <search aria-label="Search routes or schools to assign" className="block relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              aria-label={assignmentMode === 'routes' ? 'Search route number' : 'Search school name'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                assignmentMode === 'routes'
                  ? 'Search route number...'
                  : 'Search school name...'
              }
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-[#2c3e50] focus:ring-slate-500 shadow-xs"
            />
          </search>

          {/* Helper caption */}
          <p className="text-[11px] text-slate-400 italic">
            Unassigned items are listed at the top. Drag an item to a Yard on the left, or use the menu on the right.
          </p>

          {/* Draggable List */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {sidebarItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                No matching items found.
              </div>
            ) : (
              sidebarItems.map((item: any) => {
                const isRoute = assignmentMode === 'routes';
                const id = isRoute ? item.id : item.id || item.schoolId;
                const title = isRoute ? item.routeNo : item.schoolName;
                const subtitle = isRoute
                  ? item.routeName
                  : `${item.schoolBoardName || item.schoolBoardCode || 'Public School'}`;

                // Check assignment status
                const assignedYard = isRoute
                  ? yards.find(
                      (y) =>
                        Number(y.yardId) === Number(item.yardId) ||
                        (item.yardName && y.name.toLowerCase() === item.yardName.toLowerCase())
                    )
                  : yards.find((y) => Number(y.yardId) === Number(item.yardId) && Number(item.yardId) > 0);

                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, isRoute ? 'route' : 'school', id)}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-800/80 hover:bg-slate-800 hover:border-slate-300 hover:border-slate-700 transition cursor-grab active:cursor-grabbing flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <GripVertical className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center space-x-1.5">
                      {/* Interactive Quick Assign Selector */}
                      <select
                        aria-label={`Assign ${title} to yard`}
                        value={assignedYard ? assignedYard.id : ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          const targetId = e.target.value;
                          const target = yards.find((y) => y.id === targetId);
                          if (target) {
                            if (isRoute) {
                              handleAssignRouteDirectly(target, id);
                            } else {
                              handleAssignSchoolDirectly(target, id);
                            }
                          } else {
                            if (isRoute) {
                              handleUnassignRoute(id);
                            } else {
                              handleUnassignSchool(id);
                            }
                          }
                        }}
                        className={`text-base sm:text-[10px] font-semibold py-1 px-2 rounded-lg border focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer transition ${
                          assignedYard
                            ? 'bg-slate-700 text-slate-300 border-slate-600'
                            : 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'
                        }`}
                      >
                        <option value="">Unassigned</option>
                        {yards.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Yard Edit / Add Modal */}
      {isModalOpen && (
        <Suspense fallback={null}>
          <YardModal
            isOpen={isModalOpen}
            yard={editingYard}
            employees={employees}
            onClose={() => {
              setIsModalOpen(false);
              setEditingYard(null);
            }}
            onSave={handleSaveYard}
          />
        </Suspense>
      )}
    </PageShell>
  );
};


