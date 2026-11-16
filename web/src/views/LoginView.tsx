import React, { useId, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { ShieldAlert, KeyRound, ArrowRight, Globe, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { isDemoMode } from '../config/appMode';

export const LoginView: React.FC = () => {
  const { loginWithFirebase, loginAsMockAdmin } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [identifier, setIdentifier] = useState('admin@dispatch.pcy.ca');
  const [password, setPassword] = useState(isDemoMode ? 'Dispatch2026!' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierInvalid, setIdentifierInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = useId();
  const identifierHintId = `${uid}-identifier-hint`;
  const identifierErrorId = `${uid}-identifier-error`;
  const passwordHintId = `${uid}-password-hint`;
  const passwordErrorId = `${uid}-password-error`;
  const toggleWarningId = `${uid}-toggle-warning`;

  const focusVisibleClass =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400';

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

  const identifierDescribedBy = [
    identifierHintId,
    identifierInvalid ? identifierErrorId : null
  ]
    .filter(Boolean)
    .join(' ');

  const passwordDescribedBy = [
    isDemoMode ? passwordHintId : null,
    passwordInvalid ? passwordErrorId : null
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 relative">
      {/* Top Right Controls (Theme & Language) */}
      <header className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center space-x-2">
        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className={`min-w-[40px] min-h-[40px] p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition shadow-lg flex items-center justify-center ${focusVisibleClass}`}
          title={theme === 'dark' ? t.theme.lightMode : t.theme.darkMode}
          aria-label={t.theme.switchTheme}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
          ) : (
            <Moon className="w-4 h-4 text-amber-500" aria-hidden="true" />
          )}
        </button>

        {/* Language Switcher */}
        <div
          role="group"
          aria-label={t.login.languageSwitcher}
          className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs shadow-lg"
        >
          <Globe className="w-3.5 h-3.5 text-slate-400 mx-2" aria-hidden="true" />
          <button
            type="button"
            lang="en"
            aria-pressed={lang === 'en'}
            onClick={() => setLang('en')}
            className={`px-2.5 py-1.5 min-h-[32px] rounded-lg font-bold text-xs transition ${focusVisibleClass} ${
              lang === 'en'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            type="button"
            lang="fr"
            aria-pressed={lang === 'fr'}
            onClick={() => setLang('fr')}
            className={`px-2.5 py-1.5 min-h-[32px] rounded-lg font-bold text-xs transition ${focusVisibleClass} ${
              lang === 'fr'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Français
          </button>
        </div>
      </header>

      <main className="w-full">
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
          <h1 className="text-2xl font-black tracking-tight text-white">PCY Tech • Dispatch Cloud</h1>
          <p className="mt-1 text-xs text-slate-400">
            Intelligent Fleet & School Bus Operations Platform
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 space-y-6">
            {error && (
              <div
                role="alert"
                className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2"
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="login-identifier" className="block text-xs font-semibold text-slate-300">
                    {t.login.usernameLabel}
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">@dispatch.pcy.ca</span>
                </div>
                <p id={identifierHintId} className="text-[10px] text-slate-400 mb-1.5">
                  Enter your username (e.g. <span className="text-amber-400 font-mono font-semibold">driver1d</span>) or full email.
                </p>
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  enterKeyHint="next"
                  aria-invalid={identifierInvalid ? 'true' : 'false'}
                  aria-describedby={identifierDescribedBy}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (identifierInvalid && e.currentTarget.validity.valid) {
                      setIdentifierInvalid(false);
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.currentTarget.validity.valid) {
                      setIdentifierInvalid(true);
                    }
                  }}
                  onInvalid={() => setIdentifierInvalid(true)}
                  className={`login-input w-full min-h-[48px] bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white focus:border-amber-500 transition placeholder:text-slate-500 font-mono ${focusVisibleClass}`}
                  placeholder={t.login.usernamePlaceholder}
                />
                {identifierInvalid && (
                  <p id={identifierErrorId} className="text-xs text-rose-400 mt-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{t.login.usernameRequired}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.login.passwordLabel}
                </label>
                {isDemoMode && (
                  <p id={passwordHintId} className="text-[10px] text-slate-400 mb-1.5">
                    Default initial password: <span className="text-amber-400 font-mono font-semibold">Dispatch2026!</span>
                  </p>
                )}
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    enterKeyHint="done"
                    aria-invalid={passwordInvalid ? 'true' : 'false'}
                    aria-describedby={passwordDescribedBy}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordInvalid && e.currentTarget.validity.valid) {
                        setPasswordInvalid(false);
                      }
                    }}
                    onBlur={(e) => {
                      if (!e.currentTarget.validity.valid) {
                        setPasswordInvalid(true);
                      }
                    }}
                    onInvalid={() => setPasswordInvalid(true)}
                    className={`login-input w-full min-h-[48px] bg-slate-800 border border-slate-700 rounded-xl pl-3.5 pr-12 py-2.5 text-base sm:text-sm text-white focus:border-amber-500 transition ${focusVisibleClass}`}
                    placeholder={t.login.passwordPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
                    aria-describedby={toggleWarningId}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 transition ${focusVisibleClass}`}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                  <span id={toggleWarningId} className="sr-only">
                    {t.login.passwordVisibilityWarning}
                  </span>
                </div>
                {passwordInvalid && (
                  <p id={passwordErrorId} className="text-xs text-rose-400 mt-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{t.login.passwordRequired}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full min-h-[48px] flex items-center justify-center space-x-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50 ${focusVisibleClass}`}
              >
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>{loading ? t.login.signingIn : t.login.signInButton}</span>
              </button>
            </form>

            {isDemoMode && (
              <div className="pt-4 border-t border-slate-800">
                <div className="text-center mb-3">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Demo Access
                  </span>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError(null);
                      await loginAsMockAdmin();
                    } catch (err: any) {
                      setError(err?.message || 'Demo login failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className={`w-full min-h-[48px] flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs rounded-xl transition disabled:opacity-50 ${focusVisibleClass}`}
                >
                  <span>{t.login.quickDemoAdmin}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2">
                  {t.login.secureNotice}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
