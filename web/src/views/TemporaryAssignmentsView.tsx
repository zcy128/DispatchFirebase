import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Users,
  Briefcase,
  Radio,
  Send,
  Eye,
  Award,
  Check
} from 'lucide-react';
import { TemporaryAssignment } from '../types/dispatch';
import { BusRoute } from '../types/route';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import { RouteOpening, SanitizedStopPreview } from '../types/routeOpening';
import { CharterTrip, formatCharterStopTime, addMinutesToCharterTime } from '../types/charter';
import { DispatchService } from '../services/dispatchService';
import { RouteOpeningService } from '../services/routeOpeningService';
import { CharterService } from '../services/charterService';
import { TemporaryAssignmentModal } from '../components/dispatch/TemporaryAssignmentModal';
import { RouteOpeningCreateModal } from '../components/dispatch/RouteOpeningCreateModal';
import { RouteOpeningStopPreviewModal } from '../components/dispatch/RouteOpeningStopPreviewModal';
import { RouteOpeningApplyModal } from '../components/dispatch/RouteOpeningApplyModal';
import { RouteOpeningApplicantsDrawer } from '../components/dispatch/RouteOpeningApplicantsDrawer';
import { getLocalTodayString } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

interface TemporaryAssignmentsViewProps {
  routes: BusRoute[];
  employees: Employee[];
  vehicles: Vehicle[];
}

export const TemporaryAssignmentsView: React.FC<TemporaryAssignmentsViewProps> = ({
  routes,
  employees,
  vehicles
}) => {
  const { currentUser } = useAuth();
  const { t } = useI18n();

  // Role permissions check
  const userRole = (currentUser?.role || '').toLowerCase();
  const canManage = ['admin', 'manager', 'dispatcher', 'supervisor'].some((r) => userRole.includes(r));

  // Current logged in employee record
  const currentEmployee = useMemo(() => {
    if (!currentUser) return null;
    return (
      employees.find((e) => {
        if (e.id === currentUser.employeeId || e.id === currentUser.uid) return true;
        if (e.employeeNumber && e.employeeNumber === currentUser.employeeId) return true;
        const empEmail = (e.personalEmail || e.workEmail || e.preferredEmail || '').toLowerCase();
        const userEmail = (currentUser.email || '').toLowerCase();
        return empEmail && userEmail && empEmail === userEmail;
      }) || null
    );
  }, [currentUser, employees]);

  // Primary Tab: 'openings' (Openings & Bidding Board) vs 'covers' (Active Shift Covers)
  const [activeTab, setActiveTab] = useState<'openings' | 'covers'>('openings');

  // ==========================================
  // 1. Route Openings & Bidding State
  // ==========================================
  const [openings, setOpenings] = useState<RouteOpening[]>([]);
  const [charterTrips, setCharterTrips] = useState<CharterTrip[]>([]);
  const [openingsLoading, setOpeningsLoading] = useState<boolean>(true);
  const [openingSearch, setOpeningSearch] = useState<string>('');
  const [openingTypeFilter, setOpeningTypeFilter] = useState<'all' | 'permanent' | 'temporary' | 'charter'>('all');
  const [openingStatusFilter, setOpeningStatusFilter] = useState<'all' | 'open' | 'reviewing' | 'awarded'>('all');

  // Openings Modals
  const [isCreateOpeningModalOpen, setIsCreateOpeningModalOpen] = useState<boolean>(false);
  const [inspectingOpening, setInspectingOpening] = useState<RouteOpening | null>(null);
  const [applyingOpening, setApplyingOpening] = useState<RouteOpening | null>(null);
  const [reviewingOpening, setReviewingOpening] = useState<RouteOpening | null>(null);

  // Subscribe to route openings & charter trips
  useEffect(() => {
    setOpeningsLoading(true);
    const unsubscribe = RouteOpeningService.subscribeToOpenings(
      (data) => {
        setOpenings(Array.isArray(data) ? data : []);
        setOpeningsLoading(false);
      },
      (err) => {
        console.error('[OpeningsView] Subscription error:', err);
        setOpeningsLoading(false);
      }
    );
    const unsubCharters = CharterService.subscribeToTrips(
      (trips) => setCharterTrips(Array.isArray(trips) ? trips : []),
      () => {}
    );
    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubCharters) unsubCharters();
    };
  }, []);

  const charterTripsById = useMemo(() => {
    const map: Record<string, CharterTrip> = {};
    charterTrips.forEach((tr) => {
      map[tr.id] = tr;
    });
    return map;
  }, [charterTrips]);

  // Resolves the full 4-stop itinerary for Charter openings (or sanitizedStops for route openings)
  const resolveOpeningDisplayStops = (op: RouteOpening): SanitizedStopPreview[] => {
    if (op.postingType === 'charter') {
      const trip = charterTripsById[op.charterTripId || op.routeId];
      const depTime = formatCharterStopTime(trip?.departsAt || op.departsAt) || '08:00';
      const retTime = formatCharterStopTime(trip?.returnsAt || op.returnsAt) || '15:00';

      if (trip && trip.stops && trip.stops.length > 0) {
        if (trip.roundTrip !== false && trip.stops.length === 3) {
          const s0 = trip.stops[0];
          const s1 = trip.stops[1];
          const s2 = trip.stops[2];
          const t0 = formatCharterStopTime(s0.scheduledAt) || depTime;
          const t1 = addMinutesToCharterTime(t0, 30);
          const t2 = formatCharterStopTime(s2.scheduledAt) || retTime;
          const t3 = addMinutesToCharterTime(t2, 30);
          return [
            {
              stopId: s0.id || 'stop-1',
              sequence: 1,
              stopLocation: `Pickup: ${s0.address || 'School'}`,
              stopScheduleTime: t0,
              stopType: 'CharterPickup',
            },
            {
              stopId: s1.id || 'stop-2',
              sequence: 2,
              stopLocation: `Dropoff: ${s1.address || 'Museum'}`,
              stopScheduleTime: t1,
              stopType: 'CharterDestination',
            },
            {
              stopId: 'stop-3',
              sequence: 3,
              stopLocation: `Return Pickup: ${s1.address || 'Library'}`,
              stopScheduleTime: t2,
              stopType: 'CharterPickup',
            },
            {
              stopId: s2.id || 'stop-4',
              sequence: 4,
              stopLocation: `Return Dropoff: ${s2.address || s0.address || 'School'}`,
              stopScheduleTime: t3,
              stopType: 'CharterReturn',
            },
          ];
        }
        return trip.stops.map((s, idx) => {
          const actionLabel =
            s.stopType === 0
              ? 'Pickup'
              : s.stopType === 1
              ? 'Dropoff'
              : s.stopType === 3
              ? 'Return Pickup'
              : 'Return Dropoff';
          const fallbackT =
            idx === 0
              ? depTime
              : idx === 1
              ? addMinutesToCharterTime(depTime, 30)
              : idx === 2
              ? retTime
              : addMinutesToCharterTime(retTime, 30);
          return {
            stopId: s.id || `stop-${idx + 1}`,
            sequence: idx + 1,
            stopLocation: `${actionLabel}: ${s.address}`,
            stopScheduleTime: formatCharterStopTime(s.scheduledAt) || fallbackT,
            stopType: s.stopType === 0 || s.stopType === 3 ? 'CharterPickup' : 'CharterReturn',
          };
        });
      }

      if (op.sanitizedStops && op.sanitizedStops.length === 3) {
        const s0 = op.sanitizedStops[0];
        const s1 = op.sanitizedStops[1];
        const s2 = op.sanitizedStops[2];
        const t0 = formatCharterStopTime(s0.stopScheduleTime) || depTime;
        const t1 = addMinutesToCharterTime(t0, 30);
        const t2 = formatCharterStopTime(s2.stopScheduleTime) || retTime;
        const t3 = addMinutesToCharterTime(t2, 30);
        return [
          { ...s0, sequence: 1, stopScheduleTime: t0 },
          {
            ...s1,
            sequence: 2,
            stopLocation: s1.stopLocation.replace(/^Destination/i, 'Dropoff'),
            stopScheduleTime: t1,
          },
          {
            ...s1,
            stopId: 'stop-3',
            sequence: 3,
            stopLocation: s1.stopLocation.replace(/^(Destination|Dropoff)/i, 'Return Pickup'),
            stopScheduleTime: t2,
            stopType: 'CharterPickup',
          },
          {
            ...s2,
            stopId: 'stop-4',
            sequence: 4,
            stopLocation: s2.stopLocation.replace(/^Return/i, 'Return Dropoff'),
            stopScheduleTime: t3,
            stopType: 'CharterReturn',
          },
        ];
      }
    }
    return op.sanitizedStops || [];
  };

  // Helper for deadline countdown
  const getDeadlineStatus = (deadlineStr: string) => {
    const deadlineTime = new Date(deadlineStr).getTime();
    const now = Date.now();
    const diff = deadlineTime - now;

    if (isNaN(deadlineTime) || diff <= 0) {
      return { isPassed: true, label: t.routeOpenings?.deadlinePassed || 'Application Closed', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
    }

    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 1) {
      return { isPassed: false, label: `${diffDays} ${t.routeOpenings?.daysLeft || 'days left'}`, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    }
    return { isPassed: false, label: `${diffHours} ${t.routeOpenings?.hoursLeft || 'hours left'}`, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  };

  // Helper to check if an opening has pending applications under review
  const isOpeningUnderReview = (op: RouteOpening) => {
    if (op.status === 'reviewing') return true;
    return op.status === 'open' && (op.applicants || []).some((a) => a.status === 'pending');
  };

  // Filtered Openings
  const filteredOpenings = useMemo(() => {
    return openings.filter((op) => {
      if (openingTypeFilter !== 'all' && op.postingType !== openingTypeFilter) return false;
      if (openingStatusFilter !== 'all') {
        if (openingStatusFilter === 'reviewing') {
          if (!isOpeningUnderReview(op)) return false;
        } else if (op.status !== openingStatusFilter) {
          return false;
        }
      }

      if (openingSearch.trim()) {
        const q = openingSearch.toLowerCase();
        const matchRoute = op.routeNo.toLowerCase().includes(q);
        const matchName = (op.routeName || '').toLowerCase().includes(q);
        const matchTitle = op.title.toLowerCase().includes(q);
        const matchBoard = (op.schoolBoardCode || '').toLowerCase().includes(q);
        if (!matchRoute && !matchName && !matchTitle && !matchBoard) return false;
      }
      return true;
    });
  }, [openings, openingTypeFilter, openingStatusFilter, openingSearch]);

  // Openings KPIs
  const openingsKpi = useMemo(() => {
    const total = openings.length;
    const openForBidding = openings.filter((o) => o.status === 'open').length;
    const reviewing = openings.filter((o) => isOpeningUnderReview(o)).length;
    const awarded = openings.filter((o) => o.status === 'awarded').length;
    return { total, openForBidding, reviewing, awarded };
  }, [openings]);

  // Handle application withdrawal
  const handleWithdraw = async (openingId: string) => {
    if (!currentEmployee) return;
    if (!window.confirm('Are you sure you want to withdraw your application?')) return;
    try {
      await RouteOpeningService.withdrawApplication(openingId, currentEmployee.id);
    } catch (err: any) {
      console.error('[OpeningsView] Failed to withdraw:', err);
      alert(err?.message || 'Failed to withdraw application.');
    }
  };

  // Delete opening
  const handleDeleteOpening = async (openingId: string) => {
    if (!window.confirm('Are you sure you want to remove this route opening bulletin?')) return;
    try {
      await RouteOpeningService.deleteOpening(openingId);
    } catch (err: any) {
      console.error('[OpeningsView] Delete failed:', err);
      alert(err?.message || 'Failed to delete opening.');
    }
  };

  // ==========================================
  // 2. Existing Temporary Assignments State
  // ==========================================
  const [assignments, setAssignments] = useState<TemporaryAssignment[]>([]);
  const [coversLoading, setCoversLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for covers
  const [coverSearchTerm, setCoverSearchTerm] = useState<string>('');
  const [coverStatusFilter, setCoverStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('active');
  const [coverDateFilter, setCoverDateFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [coverRoleFilter, setCoverRoleFilter] = useState<'all' | 'driver' | 'attendant'>('all');

  // Modal for covers
  const [isCoverModalOpen, setIsCoverModalOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<TemporaryAssignment | null>(null);

  const todayStr = getLocalTodayString();

  // Load and subscribe covers
  const loadCoversData = async () => {
    setCoversLoading(true);
    try {
      const data = await DispatchService.listTemporaryAssignments();
      setAssignments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load temporary assignments:', err);
      setError('Failed to load temporary assignments. Please try again.');
    } finally {
      setCoversLoading(false);
    }
  };

  useEffect(() => {
    loadCoversData();

    const unsubscribe = DispatchService.subscribeToTemporaryAssignments(
      (updated) => {
        setAssignments(Array.isArray(updated) ? updated : []);
        setCoversLoading(false);
      },
      (err) => {
        console.error('Subscription error:', err);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleCreateCover = () => {
    setEditingAssignment(null);
    setIsCoverModalOpen(true);
  };

  const handleEditCover = (assignment: TemporaryAssignment) => {
    setEditingAssignment(assignment);
    setIsCoverModalOpen(true);
  };

  const handleDeleteCover = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this temporary assignment?')) {
      return;
    }
    try {
      await DispatchService.deleteTemporaryAssignment(id);
      setAssignments((prev) => (prev || []).filter((a) => a.id !== id));
    } catch (err: any) {
      console.error('Failed to delete temporary assignment:', err);
      alert('Failed to delete assignment: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleCoverStatusToggle = async (
    assignment: TemporaryAssignment,
    newStatus: 'active' | 'completed' | 'cancelled'
  ) => {
    try {
      await DispatchService.updateTemporaryAssignment(assignment.id, {
        status: newStatus
      });
      setAssignments((prev) =>
        (prev || []).map((a) => (a.id === assignment.id ? { ...a, status: newStatus } : a))
      );
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert('Failed to update status: ' + (err?.message || 'Unknown error'));
    }
  };

  // Filtered covers
  const filteredAssignments = useMemo(() => {
    return (assignments || []).filter((a) => {
      if (coverStatusFilter !== 'all' && a.status !== coverStatusFilter) return false;

      if (coverDateFilter === 'today') {
        const isToday = a.startDate <= todayStr && a.endDate >= todayStr;
        if (!isToday) return false;
      } else if (coverDateFilter === 'upcoming') {
        if (a.startDate <= todayStr) return false;
      } else if (coverDateFilter === 'past') {
        if (a.endDate >= todayStr) return false;
      }

      if (coverRoleFilter === 'driver' && !a.temporaryDriverId) return false;
      if (coverRoleFilter === 'attendant' && !a.temporaryAttendantId) return false;

      if (coverSearchTerm.trim()) {
        const q = coverSearchTerm.toLowerCase();
        const matchRoute = a.routeNo.toLowerCase().includes(q);
        const matchDriver = (a.temporaryDriverName || '').toLowerCase().includes(q);
        const matchAttendant = (a.temporaryAttendantName || '').toLowerCase().includes(q);
        const matchUnit = (a.temporaryUnitNumber || '').toLowerCase().includes(q);
        const matchReason = (a.reason || '').toLowerCase().includes(q);
        if (!matchRoute && !matchDriver && !matchAttendant && !matchUnit && !matchReason) {
          return false;
        }
      }

      return true;
    });
  }, [assignments, coverStatusFilter, coverDateFilter, coverRoleFilter, coverSearchTerm, todayStr]);

  const coversKpis = useMemo(() => {
    const list = assignments || [];
    const activeToday = list.filter((a) => a.status === 'active' && a.startDate <= todayStr && a.endDate >= todayStr).length;
    const upcoming = list.filter((a) => a.status === 'active' && a.startDate > todayStr).length;
    const totalDriverCovers = list.filter((a) => a.temporaryDriverId).length;
    const totalAttendantCovers = list.filter((a) => a.temporaryAttendantId).length;
    return { activeToday, upcoming, totalDriverCovers, totalAttendantCovers };
  }, [assignments, todayStr]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2">
                {t.routeOpenings?.tabTitle || 'Route Openings & Shift Coverage'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.routeOpenings?.tabSub ||
                  'Open bidding board for standing route vacancies and temporary coverage shifts'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher: Openings Board vs Active Shift Covers */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('openings')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'openings'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>{t.routeOpenings?.openingsTab || 'Openings & Bidding Board'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'openings' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {openingsKpi.openForBidding}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('covers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'covers'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>{t.routeOpenings?.coversTab || 'Active Shift Covers'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'covers' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {coversKpis.activeToday}
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ROUTE OPENINGS & BIDDING BOARD                    */}
      {/* ======================================================== */}
      {activeTab === 'openings' && (
        <div className="space-y-6">
          {/* KPI Metrics (Clickable Filters) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setOpeningStatusFilter('all')}
              className={`text-left rounded-2xl p-4 shadow-sm transition-all cursor-pointer border ${
                openingStatusFilter === 'all'
                  ? 'bg-slate-800/90 border-amber-500/60 ring-1 ring-amber-500/40'
                  : 'bg-slate-900/80 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {t.routeOpenings?.activePostings || 'Total Postings'}
                </span>
                {openingStatusFilter === 'all' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Active Filter
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-100 mt-1">{openingsKpi.total}</p>
            </button>

            <button
              type="button"
              onClick={() =>
                setOpeningStatusFilter((prev) => (prev === 'open' ? 'all' : 'open'))
              }
              className={`text-left rounded-2xl p-4 shadow-sm transition-all cursor-pointer border ${
                openingStatusFilter === 'open'
                  ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/80 border-slate-800/80 hover:bg-slate-800/60 hover:border-emerald-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-medium">
                  {t.routeOpenings?.openForBidding || 'Open for Bidding'}
                </span>
                {openingStatusFilter === 'open' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active Filter
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{openingsKpi.openForBidding}</p>
            </button>

            <button
              type="button"
              onClick={() =>
                setOpeningStatusFilter((prev) => (prev === 'reviewing' ? 'all' : 'reviewing'))
              }
              className={`text-left rounded-2xl p-4 shadow-sm transition-all cursor-pointer border ${
                openingStatusFilter === 'reviewing'
                  ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/40'
                  : 'bg-slate-900/80 border-slate-800/80 hover:bg-slate-800/60 hover:border-cyan-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-cyan-400 font-medium">
                  {t.routeOpenings?.pendingReview || 'Under Review'}
                </span>
                {openingStatusFilter === 'reviewing' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Active Filter
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-cyan-400 mt-1">{openingsKpi.reviewing}</p>
            </button>

            <button
              type="button"
              onClick={() =>
                setOpeningStatusFilter((prev) => (prev === 'awarded' ? 'all' : 'awarded'))
              }
              className={`text-left rounded-2xl p-4 shadow-sm transition-all cursor-pointer border ${
                openingStatusFilter === 'awarded'
                  ? 'bg-purple-950/30 border-purple-500/60 ring-1 ring-purple-500/40'
                  : 'bg-slate-900/80 border-slate-800/80 hover:bg-slate-800/60 hover:border-purple-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-purple-400 font-medium">
                  {t.routeOpenings?.awardedCount || 'Awarded Postings'}
                </span>
                {openingStatusFilter === 'awarded' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Active Filter
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-purple-400 mt-1">{openingsKpi.awarded}</p>
            </button>
          </div>

          {/* Search, Filter & Dispatch Post Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search route number, name, board..."
                  value={openingSearch}
                  onChange={(e) => setOpeningSearch(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Type Filter */}
              <select
                value={openingTypeFilter}
                onChange={(e) => setOpeningTypeFilter(e.target.value as any)}
                className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="all">All Categories</option>
                <option value="permanent">Permanent Route</option>
                <option value="temporary">Temporary Route Coverage</option>
                <option value="charter">Charter Trips</option>
              </select>

              {/* Status Filter */}
              <select
                value={openingStatusFilter}
                onChange={(e) => setOpeningStatusFilter(e.target.value as any)}
                className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open for Bidding</option>
                <option value="reviewing">Under Review</option>
                <option value="awarded">Awarded</option>
              </select>
            </div>

            {/* Post Opening Button (Dispatcher / Manager / Admin) */}
            {canManage && (
              <button
                onClick={() => setIsCreateOpeningModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{t.routeOpenings?.postNewOpening || 'Post Route Opening'}</span>
              </button>
            )}
          </div>

          {/* Cards Grid */}
          {openingsLoading ? (
            <div className="py-20 text-center text-slate-400 text-xs animate-pulse">
              Loading route openings board...
            </div>
          ) : filteredOpenings.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
              <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p>No route openings found matching your criteria.</p>
              {canManage && (
                <button
                  onClick={() => setIsCreateOpeningModalOpen(true)}
                  className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Post First Opening
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpenings.map((op) => {
                const isPermanent = op.postingType === 'permanent';
                const deadlineInfo = getDeadlineStatus(op.deadline);
                const applicantCount = op.applicants?.length || 0;

                // Check if current user has already applied
                const myApp = currentEmployee
                  ? op.applicants?.find((a) => a.employeeId === currentEmployee.id)
                  : null;
                const hasApplied = !!myApp && myApp.status !== 'withdrawn';
                const isAwarded = op.status === 'awarded';

                return (
                  <div
                    key={op.id}
                    className={`bg-slate-900/90 border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all hover:border-slate-600 ${
                      isAwarded
                        ? 'border-purple-800/40 opacity-80'
                        : myApp
                        ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {op.routeNo}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              op.postingType === 'charter'
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : isPermanent
                                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                            }`}
                          >
                            {op.postingType === 'charter'
                              ? `Charter Trip${typeof op.openShiftsCount === 'number' ? ` (${op.openShiftsCount}/${op.vehiclesNeeded || 1} Open)` : ''}`
                              : isPermanent
                              ? 'Permanent Run'
                              : 'Temporary Cover'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300">
                            {op.roleNeeded === 'driver'
                              ? 'Driver Needed'
                              : op.roleNeeded === 'attendant'
                              ? 'Attendant Needed'
                              : 'Driver & Attendant'}
                          </span>
                        </div>

                        {/* Deadline Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${deadlineInfo.color}`}
                        >
                          {deadlineInfo.label}
                        </span>
                      </div>

                      {/* Route Title & Details */}
                      <h3 className="font-bold text-sm text-slate-100 mt-3 line-clamp-1">
                        {op.routeName || `Route ${op.routeNo}`}
                      </h3>

                      <div className="mt-2 space-y-1.5 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>
                            {isPermanent ? (
                              <>
                                Effective From: <strong className="text-slate-200">{op.effectiveStartDate}</strong>
                              </>
                            ) : (
                              <>
                                Coverage:{' '}
                                <strong className="text-slate-200">
                                  {op.effectiveStartDate} ~ {op.effectiveEndDate || op.effectiveStartDate}
                                </strong>
                              </>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>
                            Shift:{' '}
                            <strong className="text-slate-200">
                              {op.shiftType === 'ALL' ? 'Morning & Afternoon (AM/PM)' : op.shiftType}
                            </strong>
                          </span>
                        </div>

                        {op.schoolBoardCode && (
                          <div className="text-[11px] text-slate-500">Board: {op.schoolBoardCode}</div>
                        )}
                      </div>

                      {/* Stop Schedule & Time List (for Charter / Sanitized Stops) */}
                      {(() => {
                        const displayStops = resolveOpeningDisplayStops(op);
                        if (!displayStops || displayStops.length === 0) return null;
                        return (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <span>Stop Schedule ({displayStops.length} stops)</span>
                              <span>Time</span>
                            </div>
                            <div className="divide-y divide-slate-800/60 space-y-1">
                              {displayStops.map((st, sIdx) => (
                                <div
                                  key={st.stopId || sIdx}
                                  className="pt-1 first:pt-0 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {st.sequence || sIdx + 1}
                                    </span>
                                    <span className="text-slate-300 truncate" title={st.stopLocation}>
                                      {st.stopLocation}
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold text-cyan-400 shrink-0">
                                    {st.stopScheduleTime || '--:--'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {op.description && (
                        <p className="mt-2.5 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80 line-clamp-2">
                          {op.description}
                        </p>
                      )}

                      {/* Awarded Info if completed */}
                      {isAwarded && (
                        <div className="mt-3 p-2.5 bg-purple-950/40 border border-purple-800/40 rounded-xl text-xs text-purple-300 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              <Award className="w-4 h-4 text-purple-400 shrink-0" />
                              <span>
                                Awarded to:{' '}
                                <strong>
                                  {[op.awardedDriverName, op.awardedAttendantName].filter(Boolean).join(' & ') || 'Selected Candidate'}
                                </strong>
                              </span>
                            </span>
                            {op.postingType === 'permanent' ? (
                              op.crewAppliedToRoute || !op.effectiveStartDate || op.effectiveStartDate <= todayStr ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Crew Applied to Route
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Auto-Updates on {op.effectiveStartDate}
                                </span>
                              )
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  Temporary Cover Active
                                </span>
                                {op.temporaryAssignmentId && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    Direct Cover
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        {/* Confidential Stop Preview Button */}
                        <button
                          onClick={() => setInspectingOpening(op)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Inspect Stops (Confidential)</span>
                        </button>

                        {/* Dispatcher Review Applicants Button */}
                        {canManage ? (
                          <button
                            onClick={() => setReviewingOpening(op)}
                            className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-700/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>
                              Candidates ({applicantCount})
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {applicantCount} applicant{applicantCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>

                      {/* Employee Bidding Button */}
                      {!isAwarded && (
                        <div className="pt-1">
                          {hasApplied ? (
                            <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-xl text-xs">
                              <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                {t.routeOpenings?.appliedBadge || 'Applied (Pending Review)'}
                              </span>
                              {!deadlineInfo.isPassed && (
                                <button
                                  onClick={() => handleWithdraw(op.id)}
                                  className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                                >
                                  Withdraw
                                </button>
                              )}
                            </div>
                          ) : deadlineInfo.isPassed ? (
                            <button
                              disabled
                              className="w-full py-2 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed text-center"
                            >
                              Application Window Closed
                            </button>
                          ) : (
                            <button
                              onClick={() => setApplyingOpening(op)}
                              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{t.routeOpenings?.applyBtn || 'Apply / Express Interest'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Delete action for dispatchers */}
                      {canManage && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => handleDeleteOpening(op.id)}
                            className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            Delete Bulletin
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ACTIVE SHIFT COVERS (EXISTING PRESERVED TABLE)    */}
      {/* ======================================================== */}
      {activeTab === 'covers' && (
        <div className="space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}
          {/* KPI Cards (Clickable Filter Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => {
                if (coverStatusFilter === 'active' && coverDateFilter === 'today' && coverRoleFilter === 'all') {
                  setCoverDateFilter('all');
                } else {
                  setCoverStatusFilter('active');
                  setCoverDateFilter('today');
                  setCoverRoleFilter('all');
                }
              }}
              className={`text-left bg-slate-900/80 border rounded-2xl p-4 shadow-sm transition-all cursor-pointer group ${
                coverStatusFilter === 'active' && coverDateFilter === 'today' && coverRoleFilter === 'all'
                  ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10'
                  : 'border-slate-800/80 hover:border-amber-500/40 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-400 font-medium">Active Today</span>
                {coverStatusFilter === 'active' && coverDateFilter === 'today' && coverRoleFilter === 'all' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Active Filter
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-100 mt-1">{coversKpis.activeToday}</p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (coverStatusFilter === 'active' && coverDateFilter === 'upcoming' && coverRoleFilter === 'all') {
                  setCoverDateFilter('all');
                } else {
                  setCoverStatusFilter('active');
                  setCoverDateFilter('upcoming');
                  setCoverRoleFilter('all');
                }
              }}
              className={`text-left bg-slate-900/80 border rounded-2xl p-4 shadow-sm transition-all cursor-pointer group ${
                coverStatusFilter === 'active' && coverDateFilter === 'upcoming' && coverRoleFilter === 'all'
                  ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10'
                  : 'border-slate-800/80 hover:border-blue-500/40 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-400 font-medium">Upcoming Scheduled</span>
                {coverStatusFilter === 'active' && coverDateFilter === 'upcoming' && coverRoleFilter === 'all' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Active Filter
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-100 mt-1">{coversKpis.upcoming}</p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (coverRoleFilter === 'driver') {
                  setCoverRoleFilter('all');
                } else {
                  setCoverStatusFilter('active');
                  setCoverDateFilter('all');
                  setCoverRoleFilter('driver');
                }
              }}
              className={`text-left bg-slate-900/80 border rounded-2xl p-4 shadow-sm transition-all cursor-pointer group ${
                coverRoleFilter === 'driver'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10'
                  : 'border-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-medium">Driver Covers</span>
                {coverRoleFilter === 'driver' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active Filter
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-100 mt-1">{coversKpis.totalDriverCovers}</p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (coverRoleFilter === 'attendant') {
                  setCoverRoleFilter('all');
                } else {
                  setCoverStatusFilter('active');
                  setCoverDateFilter('all');
                  setCoverRoleFilter('attendant');
                }
              }}
              className={`text-left bg-slate-900/80 border rounded-2xl p-4 shadow-sm transition-all cursor-pointer group ${
                coverRoleFilter === 'attendant'
                  ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/10'
                  : 'border-slate-800/80 hover:border-purple-500/40 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-purple-400 font-medium">Attendant Covers</span>
                {coverRoleFilter === 'attendant' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Active Filter
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-100 mt-1">{coversKpis.totalAttendantCovers}</p>
            </button>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-3">
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search route, staff, bus, reason..."
                  value={coverSearchTerm}
                  onChange={(e) => setCoverSearchTerm(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Status Filter */}
              <select
                value={coverStatusFilter}
                onChange={(e) => setCoverStatusFilter(e.target.value as any)}
                className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Date Filter */}
              <select
                value={coverDateFilter}
                onChange={(e) => setCoverDateFilter(e.target.value as any)}
                className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="all">All Dates</option>
                <option value="today">Active Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past Records</option>
              </select>

              {/* Role Filter */}
              <select
                value={coverRoleFilter}
                onChange={(e) => setCoverRoleFilter(e.target.value as any)}
                className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="all">All Roles</option>
                <option value="driver">Driver Covers</option>
                <option value="attendant">Attendant Covers</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadCoversData}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {canManage && (
                <button
                  onClick={handleCreateCover}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Assign Shift Cover</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {coversLoading ? (
            <div className="py-20 text-center text-slate-400 text-xs animate-pulse">
              Loading active coverage assignments...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
              <UserCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p>No shift coverage assignments found matching filters.</p>
              {canManage && (
                <button
                  onClick={handleCreateCover}
                  className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New Shift Cover
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Route</th>
                      <th className="py-3 px-4">Coverage Dates</th>
                      <th className="py-3 px-4">Shifts</th>
                      <th className="py-3 px-4">Cover Crew</th>
                      <th className="py-3 px-4">Vehicle</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAssignments.map((a) => {
                      const isActiveToday = a.status === 'active' && a.startDate <= todayStr && a.endDate >= todayStr;
                      return (
                        <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-100 font-mono">{a.routeNo}</span>
                            {a.routeName && <div className="text-[11px] text-slate-500 truncate max-w-[160px]">{a.routeName}</div>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-medium text-slate-200">
                              {a.startDate === a.endDate ? a.startDate : `${a.startDate} ~ ${a.endDate}`}
                            </div>
                            {isActiveToday && (
                              <span className="inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Active Today
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[11px]">
                              {a.shiftType || 'ALL'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {a.temporaryDriverName && (
                              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {a.temporaryDriverName}
                              </div>
                            )}
                            {a.temporaryAttendantName && (
                              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                {a.temporaryAttendantName}
                              </div>
                            )}
                            {!a.temporaryDriverName && !a.temporaryAttendantName && (
                              <span className="text-slate-500 italic">No replacement crew</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {a.temporaryUnitNumber ? (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                                Bus #{a.temporaryUnitNumber}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-[180px]">
                            <div className="text-slate-300 font-medium">{a.reason}</div>
                            {a.notes && <div className="text-[11px] text-slate-500 truncate">{a.notes}</div>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                a.status === 'active'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : a.status === 'completed'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {a.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {canManage && (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleEditCover(a)}
                                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {a.status === 'active' ? (
                                  <button
                                    onClick={() => handleCoverStatusToggle(a, 'completed')}
                                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
                                    title="Mark Completed"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleCoverStatusToggle(a, 'active')}
                                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition"
                                    title="Reactivate"
                                  >
                                    <Clock className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteCover(a.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* ALL MODALS                                               */}
      {/* ======================================================== */}

      {/* 1. Create Route Opening Modal */}
      {isCreateOpeningModalOpen && (
        <RouteOpeningCreateModal
          isOpen={isCreateOpeningModalOpen}
          onClose={() => setIsCreateOpeningModalOpen(false)}
          routes={routes}
          onCreated={() => {
            // Subscription automatically updates
          }}
        />
      )}

      {/* 2. Confidential Stop Preview Modal */}
      {inspectingOpening && (
        <RouteOpeningStopPreviewModal
          isOpen={!!inspectingOpening}
          onClose={() => setInspectingOpening(null)}
          routeId={inspectingOpening.routeId}
          routeNo={inspectingOpening.routeNo}
          routeName={inspectingOpening.routeName}
          opening={inspectingOpening}
        />
      )}

      {/* 3. Candidate Apply Modal */}
      {applyingOpening && (
        <RouteOpeningApplyModal
          isOpen={!!applyingOpening}
          onClose={() => setApplyingOpening(null)}
          opening={applyingOpening}
          employees={employees}
          onApplied={() => {
            // Subscription automatically updates
          }}
        />
      )}

      {/* 4. Dispatcher Review Candidates Drawer */}
      {reviewingOpening && (
        <RouteOpeningApplicantsDrawer
          isOpen={!!reviewingOpening}
          onClose={() => setReviewingOpening(null)}
          opening={reviewingOpening}
          onAwarded={() => {
            // Subscription automatically updates
          }}
        />
      )}

      {/* 5. Existing Temporary Assignment Modal */}
      {isCoverModalOpen && (
        <TemporaryAssignmentModal
          isOpen={isCoverModalOpen}
          onClose={() => setIsCoverModalOpen(false)}
          assignment={editingAssignment}
          routes={routes}
          employees={employees}
          vehicles={vehicles}
          onSaved={() => {
            loadCoversData();
          }}
        />
      )}
    </div>
  );
};
