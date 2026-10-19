import React from 'react';
import { NavTab } from './Sidebar';
import {
  LayoutDashboard,
  Radio,
  Route as RouteIcon,
  Users,
  Menu
} from 'lucide-react';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMore: () => void;
  hasComplianceAlerts: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenMore,
  hasComplianceAlerts
}) => {
  const primaryTabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Pulse', icon: LayoutDashboard },
    { id: 'dispatch', label: 'Dispatch', icon: Radio },
    { id: 'routes', label: 'Routes', icon: RouteIcon },
    { id: 'employees', label: 'HR', icon: Users },
  ];

  const isMoreActive = !primaryTabs.some(t => t.id === currentTab);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 flex items-center justify-around shadow-2xl safe-area-pb">
      {primaryTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
              isActive
                ? 'text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-amber-400' : ''} transition-transform`} />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
          </button>
        );
      })}

      {/* More / All Menus Button */}
      <button
        onClick={onOpenMore}
        className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all relative ${
          isMoreActive
            ? 'text-amber-400 font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <Menu className={`w-5 h-5 ${isMoreActive ? 'scale-110 text-amber-400' : ''} transition-transform`} />
          {hasComplianceAlerts && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />
          )}
          {isMoreActive && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
          )}
        </div>
        <span className="text-[10px] mt-1 tracking-tight">More</span>
      </button>
    </nav>
  );
};
