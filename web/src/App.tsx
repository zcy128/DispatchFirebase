import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AppRouter } from './app/AppRouter';
import { ChatAlertToast } from './app/ChatAlertToast';
import { GlobalEntityOverlays } from './app/GlobalEntityOverlays';
import { useEntityOverlays } from './app/useEntityOverlays';
import { useFleetData } from './app/useFleetData';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { TimeOffApproverAgentWindow } from './components/time_off/TimeOffApproverAgentWindow';
import { BottomNav } from './components/common/BottomNav';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/common/Header';
import { MobileDrawer } from './components/common/MobileDrawer';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { NavTab, Sidebar } from './components/common/Sidebar';
import { AIProvider } from './contexts/AIContext';
import { useAuth } from './contexts/AuthContext';
import { useChatNotifications } from './hooks/useChatNotifications';
import { CreateParentChannelPayload } from './types/chat';
import { getLocalTodayString } from './utils/dateUtils';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { NavDomainId } from './utils/navigationConfig';
import { hasPageAccess } from './utils/permissions';
import { LoginView } from './views/LoginView';

const AICopilotDrawer = lazyWithRetry(
  () => import('./components/ai/AICopilotDrawer').then((m) => ({ default: m.AICopilotDrawer })),
  'AICopilotDrawer'
);

const ACCESSIBLE_TAB_ORDER: NavTab[] = [
  'dashboard', 'dispatch', 'routes', 'staging_routes', 'dispatch_payroll',
  'employees', 'time_off', 'payroll', 'biweekly_payroll', 'payroll_dept_log',
  'temporary_assignments', 'dispatch_log', 'assignment_history',
  'vehicles', 'defects', 'vehicle_signouts', 'yards',
  'compliance', 'training', 'students', 'student_incidents',
  'hazards', 'route_assessments', 'schools', 'calendar',
  'expenses', 'company_contacts', 'roles', 'login_logs',
  'audit_logs', 'error_logs', 'external_sync', 'settings',
];

export const AppContent: React.FC = () => {
  const { currentUser, loading: authLoading, updateCurrentUser } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeDomain, setActiveDomain] = useState<NavDomainId>('home');
  const mainRef = useRef<HTMLElement>(null);
  const [dispatchLogDate, setDispatchLogDate] = useState<string>(() => getLocalTodayString());
  const [calendarSelectedSchoolId, setCalendarSelectedSchoolId] = useState<number | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('pcy_sidebar_collapsed') === '1';
    }
    return false;
  });

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('pcy_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // Ignore localStorage quota or private browsing errors
      }
      return next;
    });
  }, []);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'ai' || params.get('ai') === '1';
    }
    return false;
  });
  const [aiCopilotMounted, setAiCopilotMounted] = useState<boolean>(isAICopilotOpen);
  const [chatInitialTargetUserId, setChatInitialTargetUserId] = useState<string | null>(null);
  const [chatInitialParent, setChatInitialParent] = useState<CreateParentChannelPayload | null>(null);

  const navigateToTab = useCallback((nextTab: NavTab) => {
    const startVT =
      typeof document !== 'undefined'
        ? (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } })
            .startViewTransition
        : undefined;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!startVT || prefersReducedMotion) {
      setCurrentTab(nextTab);
      mainRef.current?.focus({ preventScroll: true });
      return;
    }

    const transition = startVT.call(document, () => {
      flushSync(() => {
        setCurrentTab(nextTab);
      });
    });
    transition.finished.finally(() => {
      mainRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const handleOpenParentChat = useCallback((payload: CreateParentChannelPayload) => {
    setChatInitialParent(payload);
    setIsChatOpen(true);
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [currentTab]);

  useEffect(() => {
    void import('./services/clientErrorReporter').then(({ setClientErrorPage }) => {
      setClientErrorPage(currentTab);
    });
  }, [currentTab]);

  // Global shortcuts: Ctrl+J / Cmd+J to toggle AI Copilot, Ctrl+B / Cmd+B to toggle sidebar icon rail
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAiCopilotMounted(true);
        setIsAICopilotOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebarCollapse]);

  const currentUserId = currentUser?.employeeId || currentUser?.uid || '';
  const { unreadCount, activeAlert, clearUnread, dismissAlert } = useChatNotifications(
    currentUserId,
    isChatOpen,
    null,
    () => {
      setIsChatOpen(true);
      clearUnread();
    }
  );

  const fleet = useFleetData({ currentUser, updateCurrentUser });
  const overlays = useEntityOverlays({ currentUser, fleet });

  useEffect(() => {
    if (!currentUser) return;
    if (hasPageAccess(currentUser, currentTab)) return;
    const allowedTab = ACCESSIBLE_TAB_ORDER.find((t) => hasPageAccess(currentUser, t));
    if (allowedTab) {
      setCurrentTab(allowedTab);
    }
  }, [currentUser, currentTab]);

  const openDispatchChangeLog = useCallback((date?: string) => {
    if (date) setDispatchLogDate(date);
    setCurrentTab('dispatch_log');
  }, []);
  const openTemporaryAssignments = useCallback(() => setCurrentTab('temporary_assignments'), []);
  const openStudentAbsences = useCallback(() => setCurrentTab('student_absences'), []);
  const openPayrollFinanceLog = useCallback(() => setCurrentTab('payroll_dept_log'), []);
  const openDispatchPayroll = useCallback(() => setCurrentTab('dispatch_payroll'), []);
  const messageDriverFromDispatch = useCallback((driverId: string) => {
    setChatInitialTargetUserId(driverId);
    setIsChatOpen(true);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading Dispatch Hub...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginView />
        <PWAInstallBanner />
      </>
    );
  }

  return (
    <AIProvider
      activeTab={currentTab}
      isAIOpen={isAICopilotOpen}
      setIsAIOpen={(open) => {
        if (open) setAiCopilotMounted(true);
        setIsAICopilotOpen(open);
      }}
    >
      <div className="h-screen overflow-hidden bg-slate-950 flex flex-col text-slate-100 font-sans">
        <Header
          currentTab={currentTab}
          activeDomain={activeDomain}
          onSelectTab={navigateToTab}
          onSelectDomain={setActiveDomain}
          expiringLicenseCount={fleet.stats.licenseExpiringSoon}
          onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
          onOpenChat={() => {
            setIsChatOpen(true);
            clearUnread();
          }}
          chatUnreadCount={unreadCount}
          onOpenAICopilot={() => {
            setAiCopilotMounted(true);
            setIsAICopilotOpen((prev) => !prev);
          }}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          <Sidebar
            currentTab={currentTab}
            activeDomain={activeDomain}
            onSelectTab={navigateToTab}
            expiringLicenseCount={fleet.stats.licenseExpiringSoon}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
          />

          <main
            ref={mainRef}
            tabIndex={-1}
            className="app-main-transition flex-1 min-h-0 overflow-y-auto bg-slate-950/80 pb-20 md:pb-6 outline-none"
          >
            <AppRouter
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
              navigateToTab={navigateToTab}
              dataLoading={fleet.dataLoading}
              stats={fleet.stats}
              employees={fleet.employees}
              schools={fleet.schools}
              boards={fleet.boards}
              schoolStats={fleet.schoolStats}
              calendarSelectedSchoolId={calendarSelectedSchoolId}
              setCalendarSelectedSchoolId={setCalendarSelectedSchoolId}
              schoolCalendars={fleet.schoolCalendars}
              students={fleet.students}
              studentStats={fleet.studentStats}
              studentsMap={fleet.studentsMap}
              routes={fleet.routes}
              routeStats={fleet.routeStats}
              vehicles={fleet.vehicles}
              vehicleStats={fleet.vehicleStats}
              vehicleSyncSource={fleet.vehicleSyncSource}
              yards={fleet.yards}
              dispatchLogDate={dispatchLogDate}
              payrollBoardRates={fleet.payrollBoardRates}
              setPayrollBoardRates={fleet.setPayrollBoardRates}
              payrollRates={fleet.payrollRates}
              companyContacts={fleet.companyContacts}
              onSelectEmployee={overlays.setSelectedEmployee}
              onEditEmployee={overlays.handleEditEmployee}
              onDeleteEmployee={overlays.handleDeleteEmployee}
              onCreateEmployee={overlays.handleCreateEmployee}
              onManualSync={fleet.handleManualSync}
              onQuickReassignRole={overlays.handleQuickReassignRole}
              onSelectSchool={overlays.setSelectedSchool}
              onEditSchool={overlays.handleEditSchool}
              onCreateSchool={overlays.handleCreateSchool}
              onEditBoard={overlays.handleEditBoard}
              onCreateBoard={overlays.handleCreateBoard}
              onSchoolRefresh={fleet.handleSchoolRefresh}
              onSelectStudent={overlays.setSelectedStudent}
              onEditStudent={overlays.handleEditStudent}
              onEditStudentById={overlays.handleEditStudentById}
              onCreateStudent={overlays.handleCreateStudent}
              onDeleteStudent={overlays.handleDeleteStudent}
              onStudentRefresh={fleet.handleStudentRefresh}
              onStudentsLoaded={fleet.handleStudentsLoaded}
              onOpenParentChat={handleOpenParentChat}
              onSelectRoute={overlays.setSelectedRoute}
              onOpenAssignCrew={overlays.handleOpenAssignCrew}
              onRouteRefresh={fleet.handleRouteRefresh}
              onRouteUpdated={overlays.handleRouteUpdated}
              onSelectVehicle={overlays.setSelectedVehicle}
              onEditVehicle={overlays.handleEditVehicle}
              onCreateVehicle={overlays.handleCreateVehicle}
              onDeleteVehicle={overlays.handleDeleteVehicle}
              onVehicleRefresh={fleet.handleVehicleRefresh}
              onYardRefresh={fleet.handleYardRefresh}
              openSchoolDetails={overlays.openSchoolDetails}
              openStudentDetails={overlays.openStudentDetails}
              openStudentDetailsByRef={overlays.openStudentDetailsByRef}
              openEmployeeDetails={overlays.openEmployeeDetails}
              openVehicleDetails={overlays.openVehicleDetails}
              openDispatchChangeLog={openDispatchChangeLog}
              openTemporaryAssignments={openTemporaryAssignments}
              openStudentAbsences={openStudentAbsences}
              openDispatchPayroll={openDispatchPayroll}
              openPayrollFinanceLog={openPayrollFinanceLog}
              messageDriverFromDispatch={messageDriverFromDispatch}
            />
          </main>

          {aiCopilotMounted && (
            <Suspense fallback={null}>
              <AICopilotDrawer
                isOpen={isAICopilotOpen}
                onClose={() => setIsAICopilotOpen(false)}
                currentDate={dispatchLogDate}
                onShiftUpdated={fleet.handleRouteRefresh}
                onNavigateToChangeLog={(date) => {
                  if (date) setDispatchLogDate(date);
                  setCurrentTab('dispatch_log');
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsAICopilotOpen(false);
                  }
                }}
              />
            </Suspense>
          )}
        </div>

        <GlobalEntityOverlays
          setCurrentTab={setCurrentTab}
          employees={fleet.employees}
          vehicles={fleet.vehicles}
          routes={fleet.routes}
          schools={fleet.schools}
          boards={fleet.boards}
          studentsMap={fleet.studentsMap}
          selectedEmployee={overlays.selectedEmployee}
          closeEmployeeDrawer={overlays.closeEmployeeDrawer}
          handleEditEmployee={overlays.handleEditEmployee}
          handleDeleteEmployee={overlays.handleDeleteEmployee}
          isEmployeeModalOpen={overlays.isEmployeeModalOpen}
          closeEmployeeModal={overlays.closeEmployeeModal}
          handleSaveEmployee={overlays.handleSaveEmployee}
          editingEmployee={overlays.editingEmployee}
          employeeModalInitialTab={overlays.employeeModalInitialTab}
          selectedStudent={overlays.selectedStudent}
          setSelectedStudent={overlays.setSelectedStudent}
          studentDrawerInitialTab={overlays.studentDrawerInitialTab}
          handleEditStudent={overlays.handleEditStudent}
          handleDeleteStudent={overlays.handleDeleteStudent}
          handleOpenParentChat={handleOpenParentChat}
          isStudentModalOpen={overlays.isStudentModalOpen}
          setIsStudentModalOpen={overlays.setIsStudentModalOpen}
          handleSaveStudent={overlays.handleSaveStudent}
          editingStudent={overlays.editingStudent}
          studentModalInitialTab={overlays.studentModalInitialTab}
          selectedRoute={overlays.selectedRoute}
          setSelectedRoute={overlays.setSelectedRoute}
          openStudentDetails={overlays.openStudentDetails}
          handleOpenAssignCrew={overlays.handleOpenAssignCrew}
          handleRouteUpdated={overlays.handleRouteUpdated}
          isRouteAssignModalOpen={overlays.isRouteAssignModalOpen}
          setIsRouteAssignModalOpen={overlays.setIsRouteAssignModalOpen}
          assigningRoute={overlays.assigningRoute}
          handleSaveRouteCrew={overlays.handleSaveRouteCrew}
          selectedVehicle={overlays.selectedVehicle}
          setSelectedVehicle={overlays.setSelectedVehicle}
          handleEditVehicle={overlays.handleEditVehicle}
          handleDeleteVehicle={overlays.handleDeleteVehicle}
          isVehicleModalOpen={overlays.isVehicleModalOpen}
          setIsVehicleModalOpen={overlays.setIsVehicleModalOpen}
          handleSaveVehicle={overlays.handleSaveVehicle}
          editingVehicle={overlays.editingVehicle}
          selectedSchool={overlays.selectedSchool}
          setSelectedSchool={overlays.setSelectedSchool}
          handleEditSchool={overlays.handleEditSchool}
          handleDeleteSchool={overlays.handleDeleteSchool}
          isSchoolModalOpen={overlays.isSchoolModalOpen}
          setIsSchoolModalOpen={overlays.setIsSchoolModalOpen}
          handleSaveSchool={overlays.handleSaveSchool}
          editingSchool={overlays.editingSchool}
          isBoardModalOpen={overlays.isBoardModalOpen}
          setIsBoardModalOpen={overlays.setIsBoardModalOpen}
          handleSaveBoard={overlays.handleSaveBoard}
          editingBoard={overlays.editingBoard}
        />

        <PWAInstallBanner />

        <BottomNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenMore={() => setIsMobileDrawerOpen(true)}
          hasComplianceAlerts={fleet.stats.licenseExpiringSoon > 0}
        />

        <MobileDrawer
          isOpen={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          expiringLicenseCount={fleet.stats.licenseExpiringSoon}
        />

        {activeAlert && (
          <ChatAlertToast
            alert={activeAlert}
            onDismiss={dismissAlert}
            onOpenConversation={() => {
              setChatInitialTargetUserId(null);
              setIsChatOpen(true);
              clearUnread();
              dismissAlert();
            }}
          />
        )}

        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            clearUnread();
          }}
          initialTargetUserId={chatInitialTargetUserId}
          onClearInitialTarget={() => setChatInitialTargetUserId(null)}
          initialParentMetadata={chatInitialParent}
          onClearInitialParentMetadata={() => setChatInitialParent(null)}
        />

        <TimeOffApproverAgentWindow
          currentTab={currentTab}
          onNavigateToTimeOff={() => navigateToTab('time_off')}
        />
      </div>
    </AIProvider>
  );
};

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Application Error">
      <AppContent />
    </ErrorBoundary>
  );
}
