import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';
import { AuthUser } from '../../types/employee';
import { NavTab } from '../common/Sidebar';
import {
  DashboardPreferences,
  QUICK_ACCESS_PAGES_META,
  QuickAccessPageMeta,
  clearPinnedPages,
  movePinnedPageStep,
  togglePinnedPage,
} from '../../utils/dashboardPreferencesUtils';
import { NAV_DOMAINS } from '../../utils/navigationConfig';
import { hasPageAccess } from '../../utils/permissions';

interface QuickAccessSectionProps {
  currentUser: AuthUser | null;
  prefs: DashboardPreferences;
  isSaving: boolean;
  onUpdatePrefs: (next: DashboardPreferences) => void;
  onNavigateTab: (tab: NavTab) => void;
  defaultEditing?: boolean;
  onClose?: () => void;
}

/**
 * Per-user customizable quick-access shortcuts manager.
 * Persisted in Firestore via user_preferences so shortcuts follow the user across devices.
 */
export const QuickAccessSection: React.FC<QuickAccessSectionProps> = ({
  currentUser,
  prefs,
  isSaving,
  onUpdatePrefs,
  onNavigateTab,
  defaultEditing = false,
  onClose,
}) => {
  const { isFrench } = useI18n();
  const [isEditing, setIsEditing] = useState(defaultEditing);
  const [searchQuery, setSearchQuery] = useState('');

  const pageMetaMap = useMemo(() => {
    const map = new Map<NavTab, QuickAccessPageMeta>();
    for (const meta of QUICK_ACCESS_PAGES_META) {
      map.set(meta.id, meta);
    }
    return map;
  }, []);

  const accessiblePages = useMemo(() => {
    return QUICK_ACCESS_PAGES_META.filter((p) => hasPageAccess(currentUser, p.id));
  }, [currentUser]);

  const pinnedItems = useMemo(() => {
    const list: QuickAccessPageMeta[] = [];
    for (const tabId of prefs.pinnedPages ?? []) {
      if (!hasPageAccess(currentUser, tabId)) continue;
      const meta = pageMetaMap.get(tabId);
      if (meta) list.push(meta);
    }
    return list;
  }, [prefs.pinnedPages, currentUser, pageMetaMap]);

  const pinnedSet = useMemo(() => new Set(prefs.pinnedPages ?? []), [prefs.pinnedPages]);

  const filteredByDomain = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return NAV_DOMAINS.map((domain) => {
      const pages = accessiblePages.filter((page) => {
        if (page.domain !== domain.id) return false;
        if (!q) return true;
        return (
          page.labelEn.toLowerCase().includes(q) ||
          page.labelFr.toLowerCase().includes(q) ||
          page.id.toLowerCase().includes(q)
        );
      });
      return { domain, pages };
    }).filter((group) => group.pages.length > 0);
  }, [accessiblePages, searchQuery]);

  return (
    <section
      aria-label={isFrench ? 'Accès rapide personnalisé' : 'My Quick Access'}
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <Bookmark className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white">
                {isFrench ? 'Mes raccourcis rapides' : 'My Quick Access'}
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {isFrench ? 'Synchronisé' : 'Synced'}
              </span>
              {isSaving && (
                <span className="text-[11px] font-semibold text-amber-400">
                  {isFrench ? 'Enregistrement...' : 'Saving...'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {isFrench
                ? 'Épinglez vos pages les plus utilisées pour y accéder en un clic sur tous vos appareils.'
                : 'Pin your most-used pages for 1-click access across all your devices.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onClose) {
              onClose();
            } else {
              setIsEditing((prev) => !prev);
            }
          }}
          className={`px-3 py-1.5 min-h-[34px] rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 cursor-pointer ${
            isEditing || onClose
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
        >
          {isEditing || onClose ? (
            <>
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isFrench ? 'Terminé' : 'Done'}</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{isFrench ? 'Personnaliser' : 'Customize Shortcuts'}</span>
            </>
          )}
        </button>
      </div>

      {/* Pinned Shortcut Pills / Cards */}
      {pinnedItems.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pinnedItems.map((item, index) => (
            <div
              key={item.id}
              className="group inline-flex items-center rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/90 hover:border-amber-500/40 transition shadow-sm"
            >
              <button
                type="button"
                onClick={() => onNavigateTab(item.id)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-100 hover:text-amber-300 flex items-center space-x-2 cursor-pointer"
              >
                <span>{isFrench ? item.labelFr : item.labelEn}</span>
                <ArrowRight
                  className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-transform"
                  aria-hidden="true"
                />
              </button>

              {isEditing && (
                <div className="flex items-center pr-1.5 space-x-0.5 border-l border-slate-700/80 pl-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onUpdatePrefs(movePinnedPageStep(prefs, item.id, -1))}
                    title={isFrench ? 'Déplacer à gauche' : 'Move left'}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === pinnedItems.length - 1}
                    onClick={() => onUpdatePrefs(movePinnedPageStep(prefs, item.id, 1))}
                    title={isFrench ? 'Déplacer à droite' : 'Move right'}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdatePrefs(togglePinnedPage(prefs, item.id))}
                    title={isFrench ? 'Retirer' : 'Remove shortcut'}
                    className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true" />
            <span>
              {isFrench
                ? 'Aucun raccourci épinglé. Cliquez sur « Personnaliser » pour ajouter vos pages fréquentes.'
                : 'No shortcuts pinned yet. Click "Customize Shortcuts" to add your role-specific pages (e.g. Employees, Training, Student Incidents).'}
            </span>
          </div>
        </div>
      )}

      {/* Picker Drawer */}
      {isEditing && (
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isFrench ? 'Rechercher une page...' : 'Search pages to pin...'}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {pinnedItems.length > 0 && (
              <button
                type="button"
                onClick={() => onUpdatePrefs(clearPinnedPages(prefs))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center space-x-1 cursor-pointer transition"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isFrench ? 'Tout effacer' : 'Clear All'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredByDomain.map(({ domain, pages }) => (
              <div
                key={domain.id}
                className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3 space-y-2"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {isFrench ? domain.labelFr : domain.labelEn}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pages.map((page) => {
                    const isPinned = pinnedSet.has(page.id);
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => onUpdatePrefs(togglePinnedPage(prefs, page.id))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center space-x-1 cursor-pointer ${
                          isPinned
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                        }`}
                      >
                        {isPinned ? (
                          <Check className="w-3 h-3 text-amber-400" aria-hidden="true" />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-500" aria-hidden="true" />
                        )}
                        <span>{isFrench ? page.labelFr : page.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
