import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface PageAIContext {
  /** Active navigation tab / page identifier (e.g. 'dispatch', 'routes', 'vehicles'). */
  activePage: string;
  /** Human-readable page title shown in the AI drawer context badge. */
  pageTitle?: string;
  /** Currently viewed date in the active page (YYYY-MM-DD), e.g. Dispatch Workbench date. */
  selectedDate?: string;
  /** Currently active yard filter, if any. */
  yardFilter?: string;
  /** Optional focused entity ID/code (route, vehicle, employee, etc.). */
  selectedEntityId?: string;
  /** Lightweight key/value hints about the active view state. */
  summaryHints?: Record<string, string>;
}

interface AIContextValue {
  pageContext: PageAIContext;
  setPageContext: React.Dispatch<React.SetStateAction<PageAIContext>>;
  updatePageContext: (patch: Partial<PageAIContext>) => void;
  isAIOpen: boolean;
  setIsAIOpen: (open: boolean) => void;
  openAI: (patch?: Partial<PageAIContext>) => void;
  closeAI: () => void;
  refreshCounter: number;
  triggerPageRefresh: () => void;
}

const AIContext = createContext<AIContextValue | null>(null);

interface AIProviderProps {
  children: React.ReactNode;
  activeTab: string;
  isAIOpen: boolean;
  setIsAIOpen: (open: boolean) => void;
}

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Fleet Pulse',
  dispatch: 'Dispatch Workbench',
  dispatch_log: 'Dispatch Change Log',
  dispatch_payroll: 'Daily Payroll',
  temporary_assignments: 'Route Openings & Covers',
  assignment_tracking: 'Assignment Tracking',
  routes: 'Routes',
  staging_routes: 'Staging Routes',
  charters: 'Charter Management',
  employees: 'Employees',
  students: 'Students',
  student_absences: 'Student Absences',
  student_incidents: 'Student Incidents',
  schools: 'Schools & Boards',
  school_calendar: 'School Calendar',
  vehicles: 'Fleet & Vehicles',
  pre_trip: 'Pre-Trip Inspections',
  defect_reports: 'Defect Reports',
  vehicle_inspections: 'PM & Inspections',
  vehicle_signout: 'Vehicle Sign-Out',
  yards: 'Yards',
  compliance: 'Compliance Radar',
  training: 'Training',
  hazard_reports: 'Hazard Reports',
  route_assessments: 'Route Assessments',
  time_off: 'Time Off Requests',
  expenses: 'Expense Reimbursements',
  biweekly_payroll: 'Bi-Weekly Payroll',
  payroll_rates: 'Payroll Base Rates',
  payroll_dept_log: 'Payroll Dept Log',
  company_contacts: 'Company Contacts',
  roles: 'Roles & Permissions',
  audit_logs: 'System Audit Logs',
  login_logs: 'Login Audit Logs',
  error_logs: 'Client Error Logs',
  external_sync: 'External Data Sync',
  settings: 'System Settings',
};

export function getPageDisplayLabel(activePage: string): string {
  return PAGE_LABELS[activePage] || activePage;
}

/**
 * Provides page-scoped AI context (current tab, selected date, filters) and drawer controls
 * across the entire web console.
 */
export const AIProvider: React.FC<AIProviderProps> = ({
  children,
  activeTab,
  isAIOpen,
  setIsAIOpen,
}) => {
  const [pageContext, setPageContext] = useState<PageAIContext>({
    activePage: activeTab,
    pageTitle: getPageDisplayLabel(activeTab),
  });
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    setPageContext((prev) => {
      if (prev.activePage === activeTab) return prev;
      return {
        activePage: activeTab,
        pageTitle: getPageDisplayLabel(activeTab),
      };
    });
  }, [activeTab]);

  const updatePageContext = useCallback((patch: Partial<PageAIContext>) => {
    setPageContext((prev) => ({
      ...prev,
      ...patch,
      pageTitle: patch.pageTitle || getPageDisplayLabel(patch.activePage || prev.activePage),
    }));
  }, []);

  const openAI = useCallback(
    (patch?: Partial<PageAIContext>) => {
      if (patch) {
        updatePageContext(patch);
      }
      setIsAIOpen(true);
    },
    [setIsAIOpen, updatePageContext]
  );

  const closeAI = useCallback(() => {
    setIsAIOpen(false);
  }, [setIsAIOpen]);

  const triggerPageRefresh = useCallback(() => {
    setRefreshCounter((prev) => prev + 1);
  }, []);

  const value = useMemo<AIContextValue>(
    () => ({
      pageContext,
      setPageContext,
      updatePageContext,
      isAIOpen,
      setIsAIOpen,
      openAI,
      closeAI,
      refreshCounter,
      triggerPageRefresh,
    }),
    [pageContext, updatePageContext, isAIOpen, setIsAIOpen, openAI, closeAI, refreshCounter, triggerPageRefresh]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

/**
 * Access the current page-scoped AI context and drawer controls.
 * Safe to call outside AIProvider (returns null).
 */
export function useAIOptional(): AIContextValue | null {
  return useContext(AIContext);
}

/**
 * Synchronizes a view's live state (e.g. Dispatch selectedDate or yardFilter)
 * into the active PageAIContext whenever dependencies change.
 */
export function useRegisterPageAIContext(
  activePage: string,
  options: Omit<PageAIContext, 'activePage'>
): void {
  const ai = useAIOptional();
  const { pageTitle, selectedDate, yardFilter, selectedEntityId, summaryHints } = options;
  const hintsKey = summaryHints ? JSON.stringify(summaryHints) : '';

  useEffect(() => {
    if (!ai) return;
    ai.updatePageContext({
      activePage,
      pageTitle,
      selectedDate,
      yardFilter,
      selectedEntityId,
      summaryHints: hintsKey ? JSON.parse(hintsKey) : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai?.updatePageContext, activePage, pageTitle, selectedDate, yardFilter, selectedEntityId, hintsKey]);
}
