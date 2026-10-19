import React, { useState, useEffect, useMemo } from 'react';
import { UserRole, PermissionLevel } from '../../types/employee';
import { NavTab } from '../common/Sidebar';
import {
  SYSTEM_PAGES,
  CATEGORY_LABELS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  FACTORY_ROLE_PERMISSIONS,
  getRoleDefaultPermissions,
  updateRoleDefaultPermissions,
  resetRoleDefaultPermissions,
  isRoleDefaultCustomized
} from '../../utils/permissions';
import {
  X,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  RotateCcw
} from 'lucide-react';

interface RolePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  onSaved?: () => void;
}

export const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({
  isOpen,
  onClose,
  role,
  onSaved
}) => {
  const [permissions, setPermissions] = useState<Record<NavTab, PermissionLevel>>({} as any);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize permissions when modal opens or role changes
  useEffect(() => {
    if (isOpen) {
      const current = getRoleDefaultPermissions(role);
      setPermissions({ ...current });
      setSearchTerm('');
      setSelectedCategory('all');
      setSaveSuccess(false);
    }
  }, [isOpen, role]);

  const hasModificationsFromFactory = useMemo(() => {
    const factory = FACTORY_ROLE_PERMISSIONS[role];
    if (!factory) return false;
    return Object.keys(factory).some(
      (k) => permissions[k as NavTab] !== factory[k as NavTab]
    );
  }, [permissions, role]);

  const modifiedPageCount = useMemo(() => {
    const factory = FACTORY_ROLE_PERMISSIONS[role];
    if (!factory) return 0;
    return Object.keys(factory).filter(
      (k) => permissions[k as NavTab] !== factory[k as NavTab]
    ).length;
  }, [permissions, role]);

  if (!isOpen) return null;

  const categories = ['all', 'operations', 'masterData', 'hr_finance', 'system'];

  const filteredPages = SYSTEM_PAGES.filter((page) => {
    if (selectedCategory !== 'all' && page.category !== selectedCategory) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchLabel = page.label.toLowerCase().includes(term);
      const matchDesc = page.description.toLowerCase().includes(term);
      const matchId = page.id.toLowerCase().includes(term);
      if (!matchLabel && !matchDesc && !matchId) return false;
    }
    return true;
  });

  const handleSetLevel = (pageId: NavTab, level: PermissionLevel) => {
    setPermissions((prev) => ({
      ...prev,
      [pageId]: level
    }));
  };

  const handleBatchSet = (level: PermissionLevel) => {
    const updated = { ...permissions };
    filteredPages.forEach((p) => {
      updated[p.id] = level;
    });
    setPermissions(updated);
  };

  const handleResetToFactory = () => {
    if (window.confirm(`Reset default permissions for role "${ROLE_LABELS[role]}" back to factory presets?`)) {
      resetRoleDefaultPermissions(role);
      const factory = FACTORY_ROLE_PERMISSIONS[role];
      setPermissions({ ...factory });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      if (onSaved) onSaved();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateRoleDefaultPermissions(role, permissions);
      setSaveSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to update role default permissions:', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/90 gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mt-0.5">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Default Permissions: {ROLE_LABELS[role]}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  role: &quot;{role}&quot;
                </span>
                {isRoleDefaultCustomized(role) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Customized
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Configure default page access for all staff members assigned this role. Staff with individual overrides will retain their specific settings.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Description Note */}
        <div className="px-5 py-2.5 bg-slate-800/40 border-b border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="truncate">
              <strong>Role Scope:</strong> {ROLE_DESCRIPTIONS[role]}
            </span>
          </div>
          {modifiedPageCount > 0 && (
            <span className="text-[11px] text-amber-400 font-semibold flex-shrink-0 ml-3">
              {modifiedPageCount} page{modifiedPageCount === 1 ? '' : 's'} modified from factory
            </span>
          )}
        </div>

        {/* Toolbar: Search, Category Filters, and Batch Actions */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter pages by name or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat === 'all'
                  ? 'All Pages (22)'
                  : cat === 'operations'
                  ? 'Operations'
                  : cat === 'masterData'
                  ? 'Master Data'
                  : cat === 'hr_finance'
                  ? 'HR & Finance'
                  : 'System'}
              </button>
            ))}
          </div>

          {/* Batch Quick Set */}
          <div className="flex items-center space-x-1.5 self-end md:self-auto">
            <span className="text-[10px] text-slate-500 uppercase font-bold hidden lg:inline">
              Batch:
            </span>
            <button
              type="button"
              onClick={() => handleBatchSet('readwrite')}
              className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold transition"
              title="Set all filtered pages to Read & Write"
            >
              All Read/Write
            </button>
            <button
              type="button"
              onClick={() => handleBatchSet('readonly')}
              className="px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-semibold transition"
              title="Set all filtered pages to Read-Only"
            >
              All Read-Only
            </button>
            <button
              type="button"
              onClick={() => handleBatchSet('none')}
              className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-semibold transition"
              title="Set all filtered pages to No Access"
            >
              Revoke All
            </button>
          </div>
        </div>

        {/* Pages Permissions Matrix */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-2">
          {filteredPages.map((page) => {
            const currentLevel = permissions[page.id] || 'none';
            const factoryLevel = FACTORY_ROLE_PERMISSIONS[role]?.[page.id] || 'none';
            const isModified = currentLevel !== factoryLevel;

            return (
              <div
                key={page.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  isModified
                    ? 'bg-amber-500/[0.03] border-amber-500/30'
                    : 'bg-slate-800/40 border-slate-800 hover:border-slate-700/80'
                }`}
              >
                {/* Page Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs md:text-sm text-white">
                      {page.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {page.id}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {CATEGORY_LABELS[page.category]}
                    </span>
                    {isModified && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Modified
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {page.description}
                  </p>
                </div>

                {/* Permission Level Selector (Segmented buttons) */}
                <div className="flex items-center space-x-1.5 self-start sm:self-auto flex-shrink-0">
                  {/* Read & Write */}
                  <button
                    type="button"
                    onClick={() => handleSetLevel(page.id, 'readwrite')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      currentLevel === 'readwrite'
                        ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-emerald-300 hover:border-emerald-500/30'
                    }`}
                  >
                    Read & Write
                  </button>

                  {/* Read Only */}
                  <button
                    type="button"
                    onClick={() => handleSetLevel(page.id, 'readonly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      currentLevel === 'readonly'
                        ? 'bg-blue-500 text-white font-bold border-blue-400 shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-blue-300 hover:border-blue-500/30'
                    }`}
                  >
                    Read-Only
                  </button>

                  {/* No Access */}
                  <button
                    type="button"
                    onClick={() => handleSetLevel(page.id, 'none')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      currentLevel === 'none'
                        ? 'bg-rose-500 text-white font-bold border-rose-400 shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-rose-300 hover:border-rose-500/30'
                    }`}
                  >
                    No Access
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleResetToFactory}
              disabled={!hasModificationsFromFactory}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                hasModificationsFromFactory
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
              }`}
              title="Reset this role to original system default permissions"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Factory Defaults</span>
            </button>

            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Defaults updated successfully!</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition shadow-lg shadow-amber-500/20"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Default Permissions</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
