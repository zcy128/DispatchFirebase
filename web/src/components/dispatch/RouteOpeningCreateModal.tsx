import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  PlusCircle,
  Send,
  AlertCircle,
  CheckCircle2,
  Search,
  Bus,
  Clock
} from 'lucide-react';
import { BusRoute } from '../../types/route';
import {
  RouteOpeningType,
  RouteOpeningRole,
  CreateRouteOpeningPayload
} from '../../types/routeOpening';
import { RouteOpeningService } from '../../services/routeOpeningService';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import {
  getLocalTodayString,
  addDaysToDateString,
  calculateDefaultDeadline
} from '../../utils/dateUtils';

interface RouteOpeningCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: BusRoute[];
  onCreated: () => void;
  initialValues?: {
    routeId?: string;
    postingType?: RouteOpeningType;
    roleNeeded?: RouteOpeningRole;
    effectiveStartDate?: string;
    effectiveEndDate?: string;
    shiftType?: string;
    deadline?: string;
    description?: string;
  };
}

export const RouteOpeningCreateModal: React.FC<RouteOpeningCreateModalProps> = ({
  isOpen,
  onClose,
  routes,
  onCreated,
  initialValues
}) => {
  const { currentUser } = useAuth();
  const { t } = useI18n();

  const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';

  // Default dates
  const todayStr = getLocalTodayString();
  const initialStart = initialValues?.effectiveStartDate || todayStr;
  const computedInitialDeadline = initialValues?.deadline || calculateDefaultDeadline(initialStart);

  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.id || '');
  const [routeSearch, setRouteSearch] = useState<string>('');
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState<boolean>(false);
  const [postingType, setPostingType] = useState<RouteOpeningType>('permanent');
  const [roleNeeded, setRoleNeeded] = useState<RouteOpeningRole>('driver');
  const [effectiveStartDate, setEffectiveStartDate] = useState<string>(initialStart);
  const [effectiveEndDate, setEffectiveEndDate] = useState<string>(initialValues?.effectiveEndDate || initialStart);
  const [shiftType, setShiftType] = useState<string>('ALL');
  const [deadline, setDeadline] = useState<string>(computedInitialDeadline);
  const [hasUserModifiedDeadline, setHasUserModifiedDeadline] = useState<boolean>(Boolean(initialValues?.deadline));
  const [description, setDescription] = useState<string>('');
  const [postToChat, setPostToChat] = useState<boolean>(true);

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        if (initialValues.routeId) setSelectedRouteId(initialValues.routeId);
        if (initialValues.postingType) setPostingType(initialValues.postingType);
        if (initialValues.roleNeeded) setRoleNeeded(initialValues.roleNeeded);
        if (initialValues.effectiveStartDate) setEffectiveStartDate(initialValues.effectiveStartDate);
        if (initialValues.effectiveEndDate) setEffectiveEndDate(initialValues.effectiveEndDate);
        if (initialValues.shiftType) setShiftType(initialValues.shiftType);
        if (initialValues.description) setDescription(initialValues.description);

        if (initialValues.deadline) {
          setDeadline(initialValues.deadline);
          setHasUserModifiedDeadline(true);
        } else if (initialValues.effectiveStartDate) {
          setDeadline(calculateDefaultDeadline(initialValues.effectiveStartDate));
          setHasUserModifiedDeadline(false);
        }
      } else {
        if (!selectedRouteId && routes.length > 0) {
          setSelectedRouteId(routes[0].id);
        }
        setDeadline(calculateDefaultDeadline(todayStr));
        setHasUserModifiedDeadline(false);
      }
    }
  }, [isOpen, initialValues, routes, selectedRouteId, todayStr]);

  const handleStartDateChange = (newDate: string) => {
    setEffectiveStartDate(newDate);
    if (postingType === 'temporary' && (!effectiveEndDate || effectiveEndDate < newDate)) {
      setEffectiveEndDate(newDate);
    }
    if (!hasUserModifiedDeadline) {
      setDeadline(calculateDefaultDeadline(newDate));
    }
  };

  const filteredRoutes = useMemo(() => {
    const q = routeSearch.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) => {
      const no = (r.routeNo || '').toLowerCase();
      const name = (r.routeName || '').toLowerCase();
      const board = (r.schoolBoardCode || '').toLowerCase();
      const yard = (r.yardName || '').toLowerCase();
      const drv = (r.driverName || '').toLowerCase();
      return (
        no.includes(q) ||
        name.includes(q) ||
        board.includes(q) ||
        yard.includes(q) ||
        drv.includes(q)
      );
    });
  }, [routes, routeSearch]);

  if (!isOpen) return null;

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) || filteredRoutes[0] || routes[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) {
      setError('Please select a route.');
      return;
    }
    if (!effectiveStartDate) {
      setError('Please provide an effective start date.');
      return;
    }
    if (postingType === 'temporary' && !effectiveEndDate) {
      setError('Please provide an effective end date for temporary coverage.');
      return;
    }
    if (!deadline) {
      setError('Please provide an application deadline.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: CreateRouteOpeningPayload = {
        routeId: selectedRoute.id,
        routeNo: selectedRoute.routeNo,
        routeName: selectedRoute.routeName,
        yardId: selectedRoute.yardId,
        yardName: selectedRoute.yardName,
        schoolBoardCode: selectedRoute.schoolBoardCode,
        postingType,
        roleNeeded,
        effectiveStartDate,
        effectiveEndDate: postingType === 'temporary' ? effectiveEndDate : undefined,
        shiftType,
        deadline,
        description: description.trim() || undefined,
        postToChat,
        createdBy: actorName
      };

      await RouteOpeningService.createOpening(payload);
      onCreated();
      onClose();
    } catch (err: any) {
      console.error('[CreateOpening] Failed to create route opening:', err);
      setError(err?.message || 'Failed to post route opening. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {t.routeOpenings?.postNewOpening || 'Post New Route Opening'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Announce open route vacancies & coverage needs to all fleet personnel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Searchable Route Selection */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Select Bus Route <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {filteredRoutes.length} of {routes.length} routes
              </span>
            </div>

            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={routeSearch}
                onFocus={() => setIsRouteDropdownOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setRouteSearch(val);
                  setIsRouteDropdownOpen(true);
                  const q = val.trim().toLowerCase();
                  if (q) {
                    const firstMatch = routes.find(
                      (r) =>
                        (r.routeNo || '').toLowerCase().includes(q) ||
                        (r.routeName || '').toLowerCase().includes(q) ||
                        (r.schoolBoardCode || '').toLowerCase().includes(q) ||
                        (r.yardName || '').toLowerCase().includes(q)
                    );
                    if (firstMatch) {
                      setSelectedRouteId(firstMatch.id);
                    }
                  }
                }}
                placeholder="Search route number, school name, board, or yard..."
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              {routeSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setRouteSearch('');
                    setIsRouteDropdownOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Interactive Filtered Search Results Dropdown */}
            {isRouteDropdownOpen && routeSearch.trim().length > 0 && (
              <div className="mb-2 max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 divide-y divide-slate-800/80 shadow-xl">
                {filteredRoutes.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    No matching routes found for &ldquo;{routeSearch}&rdquo;
                  </div>
                ) : (
                  filteredRoutes.map((r) => {
                    const isSelected = selectedRoute?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRouteId(r.id);
                          setIsRouteDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-amber-500/15 text-amber-300 font-semibold'
                            : 'text-slate-200 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Bus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="font-mono font-bold text-amber-400 shrink-0">
                            {r.routeNo}
                          </span>
                          <span className="truncate text-slate-300">
                            {r.routeName || 'School Route'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                          {r.schoolBoardCode || 'Board'} {r.yardName ? `• ${r.yardName}` : ''}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Route Select Dropdown (synced with search filter) */}
            <select
              value={selectedRoute?.id || ''}
              onChange={(e) => {
                setSelectedRouteId(e.target.value);
                setIsRouteDropdownOpen(false);
              }}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              required
            >
              {(filteredRoutes.length > 0 ? filteredRoutes : routes).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.routeNo} {r.routeName ? `- ${r.routeName}` : ''} ({r.schoolBoardCode || 'Route'}
                  {r.yardName ? ` • ${r.yardName}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Posting Type Toggle: Permanent vs Temporary */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Assignment Type <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPostingType('permanent')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  postingType === 'permanent'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Permanent Standing Run</span>
                  {postingType === 'permanent' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ongoing regular route driver/crew starting from specified date
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPostingType('temporary')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  postingType === 'temporary'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Temporary Shift Coverage</span>
                  {postingType === 'temporary' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Fixed date range cover (sick leave, leave of absence, or interim)
                </p>
              </button>
            </div>
          </div>

          {/* Role Needed & Shifts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Position Required <span className="text-rose-400">*</span>
              </label>
              <select
                value={roleNeeded}
                onChange={(e) => setRoleNeeded(e.target.value as RouteOpeningRole)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="driver">Driver Only</option>
                <option value="attendant">Attendant Only</option>
                <option value="driver_and_attendant">Driver & Attendant</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Shift Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="ALL">All Shifts (AM & PM)</option>
                <option value="AM">Morning Only (AM)</option>
                <option value="PM">Afternoon Only (PM)</option>
                <option value="Midday">Midday Only</option>
              </select>
            </div>
          </div>

          {/* Dates: Effective Start Date & End Date (if temporary) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {postingType === 'permanent' ? 'Effective Start Date' : 'Coverage Start Date'}{' '}
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={effectiveStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                required
              />
            </div>

            {postingType === 'temporary' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Coverage End Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={effectiveEndDate}
                  onChange={(e) => setEffectiveEndDate(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Standing Duration
                </label>
                <input
                  type="text"
                  disabled
                  value="Indefinite / Remainder of School Year"
                  className="w-full bg-slate-800/40 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400 italic cursor-not-allowed"
                />
              </div>
            )}
          </div>

          {/* Application Deadline */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>
                Application Deadline <span className="text-rose-400">*</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                Bidding closes automatically after this date & time
              </span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => {
                setDeadline(e.target.value);
                setHasUserModifiedDeadline(true);
              }}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              required
            />

            {/* Quick deadline presets */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setDeadline(calculateDefaultDeadline(effectiveStartDate));
                  setHasUserModifiedDeadline(false);
                }}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
                title="Bidding closes before dispatch creation (2:00 PM previous business day)"
              >
                Dispatch Cutoff (2:00 PM Prior Workday)
              </button>
              <button
                type="button"
                onClick={() => {
                  const dayBefore = addDaysToDateString(effectiveStartDate, -1);
                  setDeadline(`${dayBefore}T14:00`);
                  setHasUserModifiedDeadline(true);
                }}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                title="Calendar day before coverage start at 2:00 PM"
              >
                Day Before (2:00 PM)
              </button>
              <button
                type="button"
                onClick={() => {
                  const dayBefore = addDaysToDateString(effectiveStartDate, -1);
                  setDeadline(`${dayBefore}T18:00`);
                  setHasUserModifiedDeadline(true);
                }}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                title="Evening before coverage start at 6:00 PM"
              >
                Evening Before (6:00 PM)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeadline(`${effectiveStartDate}T06:30`);
                  setHasUserModifiedDeadline(true);
                }}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                title="Same day morning at 6:30 AM before morning routes"
              >
                Morning of Shift (6:30 AM)
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>
                Daily dispatch is generated by 2:00 PM on the day prior. Bidding should close prior to dispatch generation.
              </span>
            </p>
          </div>

          {/* Description & Requirements */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Requirements / Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Valid B/CZ license required. Experience with special needs equipment preferred."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Fleet Chat Bulletin Toggle */}
          <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/40 rounded-xl flex items-start gap-3">
            <input
              type="checkbox"
              id="postToChatCheck"
              checked={postToChat}
              onChange={(e) => setPostToChat(e.target.checked)}
              className="mt-0.5 rounded border-cyan-700 text-amber-500 focus:ring-amber-400 w-4 h-4"
            />
            <label htmlFor="postToChatCheck" className="text-xs cursor-pointer">
              <span className="font-bold text-cyan-300 block">
                {t.routeOpenings?.chatAnnouncementLabel || 'Publish Bulletin to Fleet Chat'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {t.routeOpenings?.chatAnnouncementDesc ||
                  'Automatically post an announcement bulletin to the company-wide All Fleet Announcements channel.'}
              </span>
            </label>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>Posting Opening...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Publish Route Opening
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
