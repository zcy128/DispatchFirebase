import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ShieldCheck, LogOut, Radio, Menu, Globe, Sun, Moon, MessageSquare, Sparkles } from 'lucide-react';

import { PWAInstallHeaderButton } from './PWAInstallBanner';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  onOpenChat?: () => void;
  chatUnreadCount?: number;
  onOpenAICopilot?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, onOpenChat, chatUnreadCount, onOpenAICopilot }) => {
  const { currentUser, isMockMode, logout } = useAuth();
  const { lang, setLang, t, isFrench } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title={isFrench ? 'Ouvrir le menu' : 'Open Menu'}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950/60 border border-slate-700/60 flex items-center justify-center p-0.5 shadow-md shadow-amber-500/10 flex-shrink-0 overflow-hidden">
          <img
            src="/pcy_tech_logo.svg"
            alt="PCY Tech"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/pcy_tech_app_icon.jpg';
            }}
          />
        </div>
        <div>
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <span className="font-extrabold tracking-tight text-base sm:text-lg text-slate-100">PCY Tech</span>
            <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded uppercase tracking-wider">
              Dispatch Cloud
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            {isFrench
              ? "Centre d'opérations intelligent de flotte d'autobus scolaires"
              : 'Intelligent School Bus Fleet Operations Center'}
          </p>
        </div>
      </div>

      {/* Center Operational Live Status */}
      <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span className="text-slate-300 font-medium">{t.header.cloudRunActive}</span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400">{t.header.firestoreLinked}</span>
      </div>

      {/* Right User & Actions */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Language Selector */}
        <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-lg p-0.5 text-xs">
          <Globe className="w-3.5 h-3.5 text-slate-400 mx-1.5 hidden sm:inline" />
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2 py-0.5 rounded font-bold transition text-[11px] ${
              lang === 'en'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="English"
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang('fr')}
            className={`px-2 py-0.5 rounded font-bold transition text-[11px] ${
              lang === 'fr'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Français"
          >
            FR
          </button>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-300 hover:text-amber-400 hover:border-amber-500/50 transition flex items-center justify-center shadow-sm"
          title={theme === 'dark' ? t.theme.lightMode : t.theme.darkMode}
          aria-label={t.theme.switchTheme}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-amber-500" />
          )}
        </button>

        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="p-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-300 hover:text-amber-400 hover:border-amber-500/50 transition flex items-center justify-center shadow-sm relative"
            title="Operations Chat"
            aria-label="Open Operations Chat"
          >
            <MessageSquare className="w-4 h-4 text-amber-400" />
            {chatUnreadCount && chatUnreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center border border-slate-900 shadow-sm animate-pulse">
                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
              </span>
            ) : null}
          </button>
        )}

        {onOpenAICopilot && (
          <button
            type="button"
            onClick={onOpenAICopilot}
            className="p-1.5 px-2.5 rounded-lg bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-400 hover:via-indigo-500 hover:to-purple-500 text-white font-bold transition flex items-center justify-center space-x-1.5 shadow-sm shadow-indigo-500/20 group"
            title="AI Assistant (Ctrl+J)"
            aria-label="Open AI Assistant"
          >
            <Sparkles className="w-4 h-4 transition-transform group-hover:rotate-12" />
            <span className="text-[11px] font-bold hidden sm:inline">AI Copilot</span>
          </button>
        )}

        <PWAInstallHeaderButton />

        <div className="flex items-center space-x-3">
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-200">
              {currentUser?.displayName || currentUser?.email || t.header.dispatcher}
            </span>
            <div className="flex items-center justify-end space-x-1">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400 uppercase font-mono font-medium">
                {currentUser?.role || t.header.admin}
                {isMockMode && ` (${t.header.demoMode})`}
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title={t.header.signOut}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
