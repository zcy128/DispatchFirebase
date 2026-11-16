import React, { Suspense, useCallback, useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import {
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  Building2,
  Sliders,
  Calculator,
  Pencil,
  Trash2,
  AlertCircle,
  HelpCircle,
  UserCheck,
  MapPin,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BusRoutePayrollRate,
  SchoolBoardBaseRatesDTO,
  PayrollLookups,
  RateCalculationRequest,
  RateCalculationResponse,
} from '../types/payroll';
import { PayrollService } from '../services/payrollService';
import { useAuth } from '../contexts/AuthContext';
import { getLocalTodayString } from '../utils/dateUtils';
import { PayrollOperationLogService } from '../services/payrollOperationLogService';
import { PayrollOperationActor, PayrollFieldDiff } from '../types/payrollOperationLog';
import { SchoolBoard } from '../types/school';
import { BusRoute } from '../types/route';
import { Employee } from '../types/employee';

const CustomRateModal = React.lazy(() =>
  import('../components/payroll/CustomRateModal').then((m) => ({ default: m.CustomRateModal }))
);
const BoardBaseRateModal = React.lazy(() =>
  import('../components/payroll/BoardBaseRateModal').then((m) => ({ default: m.BoardBaseRateModal }))
);
const DispatchPaySettingsTab = React.lazy(() =>
  import('../components/payroll/DispatchPaySettingsTab').then((m) => ({ default: m.DispatchPaySettingsTab }))
);
const DispatchDailyPayrollTab = React.lazy(() =>
  import('../components/payroll/DispatchDailyPayrollTab').then((m) => ({ default: m.DispatchDailyPayrollTab }))
);
const PayrollDepartmentLogView = React.lazy(() =>
  import('./PayrollDepartmentLogView').then((m) => ({ default: m.PayrollDepartmentLogView }))
);
const BiweeklyPayrollView = React.lazy(() =>
  import('./BiweeklyPayrollView').then((m) => ({ default: m.BiweeklyPayrollView }))
);

const TabFallback = (
  <div className="p-8 text-sm text-slate-400">Loading payroll tab...</div>
);

interface PayrollRateViewProps {
  initialBoardRates?: SchoolBoardBaseRatesDTO[];
  cachedRates?: BusRoutePayrollRate[];
  boards?: SchoolBoard[];
  routes?: BusRoute[];
  employees?: Employee[];
  onBoardRatesChange?: (rates: SchoolBoardBaseRatesDTO[]) => void;
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
}

export const PayrollRateView: React.FC<PayrollRateViewProps> = ({
  initialBoardRates,
  cachedRates,
  boards: propsBoards,
  routes: propsRoutes,
  employees: propsEmployees,
  onBoardRatesChange,
  onSelectEmployee,
}) => {
  const { currentUser } = useAuth();
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'board-rates' | 'custom-rates' | 'calculator' | 'dispatch-rates' | 'dispatch-payroll' | 'payroll-dept-log' | 'biweekly-payroll'>(
    currentUser?.role === 'payroll' ? 'payroll-dept-log' : 'board-rates'
  );
  const openPayrollFinanceLog = useCallback(() => {
    setActiveTab('payroll-dept-log');
  }, []);

  // Data states initialized from permanent cache
  const [boardRates, setBoardRates] = useState<SchoolBoardBaseRatesDTO[]>(() => {
    if (initialBoardRates && initialBoardRates.length > 0) return initialBoardRates;
    return PayrollService.getCachedBoardRates();
  });

  const [customRates, setCustomRates] = useState<BusRoutePayrollRate[]>(() => {
    if (cachedRates && cachedRates.length > 0) return cachedRates;
    return PayrollService.getCachedCustomRates();
  });

  const [lookups, setLookups] = useState<PayrollLookups>(() => {
    const cached = PayrollService.getCachedLookups();
    if (cached) return cached;
    return {
      schoolBoards: (propsBoards || []).map((b) => ({
        schoolBoardId: b.schoolBoardId,
        schoolBoardName: b.schoolBoardName,
        schoolBoardCode: b.schoolBoardCode,
      })),
      routes: (propsRoutes || []).map((r) => ({
        busRouteId: r.busRouteId || 0,
        routeNo: r.routeNo || '',
        routeName: r.routeName || '',
        shifts: (r.shifts || []).map((s) => ({
          shiftId: s.shiftId,
          shiftType: s.shiftType,
        })),
      })),
      employees: (propsEmployees || []).map((e) => ({
        employeeId: Number(e.id || e.employeeNumber || 0),
        firstName: e.firstName || '',
        lastName: e.lastName || '',
        jobPosition: e.jobPosition || e.role,
      })),
      jobTitles: [
        { id: 1, name: 'driver', displayName: 'School Bus Driver' },
        { id: 2, name: 'attendant', displayName: 'Bus Attendant / Monitor' },
        { id: 3, name: 'lpn', displayName: 'Licensed Practical Nurse (LPN)' },
      ],
      shiftTypes: [
        { id: 1, name: 'AM', displayName: 'Morning Shift (AM)' },
        { id: 2, name: 'MIDDAY', displayName: 'Midday Shift (MID)' },
        { id: 3, name: 'PM', displayName: 'Afternoon Shift (PM)' },
        { id: 4, name: 'ALL', displayName: 'All Day Package' },
      ],
    };
  });

  // Zero-latency startup if cache is already present
  const [loading, setLoading] = useState<boolean>(() => {
    const hasCache =
      (initialBoardRates && initialBoardRates.length > 0) ||
      PayrollService.getCachedBoardRates().length > 0;
    return !hasCache;
  });
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [editingCustomRate, setEditingCustomRate] = useState<BusRoutePayrollRate | null>(null);
  const [isBoardModalOpen, setIsBoardModalOpen] = useState<boolean>(false);
  const [editingBoardDTO, setEditingBoardDTO] = useState<SchoolBoardBaseRatesDTO | null>(null);

  // Search & Filter for Custom Rates Tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBoardId, setFilterBoardId] = useState<string>('all');
  const [filterJobTitle, setFilterJobTitle] = useState<string>('all');

  // Helper to render MTWRF badges
  const renderWeekDaysBadge = (weekDays?: string) => {
    const raw = (weekDays || 'MTWRF').toUpperCase();
    if (raw === 'WEEKDAYS' || raw === 'MTWRF' || raw === 'ALL' || !weekDays) {
      return (
        <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
          MTWRF
        </span>
      );
    }
    const allDays = ['M', 'T', 'W', 'R', 'F'];
    return (
      <div className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold">
        {allDays.map((d) => {
          const active = raw.includes(d);
          return (
            <span
              key={d}
              className={`w-4 h-4 flex items-center justify-center rounded ${
                active
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-600'
              }`}
              title={active ? `Runs on ${d}` : `Does not run on ${d}`}
            >
              {d}
            </span>
          );
        })}
      </div>
    );
  };

  const getSimDayInfo = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayLetters = ['', 'M', 'T', 'W', 'R', 'F', ''];
    const dayIndex = d.getDay();
    const letter = dayLetters[dayIndex];
    return letter ? `${dayNames[dayIndex]} (${letter})` : dayNames[dayIndex];
  };

  // Simulator / Calculator States
  const [simDate, setSimDate] = useState<string>(() => getLocalTodayString());
  const [simBoardId, setSimBoardId] = useState<number>(5);
  const [simRouteId, setSimRouteId] = useState<number | ''>('');
  const [simShiftId, setSimShiftId] = useState<number | ''>('');
  const [simEmployeeId, setSimEmployeeId] = useState<number | ''>('');
  const [simJobTitle, setSimJobTitle] = useState<string>('driver');
  const [simShiftType, setSimShiftType] = useState<string>('AM');
  const [simResult, setSimResult] = useState<RateCalculationResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const simDateId = useId();
  const simBoardFieldId = useId();
  const simRouteFieldId = useId();
  const simShiftFieldId = useId();
  const simEmployeeFieldId = useId();
  const simJobTitleFieldId = useId();
  const simShiftTypeFieldId = useId();

  // Synchronize when initialBoardRates updates from parent
  useEffect(() => {
    if (initialBoardRates && initialBoardRates.length > 0) {
      setBoardRates(initialBoardRates);
      setLoading(false);
    }
  }, [initialBoardRates]);

  // Hydrate instantly from top-level permanent cache when available
  useEffect(() => {
    if (cachedRates && cachedRates.length > 0) {
      if (propsBoards && propsBoards.length > 0) {
        const aggregated = PayrollService.aggregateSchoolBoardBaseRates(propsBoards, cachedRates);
        setBoardRates(aggregated);
        onBoardRatesChange?.(aggregated);
        if (!simBoardId && aggregated.length > 0) {
          setSimBoardId(aggregated[0].schoolBoardId);
        }
      }
      const customs = PayrollService.filterCustomRates(cachedRates);
      setCustomRates(customs);
      setLoading(false);
    }
  }, [cachedRates, propsBoards]);

  // Load all initial payroll data & lookups
  const loadData = async (isManual = false) => {
    const hasData = boardRates.length > 0;
    // Only show full loading spinner if we have ZERO data on screen or if manual force-refresh
    if (!hasData || isManual) {
      setLoading(true);
    }
    setError(null);
    try {
      const [boardsData, customsData, lookupsData] = await Promise.all([
        PayrollService.getSchoolBoardBaseRates(),
        PayrollService.getCustomRates(),
        PayrollService.getLookups(),
      ]);
      if (boardsData && boardsData.length > 0) {
        setBoardRates(boardsData);
        onBoardRatesChange?.(boardsData);
        if (!simBoardId) {
          setSimBoardId(boardsData[0].schoolBoardId);
        }
      }
      if (customsData && customsData.length > 0) {
        setCustomRates(customsData);
      }
      if (lookupsData) {
        setLookups(lookupsData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load payroll data';
      if (!hasData) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasRateCache =
      boardRates.length > 0 ||
      customRates.length > 0 ||
      (cachedRates && cachedRates.length > 0) ||
      PayrollService.getCachedBoardRates().length > 0 ||
      PayrollService.getCachedCustomRates().length > 0;

    if (!hasRateCache) {
      void loadData();
      return;
    }

    setLoading(false);
    if (!PayrollService.getCachedLookups()) {
      PayrollService.getLookups()
        .then((data) => {
          if (data) setLookups(data);
        })
        .catch((err) => {
          console.warn('Payroll lookups hydrate notice:', err);
        });
    }
  }, []);

  // Save handler for Custom Rate Modal
  const handleSaveCustomRate = async (ratePayload: Partial<BusRoutePayrollRate>) => {
    const actor: PayrollOperationActor = {
      userId: currentUser?.uid || 'dispatcher-1',
      userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
      userEmail: currentUser?.email,
      userRole: currentUser?.role || 'dispatcher',
    };

    if (editingCustomRate?.id) {
      await PayrollService.updateRate(editingCustomRate.id, ratePayload);
      const diffs: PayrollFieldDiff[] = [];
      if (ratePayload.payRate !== undefined && ratePayload.payRate !== editingCustomRate.payRate) {
        diffs.push({
          field: 'payRate',
          fieldLabel: 'Pay Rate',
          oldValue: editingCustomRate.payRate,
          newValue: ratePayload.payRate,
        });
      }
      if (ratePayload.shiftType && ratePayload.shiftType !== editingCustomRate.shiftType) {
        diffs.push({
          field: 'shiftType',
          fieldLabel: 'Shift Type',
          oldValue: editingCustomRate.shiftType,
          newValue: ratePayload.shiftType,
        });
      }
      if (ratePayload.effectiveDate && ratePayload.effectiveDate !== editingCustomRate.effectiveDate) {
        diffs.push({
          field: 'effectiveDate',
          fieldLabel: 'Effective Date',
          oldValue: editingCustomRate.effectiveDate,
          newValue: ratePayload.effectiveDate,
        });
      }
      void PayrollOperationLogService.logOperation({
        category: 'custom_rate',
        action: 'update',
        targetId: String(editingCustomRate.id),
        targetIdentifier: `RATE-${editingCustomRate.id}`,
        targetName: editingCustomRate.routeName || editingCustomRate.employeeName || `Rate #${editingCustomRate.id}`,
        amount: ratePayload.payRate ?? editingCustomRate.payRate,
        summary: `Updated custom payroll rate override rule for ${editingCustomRate.routeName || editingCustomRate.employeeName || 'custom route'}.`,
        actor,
        diffs,
      }).catch((err) => console.warn('Payroll rate update audit log failed:', err));
      return;
    }

    await PayrollService.createRate(ratePayload);
    void PayrollOperationLogService.logOperation({
      category: 'custom_rate',
      action: 'create',
      targetId: 'new',
      targetIdentifier: 'RATE-NEW',
      targetName: ratePayload.routeName || ratePayload.employeeName || 'New Rate Rule',
      amount: ratePayload.payRate,
      summary: `Created custom payroll rate override rule with rate $${ratePayload.payRate ?? 0} for ${ratePayload.jobTitle || 'staff'}.`,
      actor,
    }).catch((err) => console.warn('Payroll rate create audit log failed:', err));
  };

  // Delete handler for Custom Rate
  const handleDeleteCustomRate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this rate override rule?')) {
      return;
    }
    const targetRate = customRates.find((r) => String(r.id) === String(id));
    try {
      await PayrollService.deleteRate(id);
      setCustomRates((prev) => prev.filter((r) => String(r.id) !== String(id)));
      const actor: PayrollOperationActor = {
        userId: currentUser?.uid || 'dispatcher-1',
        userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
        userEmail: currentUser?.email,
        userRole: currentUser?.role || 'dispatcher',
      };
      void PayrollOperationLogService.logOperation({
        category: 'custom_rate',
        action: 'delete',
        targetId: String(id),
        targetIdentifier: `RATE-${id}`,
        targetName: targetRate?.routeName || targetRate?.employeeName || `Rate #${id}`,
        amount: targetRate?.payRate,
        summary: `Deleted custom rate override rule for ${targetRate?.routeName || targetRate?.employeeName || id}.`,
        actor,
      }).catch((err) => console.warn('Payroll rate delete audit log failed:', err));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete rate');
    }
  };

  // Run Rate Simulation (manual only — do not auto-fire on lookups hydrate)
  const handleRunSimulation = async () => {
    setIsCalculating(true);
    try {
      const req: RateCalculationRequest = {
        date: simDate,
        schoolBoardId: Number(simBoardId),
        routeId: simRouteId !== '' ? Number(simRouteId) : null,
        shiftId: simShiftId !== '' ? Number(simShiftId) : null,
        employeeId: simEmployeeId !== '' ? Number(simEmployeeId) : null,
        jobTitle: simJobTitle,
        shiftType: simShiftType,
      };
      const res = await PayrollService.calculateRate(req);
      setSimResult(res);
    } catch (err: unknown) {
      console.error('Simulation error:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Filtered custom rates
  const filteredCustomRates = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const jobFilter = filterJobTitle === 'all' ? '' : filterJobTitle.toLowerCase();
    return customRates.filter((rate) => {
      if (filterBoardId !== 'all' && rate.schoolBoardId !== Number(filterBoardId)) {
        return false;
      }
      if (jobFilter && rate.jobTitle && rate.jobTitle.toLowerCase() !== jobFilter) {
        return false;
      }
      if (q) {
        const routeMatch = (rate.routeNo || '').toLowerCase().includes(q) || (rate.routeName || '').toLowerCase().includes(q);
        const empMatch = (rate.employeeName || '').toLowerCase().includes(q);
        const boardMatch = (rate.schoolBoardName || '').toLowerCase().includes(q) || (rate.schoolBoardCode || '').toLowerCase().includes(q);
        const notesMatch = (rate.notes || '').toLowerCase().includes(q);
        if (!routeMatch && !empMatch && !boardMatch && !notesMatch) {
          return false;
        }
      }
      return true;
    });
  }, [customRates, filterBoardId, filterJobTitle, deferredSearchQuery]);

  return (
    <PageShell className="animate-fade-in pb-12">
      {/* Top Header */}
      <PageHeader
        title="Payroll Base Rates & Overrides"
        subtitle="Manage School Board shift base rates (AM / Midday / PM) and 4-tier custom rate overrides."
        icon={
          <div aria-hidden="true" className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh payroll rates"
              onClick={() => {
                loadData(true);
              }}
              disabled={loading}
              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              title="Refresh"
            >
              <RefreshCw aria-hidden="true" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingCustomRate(null);
                setIsCustomModalOpen(true);
              }}
              className="min-h-[36px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <Plus aria-hidden="true" className="w-4 h-4" />
              <span>New Custom Rate</span>
            </button>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div role="group" aria-label="Payroll sections" className="flex items-center gap-2 border-b border-slate-700 pb-px overflow-x-auto">
        <button
          type="button"
          aria-pressed={activeTab === 'board-rates'}
          onClick={() => setActiveTab('board-rates')}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            activeTab === 'board-rates'
              ? 'border-amber-500   rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 aria-hidden="true" className="w-4 h-4" />
          <span>School Board Base Rates</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {boardRates.length}
          </span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'custom-rates'}
          onClick={() => setActiveTab('custom-rates')}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            activeTab === 'custom-rates'
              ? 'border-amber-500   rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders aria-hidden="true" className="w-4 h-4" />
          <span>Custom & Override Rates</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold">
            {customRates.length}
          </span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'calculator'}
          onClick={() => setActiveTab('calculator')}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            activeTab === 'calculator'
              ? 'border-amber-500   rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator aria-hidden="true" className="w-4 h-4" />
          <span>Rate Resolution Simulator</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'dispatch-rates'}
          onClick={() => setActiveTab('dispatch-rates')}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            activeTab === 'dispatch-rates'
              ? 'border-amber-500   rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign aria-hidden="true" className="w-4 h-4" />
          <span>Dispatch Shift Rates</span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'dispatch-payroll'}
          onClick={() => setActiveTab('dispatch-payroll')}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            activeTab === 'dispatch-payroll'
              ? 'border-amber-500   rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck aria-hidden="true" className="w-4 h-4" />
          <span>Daily Dispatch Payroll</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold">
            Live
          </span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'payroll-dept-log'}
          onClick={() => setActiveTab('payroll-dept-log')}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            activeTab === 'payroll-dept-log'
              ? 'border-emerald-500   rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt aria-hidden="true" className="w-4 h-4" />
          <span>Payroll Department Log</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold">
            Finance
          </span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'biweekly-payroll'}
          onClick={() => setActiveTab('biweekly-payroll')}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
            activeTab === 'biweekly-payroll'
              ? 'border-amber-500   rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet aria-hidden="true" className="w-4 h-4" />
          <span>Bi-Weekly Payroll Summary</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold">
            2-Week
          </span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div role="alert" className="p-4 rounded-xl border text-sm flex items-center gap-3">
          <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: SCHOOL BOARD BASE RATES */}
      {activeTab === 'board-rates' && (
        <div className="space-y-6">
          <div className="border rounded-xl p-4 text-xs flex items-start gap-3">
            <HelpCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm mb-0.5">School Board Base Rates (Tier 4 Baseline)</p>
              <p>
                Each School Board defines default Pay Rates and Employment Insurance (EI) Hours for Driver and Attendant classifications across AM, Midday/Noon, and PM shifts. These baseline rates are automatically applied when no higher-priority route or employee override exists.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {boardRates.map((board) => (
              <div
                key={board.schoolBoardId}
                className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Board Card Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide rounded-md">
                      {board.schoolBoardCode}
                    </span>
                    <div>
                      <h3 className="font-bold text-white">
                        {board.schoolBoardName}
                      </h3>
                      <span className="text-xs text-slate-400">Board ID: #{board.schoolBoardId}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingBoardDTO(board);
                      setIsBoardModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors shadow-sm"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Base Rates</span>
                  </button>
                </div>

                {/* Rates Matrix */}
                <div className="p-6 space-y-5">
                  {/* Drivers Matrix */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Driver Base Rates
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">AM Shift</span>
                        <div className="text-base font-extrabold text-white">
                          ${board.driver.am.payRate !== undefined ? board.driver.am.payRate.toFixed(2) : '--'}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {board.driver.am.eiHours !== undefined ? `${board.driver.am.eiHours} hrs` : '--'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Midday</span>
                        <div className="text-base font-extrabold text-white">
                          ${board.driver.midday.payRate !== undefined ? board.driver.midday.payRate.toFixed(2) : '--'}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {board.driver.midday.eiHours !== undefined ? `${board.driver.midday.eiHours} hrs` : '--'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">PM Shift</span>
                        <div className="text-base font-extrabold text-white">
                          ${board.driver.pm.payRate !== undefined ? board.driver.pm.payRate.toFixed(2) : '--'}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {board.driver.pm.eiHours !== undefined ? `${board.driver.pm.eiHours} hrs` : '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attendants Matrix */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Attendant Base Rates
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">AM Shift</span>
                        <div className="text-base font-extrabold text-white">
                          ${board.attendant.am.payRate !== undefined ? board.attendant.am.payRate.toFixed(2) : '--'}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {board.attendant.am.eiHours !== undefined ? `${board.attendant.am.eiHours} hrs` : '--'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Midday</span>
                        <div className="text-base font-extrabold text-white">
                          ${board.attendant.midday.payRate !== undefined ? board.attendant.midday.payRate.toFixed(2) : '--'}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {board.attendant.midday.eiHours !== undefined ? `${board.attendant.midday.eiHours} hrs` : '--'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">PM Shift</span>
                        <div className="text-base font-extrabold text-white">
                          ${board.attendant.pm.payRate !== undefined ? board.attendant.pm.payRate.toFixed(2) : '--'}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {board.attendant.pm.eiHours !== undefined ? `${board.attendant.pm.eiHours} hrs` : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM & OVERRIDE RATES */}
      {activeTab === 'custom-rates' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <search aria-label="Filter custom payroll rates" className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <div className="relative w-full sm:w-80">
              <Search aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search custom rates by route, employee, or notes"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by route, employee, or notes..."
                className="w-full pl-9 pr-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                aria-label="Filter by school board"
                value={filterBoardId}
                onChange={(e) => setFilterBoardId(e.target.value)}
                className="px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                <option value="all">All School Boards</option>
                {lookups.schoolBoards.map((b) => (
                  <option key={b.schoolBoardId} value={b.schoolBoardId}>
                    {b.schoolBoardCode}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by job title"
                value={filterJobTitle}
                onChange={(e) => setFilterJobTitle(e.target.value)}
                className="px-3 py-2 text-base sm:text-sm rounded-lg border border-slate-700 bg-slate-800 text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                <option value="all">All Job Titles</option>
                <option value="driver">Driver</option>
                <option value="attendant">Attendant</option>
              </select>
            </div>
          </search>

          {/* Overrides Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div tabIndex={0} role="region" aria-label="Custom and override rates table" className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
              <table className="w-full text-left text-sm border-collapse">
                <caption className="sr-only">Custom and override payroll rates</caption>
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/50 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th scope="col" className="py-3.5 px-4">Resolution Tier</th>
                    <th scope="col" className="py-3.5 px-4">School Board</th>
                    <th scope="col" className="py-3.5 px-4">Scope & Target</th>
                    <th scope="col" className="py-3.5 px-4">Shift & Days</th>
                    <th scope="col" className="py-3.5 px-4">Pay Rate</th>
                    <th scope="col" className="py-3.5 px-4">EI Hours</th>
                    <th scope="col" className="py-3.5 px-4">Effective Date</th>
                    <th scope="col" className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCustomRates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No custom rate overrides found. Click "+ New Custom Rate" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomRates.map((rate) => {
                      // Determine tier
                      let tier = 3;
                      let tierLabel = 'Tier 3: Route Override';
                      let tierColor = 'bg-amber-500/15  text-amber-300 ';

                      if (rate.employeeId && (rate.routeId || rate.shiftId)) {
                        tier = 1;
                        tierLabel = 'Tier 1: Route + Employee';
                        tierColor = 'bg-purple-500/15  text-purple-300 ';
                      } else if (rate.employeeId && !rate.routeId && !rate.shiftId) {
                        tier = 2;
                        tierLabel = 'Tier 2: Universal Employee';
                        tierColor = 'bg-blue-500/15  text-blue-300 ';
                      }

                      return (
                        <tr
                          key={rate.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md border ${tierColor}`}
                            >
                              {tierLabel}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-white">
                              {rate.schoolBoardCode || `Board #${rate.schoolBoardId}`}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              {rate.routeNo && (
                                <div className="font-semibold text-white flex items-center gap-1.5">
                                  <MapPin aria-hidden="true" className="w-3.5 h-3.5 text-amber-500" />
                                  <span>{rate.routeNo} {rate.routeName ? `– ${rate.routeName}` : ''}</span>
                                </div>
                              )}
                              {rate.employeeId && (
                                <div className="text-xs text-slate-300 flex items-center gap-1.5">
                                  <UserCheck aria-hidden="true" className="w-3.5 h-3.5 text-blue-500" />
                                  <span>
                                    {rate.employeeName || `Employee #${rate.employeeId}`}
                                    {tier === 1 && (
                                      <span className="text-[11px] font-medium ml-1">
                                        (Strict assignment rate)
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {!rate.routeId && !rate.employeeId && (
                                <span className="text-xs text-slate-400 italic">Board General Override</span>
                              )}
                              {rate.notes && (
                                <p className="text-xs text-slate-400 truncate max-w-xs">{rate.notes}</p>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold uppercase text-xs text-slate-200">
                                  {rate.shiftType || 'All Shifts'}
                                </span>
                                {renderWeekDaysBadge(rate.weekDays)}
                              </div>
                              <div className="text-xs text-slate-500 capitalize">
                                {rate.jobTitle || 'Any Job Title'}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-base font-bold text-white">
                              ${rate.payRate !== undefined ? rate.payRate.toFixed(2) : '--'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-sm font-semibold text-slate-300">
                              {rate.eiHours !== undefined ? `${rate.eiHours} hrs` : '--'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-xs text-slate-400 space-y-0.5">
                              <div>From: <span className="font-medium">{rate.effectiveDate}</span></div>
                              <div>To: <span className="font-medium">{rate.retireDate || 'Never'}</span></div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={`Edit custom rate for ${rate.routeNo || rate.employeeName || rate.schoolBoardCode || rate.id}`}
                                onClick={() => {
                                  setEditingCustomRate(rate);
                                  setIsCustomModalOpen(true);
                                }}
                                className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                                title="Edit"
                              >
                                <Pencil aria-hidden="true" className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete custom rate for ${rate.routeNo || rate.employeeName || rate.schoolBoardCode || rate.id}`}
                                onClick={() => handleDeleteCustomRate(rate.id)}
                                className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                                title="Delete"
                              >
                                <Trash2 aria-hidden="true" className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RATE RESOLUTION SIMULATOR */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inputs Column */}
          <div className="lg:col-span-6 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calculator aria-hidden="true" className="w-5 h-5 text-amber-500" />
                Rate Resolution Simulator
              </h3>
              <p className="text-xs text-slate-400">
                Test how the dispatch engine evaluates active rates following the 4-tier hierarchy.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={simDateId} className="block text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Calculation Date
                  </label>
                  <span className="text-xs font-bold">
                    {getSimDayInfo(simDate)}
                  </span>
                </div>
                <input
                  id={simDateId}
                  type="date"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-base sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                />
              </div>

              <div>
                <label htmlFor={simBoardFieldId} className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                  School Board *
                </label>
                <select
                  id={simBoardFieldId}
                  value={simBoardId}
                  onChange={(e) => setSimBoardId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-base sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  {lookups.schoolBoards.map((b) => (
                    <option key={b.schoolBoardId} value={b.schoolBoardId}>
                      {b.schoolBoardCode} – {b.schoolBoardName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor={simRouteFieldId} className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                    Route (Optional)
                  </label>
                  <select
                    id={simRouteFieldId}
                    value={simRouteId}
                    onChange={(e) => {
                      setSimRouteId(e.target.value === '' ? '' : Number(e.target.value));
                      setSimShiftId('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-base sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    <option value="">No Route Selected</option>
                    {lookups.routes.map((r) => (
                      <option key={r.busRouteId} value={r.busRouteId}>
                        {r.routeNo} – {r.routeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={simShiftFieldId} className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                    Shift (Optional)
                  </label>
                  <select
                    id={simShiftFieldId}
                    value={simShiftId}
                    onChange={(e) => setSimShiftId(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!simRouteId}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-base sm:text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    <option value="">Any Shift</option>
                    {lookups.routes
                      .find((r) => r.busRouteId === Number(simRouteId))
                      ?.shifts.map((s) => (
                        <option key={s.shiftId} value={s.shiftId}>
                          Shift #{s.shiftId} ({s.shiftType})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor={simEmployeeFieldId} className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                  Assigned Employee (Optional)
                </label>
                <select
                  id={simEmployeeFieldId}
                  value={simEmployeeId}
                  onChange={(e) => setSimEmployeeId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-base sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  <option value="">No Specific Employee</option>
                  {lookups.employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.lastName}, {emp.firstName} {emp.jobPosition ? `(${emp.jobPosition})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor={simJobTitleFieldId} className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                    Job Title
                  </label>
                  <select
                    id={simJobTitleFieldId}
                    value={simJobTitle}
                    onChange={(e) => setSimJobTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-base sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    <option value="driver">Driver</option>
                    <option value="attendant">Attendant</option>
                    <option value="lpn">LPN</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={simShiftTypeFieldId} className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                    Shift Type
                  </label>
                  <select
                    id={simShiftTypeFieldId}
                    value={simShiftType}
                    onChange={(e) => setSimShiftType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-base sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    <option value="AM">AM</option>
                    <option value="MIDDAY">MIDDAY / NOON</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={isCalculating}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                <Calculator aria-hidden="true" className="w-4 h-4" />
                {isCalculating ? 'Evaluating Hierarchy...' : 'Evaluate Rate Hierarchy'}
              </button>
            </div>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-6 space-y-5">
            {simResult && (
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm space-y-6 animate-fade-in">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Simulation Outcome
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl">
                      <CheckCircle2 aria-hidden="true" className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white">
                        {simResult.matchedRuleDesc}
                      </h4>
                      <span className="text-xs text-slate-500">
                        Evaluated under Active Rule Matrix
                      </span>
                    </div>
                  </div>
                </div>

                {/* Big Metric Display */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border">
                    <span className="text-xs font-bold uppercase tracking-wide block mb-1">
                      Calculated Pay Rate
                    </span>
                    <div className="text-3xl font-black">
                      ${simResult.payRate.toFixed(2)}
                      <span className="text-xs font-semibold text-slate-500 ml-1">/ run</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border">
                    <span className="text-xs font-bold uppercase tracking-wide block mb-1">
                      EI Credited Hours
                    </span>
                    <div className="text-3xl font-black">
                      {simResult.eiHours.toFixed(2)}
                      <span className="text-xs font-semibold text-slate-500 ml-1">hrs</span>
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Hierarchy Evaluation Audit */}
                <div className="space-y-3 border-t border-slate-800 pt-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Four-Tier Evaluation Audit
                  </h5>

                  <div className="space-y-2 text-xs">
                    {/* Tier 1 */}
                    <div
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        simResult.matchedTier === 1
                          ? '   font-bold'
                          : 'bg-slate-800/40 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px]">
                          1
                        </span>
                        <span>Tier 1: Route / Shift + Employee Specific Override</span>
                      </div>
                      {simResult.matchedTier === 1 ? (
                        <span className="text-emerald-600 font-bold">MATCHED & APPLIED</span>
                      ) : (
                        <span>Skipped</span>
                      )}
                    </div>

                    {/* Tier 2 */}
                    <div
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        simResult.matchedTier === 2
                          ? '   font-bold'
                          : 'bg-slate-800/40 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px]">
                          2
                        </span>
                        <span>Tier 2: Employee Universal Rate Override</span>
                      </div>
                      {simResult.matchedTier === 2 ? (
                        <span className="text-emerald-600 font-bold">MATCHED & APPLIED</span>
                      ) : (
                        <span>Skipped</span>
                      )}
                    </div>

                    {/* Tier 3 */}
                    <div
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        simResult.matchedTier === 3
                          ? '   font-bold'
                          : 'bg-slate-800/40 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px]">
                          3
                        </span>
                        <span>Tier 3: Route / Shift General Override</span>
                      </div>
                      {simResult.matchedTier === 3 ? (
                        <span className="text-emerald-600 font-bold">MATCHED & APPLIED</span>
                      ) : (
                        <span>Skipped</span>
                      )}
                    </div>

                    {/* Tier 4 */}
                    <div
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        simResult.matchedTier === 4
                          ? '   font-bold'
                          : 'bg-slate-800/40 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px]">
                          4
                        </span>
                        <span>Tier 4: School Board Baseline ({simJobTitle.toUpperCase()} {simShiftType})</span>
                      </div>
                      {simResult.matchedTier === 4 ? (
                        <span className="text-emerald-600 font-bold">MATCHED & APPLIED</span>
                      ) : (
                        <span>Skipped</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DISPATCH SHIFT PAY RATES */}
      {activeTab === 'dispatch-rates' && (
        <Suspense fallback={TabFallback}>
          <DispatchPaySettingsTab />
        </Suspense>
      )}

      {/* TAB 5: DAILY DISPATCH PAYROLL */}
      {activeTab === 'dispatch-payroll' && (
        <Suspense fallback={TabFallback}>
          <DispatchDailyPayrollTab
            onNavigateToFinanceLog={openPayrollFinanceLog}
            onSelectEmployee={onSelectEmployee}
          />
        </Suspense>
      )}

      {/* TAB 6: PAYROLL DEPARTMENT LOG */}
      {activeTab === 'payroll-dept-log' && (
        <Suspense fallback={TabFallback}>
          <PayrollDepartmentLogView onSelectEmployee={onSelectEmployee} />
        </Suspense>
      )}

      {/* TAB 7: BI-WEEKLY PAYROLL SUMMARY */}
      {activeTab === 'biweekly-payroll' && (
        <Suspense fallback={TabFallback}>
          <BiweeklyPayrollView
            boards={propsBoards}
            employees={propsEmployees}
            routes={propsRoutes}
            onSelectEmployee={onSelectEmployee}
          />
        </Suspense>
      )}

      {/* Modals */}
      {isCustomModalOpen && (
        <Suspense fallback={null}>
          <CustomRateModal
            isOpen
            onClose={() => {
              setIsCustomModalOpen(false);
              setEditingCustomRate(null);
            }}
            onSave={handleSaveCustomRate}
            editingRate={editingCustomRate}
            lookups={lookups}
          />
        </Suspense>
      )}

      {isBoardModalOpen && (
        <Suspense fallback={null}>
          <BoardBaseRateModal
            isOpen
            onClose={() => {
              setIsBoardModalOpen(false);
              setEditingBoardDTO(null);
            }}
            boardDTO={editingBoardDTO}
            onSaveRate={async (rate) => {
              await PayrollService.createRate(rate);
              const actor: PayrollOperationActor = {
                userId: currentUser?.uid || 'dispatcher-1',
                userName: currentUser?.displayName || currentUser?.email || 'Dispatcher',
                userEmail: currentUser?.email,
                userRole: currentUser?.role || 'dispatcher',
              };
              void PayrollOperationLogService.logOperation({
                category: 'base_rate',
                action: 'create',
                targetId: String(rate.schoolBoardId ?? 'board'),
                targetIdentifier: `BOARD-${rate.schoolBoardId}`,
                targetName: rate.schoolBoardName || `Board #${rate.schoolBoardId}`,
                amount: rate.payRate,
                summary: `Updated School Board Base Rate: $${rate.payRate ?? 0} for ${rate.jobTitle || 'staff'} (${rate.shiftType || 'AM'}).`,
                actor,
              }).catch((err) => console.warn('Payroll base rate audit log failed:', err));
            }}
            onRefresh={() => loadData(true)}
          />
        </Suspense>
      )}
    </PageShell>
  );
};


