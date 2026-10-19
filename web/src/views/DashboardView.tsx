import React from 'react';
import { DashboardStats, Employee } from '../types/employee';
import { Users, AlertTriangle, Building2, CheckCircle2, ShieldAlert, ArrowRight, Phone } from 'lucide-react';

interface DashboardViewProps {
  stats: DashboardStats;
  employees: Employee[];
  onNavigateTab: (tab: any) => void;
  onSelectEmployee: (emp: Employee) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  employees,
  onNavigateTab,
  onSelectEmployee
}) => {
  const expiringDrivers = employees.filter((e) => {
    if (!e.driverLicense?.expirationDate) return false;
    const diffDays =
      (new Date(e.driverLicense.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Fleet Pulse Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>Office Dispatch Operations Control</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              School Bus Fleet & Staff Master Center
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Real-time synchronization between Firebase Firestore employee master data and Cloud Run Go API service.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigateTab('employees')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-amber-500/20 flex items-center space-x-2"
            >
              <span>View Employee Roster</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Personnel</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{stats.totalEmployees}</span>
            <span className="text-xs text-emerald-400 font-medium">
              {stats.activeEmployees} active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Master records in Firestore</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Licensed Bus Drivers</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{stats.totalDrivers}</span>
            <span className="text-xs text-slate-400">CDL Class B/CZ</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Qualified for routes</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">License Expirations</span>
            <div className={`p-2 rounded-lg ${stats.licenseExpiringSoon > 0 ? 'bg-rose-500/10 text-rose-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className={`text-3xl font-black ${stats.licenseExpiringSoon > 0 ? 'text-amber-400' : 'text-white'}`}>
              {stats.licenseExpiringSoon}
            </span>
            <span className="text-xs text-amber-400 font-medium">Within 30 days</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Requires immediate renewal</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Active Depots</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">
              {Object.keys(stats.yardDistribution || {}).length || 3}
            </span>
            <span className="text-xs text-slate-400">Yards</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">HQ, East, West</p>
        </div>
      </div>

      {/* Main Grid: Expiration Alerts & Yard Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Urgent Compliance & Drivers */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Driver CDL Expiration Watchlist</h2>
            </div>
            <button
              onClick={() => onNavigateTab('compliance')}
              className="text-xs text-amber-400 hover:underline font-semibold"
            >
              View Full Compliance Radar &rarr;
            </button>
          </div>

          {expiringDrivers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              All active driver licenses are currently compliant.
            </div>
          ) : (
            <div className="space-y-2.5">
              {expiringDrivers.map((driver) => {
                const days = Math.ceil(
                  (new Date(driver.driverLicense!.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div
                    key={driver.id}
                    onClick={() => onSelectEmployee(driver)}
                    className="p-3.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 flex items-center justify-between cursor-pointer transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                        {driver.firstName[0]}
                        {driver.lastName[0]}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-white">{driver.fullName}</span>
                          <span className="font-mono text-xs text-slate-400">[{driver.employeeNumber}]</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {driver.yardId} • {driver.driverLicense?.licenseClass}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {days} days remaining
                      </span>
                      {driver.mobilePhone && (
                        <a
                          href={`tel:${driver.mobilePhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-emerald-400"
                          title={`Call ${driver.mobilePhone}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
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
            <span className="font-semibold text-slate-300 block">Dispatch Pro-Tip:</span>
            <span>
              Office staff can filter roster records by specific Yard when assigning bus routes and shifts.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
