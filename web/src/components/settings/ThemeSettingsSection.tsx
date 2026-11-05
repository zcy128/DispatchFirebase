import { memo } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Check,
  Moon,
  Palette,
  Sun
} from 'lucide-react';

export const ThemeSettingsSection = memo(function ThemeSettingsSection() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{t.theme.appearance}</h2>
            <p className="text-xs text-slate-400">{t.theme.appearanceSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Light Theme Option Card */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-3 relative group ${
              theme === 'light'
                ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30'
                : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-700 text-slate-300'}`}>
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">{t.theme.lightMode}</span>
                  <span className="text-[11px] text-slate-400">Clean, crisp off-white interface</span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                  theme === 'light'
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-600'
                }`}
              >
                {theme === 'light' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* Miniature Mockup */}
            <div className="p-2.5 rounded-lg bg-slate-200 border border-slate-300 space-y-1.5 pointer-events-none">
              <div className="h-2 w-16 bg-slate-400 rounded-full" />
              <div className="flex items-center space-x-1.5">
                <div className="h-4 w-12 bg-amber-500 rounded" />
                <div className="h-4 flex-1 bg-white border border-slate-300 rounded" />
              </div>
              <div className="h-2 w-24 bg-slate-300 rounded-full" />
            </div>
          </button>

          {/* Dark Theme Option Card */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-3 relative group ${
              theme === 'dark'
                ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30'
                : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-700 text-slate-300'}`}>
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">{t.theme.darkMode}</span>
                  <span className="text-[11px] text-slate-400">High-contrast nighttime operations</span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                  theme === 'dark'
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-600'
                }`}
              >
                {theme === 'dark' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* Miniature Mockup */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 pointer-events-none">
              <div className="h-2 w-16 bg-slate-700 rounded-full" />
              <div className="flex items-center space-x-1.5">
                <div className="h-4 w-12 bg-amber-500 rounded" />
                <div className="h-4 flex-1 bg-slate-800 border border-slate-700 rounded" />
              </div>
              <div className="h-2 w-24 bg-slate-800 rounded-full" />
            </div>
          </button>
        </div>
      </div>
  );
});
