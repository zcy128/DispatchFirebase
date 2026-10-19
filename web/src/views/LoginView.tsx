import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { ShieldAlert, KeyRound, ArrowRight, Globe, Sun, Moon } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithFirebase, loginAsMockAdmin } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [identifier, setIdentifier] = useState('admin@dispatch.pcy.ca');
  const [password, setPassword] = useState('Dispatch2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await loginWithFirebase(identifier, password);
    } catch (err: any) {
      const errMsg = err.message || 'Login failed. Please check credentials or use Quick Demo Mode.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 relative">
      {/* Top Right Controls (Theme & Language) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center space-x-2">
        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition shadow-lg flex items-center justify-center"
          title={theme === 'dark' ? t.theme.lightMode : t.theme.darkMode}
          aria-label={t.theme.switchTheme}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-amber-500" />
          )}
        </button>

        {/* Language Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs shadow-lg">
          <Globe className="w-3.5 h-3.5 text-slate-400 mx-2" />
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
              lang === 'en'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('fr')}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
              lang === 'fr'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Français
          </button>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center p-1 shadow-2xl shadow-amber-500/20 mb-4 bg-slate-900 border border-slate-800 overflow-hidden">
          <img
            src="/pcy_tech_logo.svg"
            alt="PCY Tech"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/pcy_tech_app_icon.jpg';
            }}
          />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">PCY Tech • Dispatch Cloud</h2>
        <p className="mt-1 text-xs text-slate-400">
          Intelligent Fleet & School Bus Operations Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  {t.login.usernameLabel}
                </label>
                <span className="text-[10px] text-amber-400 font-mono">@dispatch.pcy.ca</span>
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition placeholder:text-slate-500 font-mono"
                placeholder={t.login.usernamePlaceholder}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Enter your username (e.g. <span className="text-amber-400 font-mono font-semibold">driver1d</span>) or full email.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t.login.passwordLabel}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 transition"
                placeholder={t.login.passwordPlaceholder}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Default initial password: <span className="text-amber-400 font-mono font-semibold">Dispatch2026!</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? t.login.signingIn : t.login.signInButton}</span>
            </button>
          </form>

          {/* Instant Quick Demo Admin Mode */}
          <div className="pt-4 border-t border-slate-800">
            <div className="text-center mb-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Demo Access
              </span>
            </div>
            <button
              type="button"
              onClick={() => loginAsMockAdmin()}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs rounded-xl transition"
            >
              <span>{t.login.quickDemoAdmin}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              {t.login.secureNotice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
