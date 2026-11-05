import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  memo,
  useCallback,
  useDeferredValue,
} from 'react';
import {
  UserCheck,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Briefcase,
  Radio,
} from 'lucide-react';
import { TemporaryAssignment } from '../types/dispatch';
import { BusRoute } from '../types/route';
import { Employee } from '../types/employee';
import { Vehicle } from '../types/vehicle';
import { RouteOpening, SanitizedStopPreview } from '../types/routeOpening';
import { CharterTrip } from '../types/charter';
import { DispatchService } from '../services/dispatchService';
import { RouteOpeningService } from '../services/routeOpeningService';
import { CharterService } from '../services/charterService';
import { OpeningCard } from '../components/dispatch/OpeningCard';
import { getLocalTodayString } from '../utils/dateUtils';
import {
  resolveOpeningDisplayStops,
  isOpeningUnderReview,
  computeOpeningsKpi,
} from '../utils/routeOpeningDisplay';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

const TemporaryAssignmentModal = React.lazy(() =>
  import('../components/dispatch/TemporaryAssignmentModal').then((module) => ({
    default: module.TemporaryAssignmentModal,
  }))
);
const RouteOpeningCreateModal = React.lazy(() =>
  import('../components/dispatch/RouteOpeningCreateModal').then((module) => ({
    default: module.RouteOpeningCreateModal,
  }))
);
const RouteOpeningStopPreviewModal = React.lazy(() =>
  import('../components/dispatch/RouteOpeningStopPreviewModal').then((module) => ({
    default: module.RouteOpeningStopPreviewModal,
  }))
);
const RouteOpeningApplyModal = React.lazy(() =>
  import('../components/dispatch/RouteOpeningApplyModal').then((module) => ({
    default: module.RouteOpeningApplyModal,
  }))
);
const RouteOpeningApplicantsDrawer = React.lazy(() =>
  import('../components/dispatch/RouteOpeningApplicantsDrawer').then((module) => ({
    default: module.RouteOpeningApplicantsDrawer,
  }))
);

type OpeningTypeFilter = 'all' | 'permanent' | 'temporary' | 'charter';
type OpeningStatusFilter = 'all' | 'open' | 'reviewing' | 'awarded';
type CoverStatusFilter = 'all' | 'active' | 'completed' | 'cancelled';
type CoverDateFilter = 'all' | 'today' | 'upcoming' | 'past';
type CoverRoleFilter = 'all' | 'driver' | 'attendant';

interface OpeningsKpi {
  total: number;
  openForBidding: number;
  reviewing: number;
  awarded: number;
}

interface CoversKpis {
  activeToday: number;
  upcoming: number;
  totalDriverCovers: number;
  totalAttendantCovers: number;
}

const EMPTY_STOPS: SanitizedStopPreview[] = [];

// ============================================================
// Openings & Bidding Board panel
// ============================================================

interface OpeningsBoardPanelProps {
  openings: RouteOpening[];
  openingsLoading: boolean;
  charterTripsById: Record<string, CharterTrip>;
  openingsKpi: OpeningsKpi;
  openingSearch: string;
  onOpeningSearchChange: (value: string) => void;
  openingTypeFilter: OpeningTypeFilter;
  onOpeningTypeFilterChange: (value: OpeningTypeFilter) => void;
  openingStatusFilter: OpeningStatusFilter;
  onOpeningStatusFilterChange: React.Dispatch<React.SetStateAction<OpeningStatusFilter>>;
  canManage: boolean;
  currentEmployeeId: string | null;
  todayStr: string;
  onCreateOpening: () => void;
  onInspect: (opening: RouteOpening) => void;
  onReview: (opening: RouteOpening) => void;
  onApply: (opening: RouteOpening) => void;
  onWithdraw: (openingId: string) => void;
  onDelete: (openingId: string) => void;
}

const OpeningsBoardPanel = memo(function OpeningsBoardPanel({
  openings,
  openingsLoading,
  charterTripsById,
  openingsKpi,
  openingSearch,
  onOpeningSearchChange,
  openingTypeFilter,
  onOpeningTypeFilterChange,
  openingStatusFilter,
  onOpeningStatusFilterChange,
  canManage,
  currentEmployeeId,
  todayStr,
  onCreateOpening,
  onInspect,
  onReview,
  onApply,
  onWithdraw,
  onDelete,
}: OpeningsBoardPanelProps) {
  const { t } = useI18n();
  const deferredOpeningSearch = useDeferredValue(openingSearch);

  const cardLabels = useMemo(
    () => ({
      appliedBadge: t.routeOpenings?.appliedBadge,
      applyBtn: t.routeOpenings?.applyBtn,
      deadlinePassed: t.routeOpenings?.deadlinePassed,
      daysLeft: t.routeOpenings?.daysLeft,
      hoursLeft: t.routeOpenings?.hoursLeft,
    }),
    [t]
  );

  const displayStopsByOpeningId = useMemo(() => {
    const map = new Map<string, SanitizedStopPreview[]>();
    for (const op of openings) {
      map.set(op.id, resolveOpeningDisplayStops(op, charterTripsById));
    }
    return map;
  }, [openings, charterTripsById]);

  const filteredOpenings = useMemo(() => {
    const q = deferredOpeningSearch.trim() ? deferredOpeningSearch.toLowerCase() : '';
    return openings.filter((op) => {
      if (openingTypeFilter !== 'all' && op.postingType !== openingTypeFilter) return false;
      if (openingStatusFilter !== 'all') {
        if (openingStatusFilter === 'reviewing') {
          if (!isOpeningUnderReview(op)) return false;
        } else if (op.status !== openingStatusFilter) {
          return false;
        }
      }

      if (q) {
        const matchRoute = op.routeNo.toLowerCase().includes(q);
        const matchName = (op.routeName || '').toLowerCase().includes(q);
        const matchTitle = op.title.toLowerCase().includes(q);
        const matchBoard = (op.schoolBoardCode || '').toLowerCase().includes(q);
        if (!matchRoute && !matchName && !matchTitle && !matchBoard) return false;
      }
      return true;
    });
  }, [openings, openingTypeFilter, openingStatusFilter, deferredOpeningSearch]);

  return (
    <div className="space-y-6">
      {/* KPI Metrics (Clickable Filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <button
          type="button"
          onClick={() => onOpeningStatusFilterChange('all')}
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
          onClick={() => onOpeningStatusFilterChange((prev) => (prev === 'open' ? 'all' : 'open'))}
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
            onOpeningStatusFilterChange((prev) => (prev === 'reviewing' ? 'all' : 'reviewing'))
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
            onOpeningStatusFilterChange((prev) => (prev === 'awarded' ? 'all' : 'awarded'))
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
              onChange={(e) => onOpeningSearchChange(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Type Filter */}
          <select
            value={openingTypeFilter}
            onChange={(e) => onOpeningTypeFilterChange(e.target.value as OpeningTypeFilter)}
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
            onChange={(e) => onOpeningStatusFilterChange(e.target.value as OpeningStatusFilter)}
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
            onClick={onCreateOpening}
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
              onClick={onCreateOpening}
              className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold rounded-lg text-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Post First Opening
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOpenings.map((op) => (
            <OpeningCard
              key={op.id}
              opening={op}
              displayStops={displayStopsByOpeningId.get(op.id) ?? EMPTY_STOPS}
              todayStr={todayStr}
              canManage={canManage}
              currentEmployeeId={currentEmployeeId}
              labels={cardLabels}
              onInspect={onInspect}
              onReview={onReview}
              onApply={onApply}
              onWithdraw={onWithdraw}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================================
// Active Shift Covers panel
// ============================================================

interface ShiftCoversPanelProps {
  assignments: TemporaryAssignment[];
  coversLoading: boolean;
  error: string | null;
  coversKpis: CoversKpis;
  coverSearchTerm: string;
  onCoverSearchTermChange: (value: string) => void;
  coverStatusFilter: CoverStatusFilter;
  onCoverStatusFilterChange: (value: CoverStatusFilter) => void;
  coverDateFilter: CoverDateFilter;
  onCoverDateFilterChange: (value: CoverDateFilter) => void;
  coverRoleFilter: CoverRoleFilter;
  onCoverRoleFilterChange: (value: CoverRoleFilter) => void;
  canManage: boolean;
  todayStr: string;
  onRefresh: () => void;
  onCreateCover: () => void;
  onEditCover: (assignment: TemporaryAssignment) => void;
  onToggleCoverStatus: (
    assignment: TemporaryAssignment,
    newStatus: 'active' | 'completed' | 'cancelled'
  ) => void;
  onDeleteCover: (id: string) => void;
}

const ShiftCoversPanel = memo(function ShiftCoversPanel({
  assignments,
  coversLoading,
  error,
  coversKpis,
  coverSearchTerm,
  onCoverSearchTermChange,
  coverStatusFilter,
  onCoverStatusFilterChange,
  coverDateFilter,
  onCoverDateFilterChange,
  coverRoleFilter,
  onCoverRoleFilterChange,
  canManage,
  todayStr,
  onRefresh,
  onCreateCover,
  onEditCover,
  onToggleCoverStatus,
  onDeleteCover,
}: ShiftCoversPanelProps) {
  const deferredCoverSearchTerm = useDeferredValue(coverSearchTerm);

  const filteredAssignments = useMemo(() => {
    const q = deferredCoverSearchTerm.trim() ? deferredCoverSearchTerm.toLowerCase() : '';
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

      if (q) {
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
  }, [assignments, coverStatusFilter, coverDateFilter, coverRoleFilter, deferredCoverSearchTerm, todayStr]);

  return (
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
              onCoverDateFilterChange('all');
            } else {
              onCoverStatusFilterChange('active');
              onCoverDateFilterChange('today');
              onCoverRoleFilterChange('all');
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
              onCoverDateFilterChange('all');
            } else {
              onCoverStatusFilterChange('active');
              onCoverDateFilterChange('upcoming');
              onCoverRoleFilterChange('all');
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
              onCoverRoleFilterChange('all');
            } else {
              onCoverStatusFilterChange('active');
              onCoverDateFilterChange('all');
              onCoverRoleFilterChange('driver');
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
              onCoverRoleFilterChange('all');
            } else {
              onCoverStatusFilterChange('active');
              onCoverDateFilterChange('all');
              onCoverRoleFilterChange('attendant');
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
              onChange={(e) => onCoverSearchTermChange(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Status Filter */}
          <select
            value={coverStatusFilter}
            onChange={(e) => onCoverStatusFilterChange(e.target.value as CoverStatusFilter)}
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
            onChange={(e) => onCoverDateFilterChange(e.target.value as CoverDateFilter)}
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
            onChange={(e) => onCoverRoleFilterChange(e.target.value as CoverRoleFilter)}
            className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="all">All Roles</option>
            <option value="driver">Driver Covers</option>
            <option value="attendant">Attendant Covers</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {canManage && (
            <button
              onClick={onCreateCover}
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
              onClick={onCreateCover}
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
                    <tr
                      key={a.id}
                      className="hover:bg-slate-800/40 transition-colors"
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '72px' }}
                    >
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-100 font-mono">{a.routeNo}</span>
                        {a.routeName && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">{a.routeName}</div>
                        )}
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
                              onClick={() => onEditCover(a)}
                              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {a.status === 'active' ? (
                              <button
                                onClick={() => onToggleCoverStatus(a, 'completed')}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
                                title="Mark Completed"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => onToggleCoverStatus(a, 'active')}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition"
                                title="Reactivate"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => onDeleteCover(a.id)}
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
  );
});

// ============================================================
// Main view shell
// ============================================================

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
  const currentEmployeeId = currentEmployee?.id ?? null;

  // Primary Tab: 'openings' (Openings & Bidding Board) vs 'covers' (Active Shift Covers)
  const [activeTab, setActiveTab] = useState<'openings' | 'covers'>('openings');

  // ==========================================
  // 1. Route Openings & Bidding State
  // ==========================================
  const [openings, setOpenings] = useState<RouteOpening[]>([]);
  const [charterTrips, setCharterTrips] = useState<CharterTrip[]>([]);
  const [openingsLoading, setOpeningsLoading] = useState<boolean>(true);
  const [openingSearch, setOpeningSearch] = useState<string>('');
  const [openingTypeFilter, setOpeningTypeFilter] = useState<OpeningTypeFilter>('all');
  const [openingStatusFilter, setOpeningStatusFilter] = useState<OpeningStatusFilter>('all');

  // Openings Modals
  const [isCreateOpeningModalOpen, setIsCreateOpeningModalOpen] = useState<boolean>(false);
  const [inspectingOpening, setInspectingOpening] = useState<RouteOpening | null>(null);
  const [applyingOpening, setApplyingOpening] = useState<RouteOpening | null>(null);
  const [reviewingOpening, setReviewingOpening] = useState<RouteOpening | null>(null);

  // Subscribe to route openings
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

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Signature of the charter trip ids referenced by charter openings
  const charterTripIdsSignature = useMemo(() => {
    const ids = new Set<string>();
    for (const op of openings) {
      if (op.postingType === 'charter') {
        const id = op.charterTripId || op.routeId;
        if (id) ids.add(id);
      }
    }
    return Array.from(ids).sort().join('|');
  }, [openings]);

  // Fetch only the charter trips referenced by openings (on demand)
  useEffect(() => {
    if (!charterTripIdsSignature) {
      setCharterTrips([]);
      return;
    }
    let cancelled = false;
    const ids = charterTripIdsSignature.split('|');
    Promise.all(ids.map((id) => CharterService.getTripById(id).catch(() => null)))
      .then((trips) => {
        if (cancelled) return;
        setCharterTrips(trips.filter((trip): trip is CharterTrip => !!trip));
      })
      .catch((err) => {
        if (!cancelled) console.error('[OpeningsView] Failed to load charter trips:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [charterTripIdsSignature]);

  const charterTripsById = useMemo(() => {
    const map: Record<string, CharterTrip> = {};
    charterTrips.forEach((tr) => {
      map[tr.id] = tr;
    });
    return map;
  }, [charterTrips]);

  // Openings KPIs
  const openingsKpi = useMemo(() => computeOpeningsKpi(openings), [openings]);

  // Handle application withdrawal
  const handleWithdraw = useCallback(
    async (openingId: string) => {
      if (!currentEmployeeId) return;
      if (!window.confirm('Are you sure you want to withdraw your application?')) return;
      try {
        await RouteOpeningService.withdrawApplication(openingId, currentEmployeeId);
      } catch (err: any) {
        console.error('[OpeningsView] Failed to withdraw:', err);
        alert(err?.message || 'Failed to withdraw application.');
      }
    },
    [currentEmployeeId]
  );

  // Delete opening
  const handleDeleteOpening = useCallback(async (openingId: string) => {
    if (!window.confirm('Are you sure you want to remove this route opening bulletin?')) return;
    try {
      await RouteOpeningService.deleteOpening(openingId);
    } catch (err: any) {
      console.error('[OpeningsView] Delete failed:', err);
      alert(err?.message || 'Failed to delete opening.');
    }
  }, []);

  const handleOpenCreateOpening = useCallback(() => setIsCreateOpeningModalOpen(true), []);
  const handleInspectOpening = useCallback((op: RouteOpening) => setInspectingOpening(op), []);
  const handleReviewOpening = useCallback((op: RouteOpening) => setReviewingOpening(op), []);
  const handleApplyOpening = useCallback((op: RouteOpening) => setApplyingOpening(op), []);

  // ==========================================
  // 2. Existing Temporary Assignments State
  // ==========================================
  const [assignments, setAssignments] = useState<TemporaryAssignment[]>([]);
  const [coversLoading, setCoversLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const assignmentsCountRef = useRef<number>(0);
  assignmentsCountRef.current = assignments.length;

  // Filters for covers
  const [coverSearchTerm, setCoverSearchTerm] = useState<string>('');
  const [coverStatusFilter, setCoverStatusFilter] = useState<CoverStatusFilter>('active');
  const [coverDateFilter, setCoverDateFilter] = useState<CoverDateFilter>('all');
  const [coverRoleFilter, setCoverRoleFilter] = useState<CoverRoleFilter>('all');

  // Modal for covers
  const [isCoverModalOpen, setIsCoverModalOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<TemporaryAssignment | null>(null);

  const todayStr = getLocalTodayString();

  // Manual refresh: only show the loading spinner when there is nothing to display yet
  const loadCoversData = useCallback(async () => {
    if (assignmentsCountRef.current === 0) {
      setCoversLoading(true);
    }
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
  }, []);

  // Subscribe to covers
  useEffect(() => {
    const unsubscribe = DispatchService.subscribeToTemporaryAssignments(
      (updated) => {
        setAssignments(Array.isArray(updated) ? updated : []);
        setCoversLoading(false);
      },
      (err) => {
        console.warn('Temporary assignment subscription fell back after an error:', err);
        setCoversLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleRefreshCovers = useCallback(() => {
    void loadCoversData();
  }, [loadCoversData]);

  const handleCreateCover = useCallback(() => {
    setEditingAssignment(null);
    setIsCoverModalOpen(true);
  }, []);

  const handleEditCover = useCallback((assignment: TemporaryAssignment) => {
    setEditingAssignment(assignment);
    setIsCoverModalOpen(true);
  }, []);

  const handleDeleteCover = useCallback(async (id: string) => {
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
  }, []);

  const handleCoverStatusToggle = useCallback(
    async (assignment: TemporaryAssignment, newStatus: 'active' | 'completed' | 'cancelled') => {
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
    },
    []
  );

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

      {activeTab === 'openings' ? (
        <OpeningsBoardPanel
          openings={openings}
          openingsLoading={openingsLoading}
          charterTripsById={charterTripsById}
          openingsKpi={openingsKpi}
          openingSearch={openingSearch}
          onOpeningSearchChange={setOpeningSearch}
          openingTypeFilter={openingTypeFilter}
          onOpeningTypeFilterChange={setOpeningTypeFilter}
          openingStatusFilter={openingStatusFilter}
          onOpeningStatusFilterChange={setOpeningStatusFilter}
          canManage={canManage}
          currentEmployeeId={currentEmployeeId}
          todayStr={todayStr}
          onCreateOpening={handleOpenCreateOpening}
          onInspect={handleInspectOpening}
          onReview={handleReviewOpening}
          onApply={handleApplyOpening}
          onWithdraw={handleWithdraw}
          onDelete={handleDeleteOpening}
        />
      ) : (
        <ShiftCoversPanel
          assignments={assignments}
          coversLoading={coversLoading}
          error={error}
          coversKpis={coversKpis}
          coverSearchTerm={coverSearchTerm}
          onCoverSearchTermChange={setCoverSearchTerm}
          coverStatusFilter={coverStatusFilter}
          onCoverStatusFilterChange={setCoverStatusFilter}
          coverDateFilter={coverDateFilter}
          onCoverDateFilterChange={setCoverDateFilter}
          coverRoleFilter={coverRoleFilter}
          onCoverRoleFilterChange={setCoverRoleFilter}
          canManage={canManage}
          todayStr={todayStr}
          onRefresh={handleRefreshCovers}
          onCreateCover={handleCreateCover}
          onEditCover={handleEditCover}
          onToggleCoverStatus={handleCoverStatusToggle}
          onDeleteCover={handleDeleteCover}
        />
      )}

      {/* ======================================================== */}
      {/* ALL MODALS                                               */}
      {/* ======================================================== */}

      {/* 1. Create Route Opening Modal */}
      {isCreateOpeningModalOpen && (
        <React.Suspense fallback={null}>
          <RouteOpeningCreateModal
            isOpen={isCreateOpeningModalOpen}
            onClose={() => setIsCreateOpeningModalOpen(false)}
            routes={routes}
            onCreated={() => {
              // Subscription automatically updates
            }}
          />
        </React.Suspense>
      )}

      {/* 2. Confidential Stop Preview Modal */}
      {inspectingOpening && (
        <React.Suspense fallback={<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 text-sm text-white">Loading map...</div>}>
          <RouteOpeningStopPreviewModal
            isOpen={!!inspectingOpening}
            onClose={() => setInspectingOpening(null)}
            routeId={inspectingOpening.routeId}
            routeNo={inspectingOpening.routeNo}
            routeName={inspectingOpening.routeName}
            opening={inspectingOpening}
          />
        </React.Suspense>
      )}

      {/* 3. Candidate Apply Modal */}
      {applyingOpening && (
        <React.Suspense fallback={null}>
          <RouteOpeningApplyModal
            isOpen={!!applyingOpening}
            onClose={() => setApplyingOpening(null)}
            opening={applyingOpening}
            employees={employees}
            onApplied={() => {
              // Subscription automatically updates
            }}
          />
        </React.Suspense>
      )}

      {/* 4. Dispatcher Review Candidates Drawer */}
      {reviewingOpening && (
        <React.Suspense fallback={null}>
          <RouteOpeningApplicantsDrawer
            isOpen={!!reviewingOpening}
            onClose={() => setReviewingOpening(null)}
            opening={reviewingOpening}
            onAwarded={() => {
              // Subscription automatically updates
            }}
          />
        </React.Suspense>
      )}

      {/* 5. Existing Temporary Assignment Modal */}
      {isCoverModalOpen && (
        <React.Suspense fallback={null}>
          <TemporaryAssignmentModal
            isOpen={isCoverModalOpen}
            onClose={() => setIsCoverModalOpen(false)}
            assignment={editingAssignment}
            routes={routes}
            employees={employees}
            vehicles={vehicles}
            onSaved={() => {
              void loadCoversData();
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};
