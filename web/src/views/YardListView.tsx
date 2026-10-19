import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { YardModal } from '../components/yards/YardModal';
import { YardDetailView } from '../components/yards/YardDetailView';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingYard, setEditingYard] = useState<Yard | null>(null);
  const [viewingDetailYard, setViewingDetailYard] = useState<Yard | null>(null);
  const [activeDragOverYardId, setActiveDragOverYardId] = useState<string | null>(null);

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

  // Map routes by yard
  const routesByYard = useMemo(() => {
    const map: Record<string, BusRoute[]> = {};
    yards.forEach((y) => {
      map[y.id] = [];
    });

    localRoutes.forEach((r) => {
      const matchedYard = yards.find(
        (y) =>
          Number(y.yardId) === Number(r.yardId) ||
          (r.yardName && y.name && y.name.trim().toLowerCase() === r.yardName.trim().toLowerCase())
      );
      if (matchedYard) {
        if (!map[matchedYard.id]) map[matchedYard.id] = [];
        map[matchedYard.id].push(r);
      }
    });
    return map;
  }, [yards, localRoutes]);

  // Map schools by yard
  const schoolsByYard = useMemo(() => {
    const map: Record<string, School[]> = {};
    yards.forEach((y) => {
      map[y.id] = [];
    });

    localSchools.forEach((s) => {
      if (s.yardId !== undefined && s.yardId !== null && Number(s.yardId) > 0) {
        const matchedYard = yards.find((y) => Number(y.yardId) === Number(s.yardId));
        if (matchedYard) {
          if (!map[matchedYard.id]) map[matchedYard.id] = [];
          map[matchedYard.id].push(s);
        }
      }
    });
    return map;
  }, [yards, localSchools]);

  // Filtered sidebar items (sorted with Unassigned items at top)
  const sidebarItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

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
        const aAssigned = yards.some(
          (y) =>
            Number(y.yardId) === Number(a.yardId) ||
            (a.yardName && y.name.toLowerCase() === a.yardName.toLowerCase())
        );
        const bAssigned = yards.some(
          (y) =>
            Number(y.yardId) === Number(b.yardId) ||
            (b.yardName && y.name.toLowerCase() === b.yardName.toLowerCase())
        );
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
        const aAssigned = yards.some((y) => Number(y.yardId) === Number(a.yardId) && Number(a.yardId) > 0);
        const bAssigned = yards.some((y) => Number(y.yardId) === Number(b.yardId) && Number(b.yardId) > 0);
        if (!aAssigned && bAssigned) return -1;
        if (aAssigned && !bAssigned) return 1;
        return a.schoolName.localeCompare(b.schoolName);
      });
    }
  }, [assignmentMode, localRoutes, localSchools, yards, searchTerm]);

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
    try {
      await YardService.assignRoute(targetYard.yardId, targetYard.name, routeId);
      if (onRoutesUpdate) onRoutesUpdate();
    } catch (err) {
      console.error('Failed to assign route to yard:', err);
      setLocalRoutes(routes); // Revert
      alert('Failed to save route assignment. Please try again.');
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
      alert('Failed to save school assignment. Please try again.');
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header matching media_1790343043597.png */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-slate-900 dark:text-white tracking-tight">
            Yards
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Drag & drop Schools or Bus Routes to assign them to Yards.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleOpenAddYard}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#2c3e50] hover:bg-[#1a252f] text-white text-xs font-serif font-bold shadow transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Yard</span>
          </button>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition shadow-xs"
              title="Refresh Yards"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

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
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all shadow-xs p-5 space-y-4 ${
                  isDragOver
                    ? 'border-2 border-dashed border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Yard Card Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h2
                        onClick={() => setViewingDetailYard(yard)}
                        className="text-base font-bold font-serif text-slate-900 dark:text-white cursor-pointer hover:underline"
                      >
                        {yard.name}
                      </h2>
                    </div>
                    <div className="text-xs text-slate-500 pl-9.5">
                      <span>Supervisor: </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {yard.supervisorName || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Count Pill */}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 border border-sky-200/60 dark:border-sky-900 font-mono">
                      {countLabel}
                    </span>

                    {/* Status Pill */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        yard.isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900'
                      }`}
                    >
                      {yard.isActive ? 'Active' : 'Inactive'}
                    </span>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditYard(yard)}
                      title={`Edit ${yard.name}`}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Edit3 className="w-4 h-4" />
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
                      <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                        No routes assigned. Drag routes from the panel on the right.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        {yardRoutes.map((rt) => (
                          <div
                            key={rt.id}
                            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs"
                          >
                            <Bus className="w-3.5 h-3.5 text-slate-400" />
                            <span>{rt.routeNo}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnassignRoute(rt.id);
                              }}
                              title={`Unassign ${rt.routeNo} from ${yard.name}`}
                              className="ml-1 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition"
                            >
                              <X className="w-3 h-3 stroke-[2.5]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : yardSchools.length === 0 ? (
                    <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                      No schools assigned. Drag schools from the panel on the right.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {yardSchools.map((sch) => (
                        <div
                          key={sch.schoolId}
                          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs"
                        >
                          <SchoolIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{sch.schoolName}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnassignSchool(sch.id || sch.schoolId);
                            }}
                            title={`Unassign ${sch.schoolName} from ${yard.name}`}
                            className="ml-1 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition"
                          >
                            <X className="w-3 h-3 stroke-[2.5]" />
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
        <div className="w-full lg:w-96 shrink-0 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 sticky top-4">
          {/* Segmented Control matching media_1790343043597.png */}
          <div className="grid grid-cols-2 rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAssignmentMode('schools')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
                assignmentMode === 'schools'
                  ? 'bg-[#d8a427] text-slate-950 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {assignmentMode === 'schools' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              <span>By School</span>
            </button>
            <button
              type="button"
              onClick={() => setAssignmentMode('routes')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
                assignmentMode === 'routes'
                  ? 'bg-[#d8a427] text-slate-950 font-bold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {assignmentMode === 'routes' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              <span>By Bus Route</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                assignmentMode === 'routes'
                  ? 'Search route number...'
                  : 'Search school name...'
              }
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#2c3e50] dark:focus:ring-slate-500 shadow-xs"
            />
          </div>

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
                    className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition cursor-grab active:cursor-grabbing flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
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
                        className={`text-[10px] font-semibold py-1 px-2 rounded-lg border focus:outline-none cursor-pointer transition ${
                          assignedYard
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
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
    </div>
  );
};
