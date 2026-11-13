import React, { useEffect, useMemo, useState } from 'react';
import { DashboardStats, Employee } from '../types/employee';
import { BusRoute } from '../types/route';
import { DispatchShift } from '../types/dispatch';
import { TimeOffRequest } from '../types/timeOff';
import { StudentIncident } from '../types/studentIncident';
import { VehicleDefectReport } from '../types/defect';
import { HazardReport } from '../types/hazardReport';
import { ExpenseReimbursement } from '../types/expenseReimbursement';
import { DispatchService } from '../services/dispatchService';
import { TimeOffService } from '../services/timeOffService';
import { StudentIncidentService } from '../services/studentIncidentService';
import { DefectService } from '../services/defectService';
import { HazardReportService } from '../services/hazardReportService';
import { ExpenseReimbursementService } from '../services/expenseReimbursementService';
import { getLocalTodayString } from '../utils/dateUtils';
import { getCurrentHHmm } from '../utils/dispatchDelayUtils';
import { computeFleetPulseSummary } from '../utils/fleetPulseUtils';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  UserX,
  Bus,
  Clock,
  Route,
  CalendarOff,
  AlertCircle,
  Wrench,
  FileWarning,
  Receipt,
  Radio,
} from 'lucide-react';
import { NavTab } from '../components/common/Sidebar';

const EMPTY_ROUTES: BusRoute[] = [];

interface DashboardViewProps {
  stats: DashboardStats;
  employees: Employee[];
  routes?: BusRoute[];
  onNavigateTab: (tab: NavTab) => void;
  onSelectEmployee: (emp: Employee) => void;
}

interface PulseActionCardProps {
  title: string;
  count: number;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'rose' | 'amber' | 'blue' | 'orange' | 'purple' | 'emerald';
  onClick: () => void;
  highlightWhenZero?: boolean;
}

const ACCENT_STYLES: Record<
  PulseActionCardProps['accent'],
  { border: string; iconBg: string; countText: string; badge: string }
> = {
  rose: {
    border: 'border-rose-500/40 hover:border-rose-400',
    iconBg: 'bg-rose-500/15 text-rose-400',
    countText: 'text-rose-400',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  amber: {
    border: 'border-amber-500/40 hover:border-amber-400',
    iconBg: 'bg-amber-500/15 text-amber-400',
    countText: 'text-amber-400',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  orange: {
    border: 'border-orange-500/40 hover:border-orange-400',
    iconBg: 'bg-orange-500/15 text-orange-400',
    countText: 'text-orange-400',
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  },
  blue: {
    border: 'border-blue-500/40 hover:border-blue-400',
    iconBg: 'bg-blue-500/15 text-blue-400',
    countText: 'text-blue-400',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  purple: {
    border: 'border-purple-500/40 hover:border-purple-400',
    iconBg: 'bg-purple-500/15 text-purple-400',
    countText: 'text-purple-400',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  emerald: {
    border: 'border-emerald-500/40 hover:border-emerald-400',
    iconBg: 'bg-emerald-500/15 text-emerald-400',
    countText: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
};

const PulseActionCard: React.FC<PulseActionCardProps> = ({
  title,
  count,
  subtitle,
  icon,
  accent,
  onClick,
}) => {
  const hasItems = count > 0;
  const styles = ACCENT_STYLES[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-slate-900/90 border p-4 rounded-xl transition-all cursor-pointer group hover:bg-slate-800/70 shadow-sm ${
        hasItems ? styles.border : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide truncate">
          {title}
        </span>
        <div
          className={`p-2 rounded-lg shrink-0 ${
            hasItems ? styles.iconBg : 'bg-slate-800 text-slate-500'
          }`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline justify-between">
        <span
          className={`text-3xl font-black ${
            hasItems ? styles.countText : 'text-slate-400'
          }`}
        >
          {count}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-amber-400 transition">
          <span>{hasItems ? 'Resolve' : 'View'}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>

      <p className="text-xs text-slate-400 mt-1.5 truncate" title={subtitle}>
        {subtitle}
      </p>
    </button>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  employees,
  routes = EMPTY_ROUTES,
  onNavigateTab,
  onSelectEmployee: _onSelectEmployee,
}) => {
  const todayStr = getLocalTodayString();
  const [currentHHmm, setCurrentHHmm] = useState<string>(() => getCurrentHHmm());

  const [todayShifts, setTodayShifts] = useState<DispatchShift[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [studentIncidents, setStudentIncidents] = useState<StudentIncident[]>([]);
  const [vehicleDefects, setVehicleDefects] = useState<VehicleDefectReport[]>([]);
  const [hazardReports, setHazardReports] = useState<HazardReport[]>([]);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseReimbursement[]>([]);

  // Keep current time fresh for check-in overdue evaluation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHHmm(getCurrentHHmm());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore subscriptions across all actionable operational domains
  useEffect(() => {
    const unsubShifts = DispatchService.subscribeToDayShifts(
      todayStr,
      (list) => setTodayShifts(Array.isArray(list) ? list : []),
      (err) => console.warn('[FleetPulse] Shifts subscription notice:', err)
    );

    const unsubTimeOff = TimeOffService.subscribeToTimeOffRequests(
      (list) => setTimeOffRequests(Array.isArray(list) ? list : []),
      (err) => console.warn('[FleetPulse] TimeOff subscription notice:', err)
    );

    const unsubIncidents = StudentIncidentService.subscribeToIncidents((list) =>
      setStudentIncidents(Array.isArray(list) ? list : [])
    );

    const unsubDefects = DefectService.subscribeToDefects((list) =>
      setVehicleDefects(Array.isArray(list) ? list : [])
    );

    const unsubHazards = HazardReportService.subscribeHazardReports((list) =>
      setHazardReports(Array.isArray(list) ? list : [])
    );

    const unsubExpenses = ExpenseReimbursementService.subscribeClaims((list) =>
      setExpenseClaims(Array.isArray(list) ? list : [])
    );

    return () => {
      if (unsubShifts) unsubShifts();
      if (unsubTimeOff) unsubTimeOff();
      if (unsubIncidents) unsubIncidents();
      if (unsubDefects) unsubDefects();
      if (unsubHazards) unsubHazards();
      if (unsubExpenses) unsubExpenses();
    };
  }, [todayStr]);

  const pulse = useMemo(
    () =>
      computeFleetPulseSummary({
        shifts: todayShifts,
        routes,
        timeOffRequests,
        studentIncidents,
        vehicleDefects,
        hazardReports,
        expenseClaims,
        todayStr,
        currentHHmm,
      }),
    [
      todayShifts,
      routes,
      timeOffRequests,
      studentIncidents,
      vehicleDefects,
      hazardReports,
      expenseClaims,
      todayStr,
      currentHHmm,
    ]
  );

  const cdlSummary = useMemo(() => {
    let expired = 0;
    let critical7 = 0;
    let warning15 = 0;
    let upcoming30 = 0;
    const now = Date.now();

    for (const e of employees) {
      if (!e.driverLicense?.expirationDate) continue;
      const diffDays =
        (new Date(e.driverLicense.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) {
        expired += 1;
      } else if (diffDays <= 7) {
        critical7 += 1;
      } else if (diffDays <= 15) {
        warning15 += 1;
      } else if (diffDays <= 30) {
        upcoming30 += 1;
      }
    }

    const totalExpiring30 = critical7 + warning15 + upcoming30;
    return {
      expired,
      critical7,
      warning15,
      upcoming30,
      totalExpiring30,
      totalAttention: expired + totalExpiring30,
    };
  }, [employees]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Fleet Pulse Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>Fleet Pulse • Live Dispatch Operations</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 normal-case">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                Live Sync
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Operational Task & Readiness Center
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Real-time overview of unresolved dispatch gaps, route assignments, safety reports, and pending approvals across all active users. Click any card to resolve directly.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`px-4 py-2.5 rounded-xl border text-center ${
                pulse.totalActionItems > 0
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <div className="text-2xl font-black leading-none">{pulse.totalActionItems}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider mt-1">
                {pulse.totalActionItems > 0 ? 'Pending Tasks' : 'All Clear'}
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('dispatch')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-amber-500/20 flex items-center space-x-2 cursor-pointer"
            >
              <span>Open Dispatch</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Section 1: Dispatch & Route Readiness */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Today&apos;s Dispatch &amp; Route Readiness ({todayStr})
          </h2>
          <span className="text-xs text-slate-500">
            {pulse.dispatchTotalShifts} active shifts today • {routes.length} total routes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PulseActionCard
            title="Dispatch: Missing Driver"
            count={pulse.dispatchMissingDriver}
            subtitle={
              pulse.dispatchMissingDriver > 0
                ? 'Today shifts without an assigned driver'
                : 'All today shifts have drivers'
            }
            icon={<UserX className="w-4 h-4" />}
            accent="rose"
            onClick={() => onNavigateTab('dispatch')}
          />

          <PulseActionCard
            title="Dispatch: Missing Vehicle"
            count={pulse.dispatchMissingVehicle}
            subtitle={
              pulse.dispatchMissingVehicle > 0
                ? 'Today shifts without an assigned bus'
                : 'All today shifts have vehicles'
            }
            icon={<Bus className="w-4 h-4" />}
            accent="orange"
            onClick={() => onNavigateTab('dispatch')}
          />

          <PulseActionCard
            title="Driver Not Checked In"
            count={pulse.dispatchNotCheckedIn}
            subtitle={
              pulse.dispatchCheckInOverdue > 0
                ? `${pulse.dispatchCheckInOverdue} overdue past check-in window`
                : 'Assigned drivers awaiting check-in'
            }
            icon={<Clock className="w-4 h-4" />}
            accent={pulse.dispatchCheckInOverdue > 0 ? 'rose' : 'amber'}
            onClick={() => onNavigateTab('dispatch')}
          />

          <PulseActionCard
            title="Routes Missing Crew / Bus"
            count={pulse.routeNeedsFix}
            subtitle={`Driver missing: ${pulse.routeMissingDriver} • Vehicle missing: ${pulse.routeMissingVehicle}`}
            icon={<Route className="w-4 h-4" />}
            accent="amber"
            onClick={() => onNavigateTab('routes')}
          />
        </div>
      </div>

      {/* Section 2: Pending Approvals, Safety & Claims */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Pending Approvals, Safety Reports &amp; Claims
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <PulseActionCard
            title="Time Off Requests"
            count={pulse.pendingTimeOff + pulse.timeOffNeedsCover}
            subtitle={`Pending: ${pulse.pendingTimeOff} • Needs Cover: ${pulse.timeOffNeedsCover}`}
            icon={<CalendarOff className="w-4 h-4" />}
            accent="blue"
            onClick={() => onNavigateTab('time_off')}
          />

          <PulseActionCard
            title="Student Incidents"
            count={pulse.openStudentIncidents}
            subtitle={
              pulse.openStudentIncidents > 0
                ? 'Open incidents awaiting follow-up'
                : 'No open student incidents'
            }
            icon={<AlertCircle className="w-4 h-4" />}
            accent="rose"
            onClick={() => onNavigateTab('student_incidents')}
          />

          <PulseActionCard
            title="Vehicle Defects"
            count={pulse.openVehicleDefects}
            subtitle={
              pulse.openVehicleDefects > 0
                ? 'Unresolved mechanical defects'
                : 'All defects resolved'
            }
            icon={<Wrench className="w-4 h-4" />}
            accent="orange"
            onClick={() => onNavigateTab('defects')}
          />

          <PulseActionCard
            title="Hazard Reports"
            count={pulse.openHazardReports}
            subtitle={
              pulse.openHazardReports > 0
                ? 'Open / investigating safety hazards'
                : 'No open hazard reports'
            }
            icon={<FileWarning className="w-4 h-4" />}
            accent="amber"
            onClick={() => onNavigateTab('hazards')}
          />

          <PulseActionCard
            title="Expense Claims"
            count={pulse.pendingExpenses}
            subtitle={
              pulse.pendingExpenses > 0
                ? 'Reimbursement claims awaiting review'
                : 'No pending expense claims'
            }
            icon={<Receipt className="w-4 h-4" />}
            accent="purple"
            onClick={() => onNavigateTab('expenses')}
          />

          <PulseActionCard
            title="License Expirations"
            count={stats.licenseExpiringSoon}
            subtitle="Expiring within 30 days"
            icon={<AlertTriangle className="w-4 h-4" />}
            accent="amber"
            onClick={() => onNavigateTab('compliance')}
          />
        </div>
      </div>

      {/* Main Grid: Expiration Alerts & Yard Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: CDL Expiration Summary */}
        <div
          onClick={() => onNavigateTab('compliance')}
          className="lg:col-span-2 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-xl p-5 space-y-4 cursor-pointer transition"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Driver CDL Expiration Watchlist</h2>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateTab('compliance');
              }}
              className="text-xs text-amber-400 hover:underline font-semibold cursor-pointer"
            >
              View Full Compliance Radar &rarr;
            </button>
          </div>

          {cdlSummary.totalAttention === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              All active driver licenses are currently compliant.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
                  <div className="text-xs text-rose-300 font-medium">Expired</div>
                  <div className="text-2xl font-bold text-rose-400 mt-1">{cdlSummary.expired}</div>
                  <div className="text-[11px] text-rose-300/70 mt-0.5">Immediate lock</div>
                </div>
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="text-xs text-amber-300 font-medium">&le; 7 Days</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1">{cdlSummary.critical7}</div>
                  <div className="text-[11px] text-amber-300/70 mt-0.5">Urgent renewal</div>
                </div>
                <div className="p-3.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="text-xs text-yellow-300 font-medium">8&ndash;15 Days</div>
                  <div className="text-2xl font-bold text-yellow-400 mt-1">{cdlSummary.warning15}</div>
                  <div className="text-[11px] text-yellow-300/70 mt-0.5">Schedule renewal</div>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/70">
                  <div className="text-xs text-slate-300 font-medium">16&ndash;30 Days</div>
                  <div className="text-2xl font-bold text-white mt-1">{cdlSummary.upcoming30}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Upcoming</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>
                  {cdlSummary.totalAttention} driver{cdlSummary.totalAttention === 1 ? '' : 's'} requiring license attention
                </span>
                <span className="inline-flex items-center space-x-1 text-amber-400 font-semibold">
                  <span>Open Compliance Radar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Yard Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">Staff Depot Distribution</h2>
          </div>

          <div className="space-y-3">
            {Object.entries(stats.yardDistribution || { 'HQ-Central': 3, 'Yard-East': 2, 'Yard-West': 2 }).map(
              ([yard, count]) => {
                const percentage = Math.round((count / (stats.totalEmployees || 1)) * 100);
                return (
                  <div key={yard} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-300">
                      <span>{yard}</span>
                      <span className="text-slate-400 font-mono">{count} staff ({percentage}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700 text-xs text-slate-400 space-y-1 mt-4">
            <span className="font-semibold text-slate-300 block">Fleet Summary:</span>
            <span>
              {stats.totalEmployees} total staff ({stats.activeEmployees} active) • {stats.totalDrivers} licensed drivers.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
