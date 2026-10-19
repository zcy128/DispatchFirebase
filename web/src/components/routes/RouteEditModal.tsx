import React, { useState } from 'react';
import { BusRoute, isAutoMarryupEnabled } from '../../types/route';
import { Yard } from '../../types/yard';
import { useAuth } from '../../contexts/AuthContext';
import { RouteAuditService } from '../../services/routeAuditService';
import { RouteChangeFieldDiff } from '../../types/routeAudit';
import { X, Bus, Check, AlertCircle } from 'lucide-react';

interface RouteEditModalProps {
  route: BusRoute;
  yards: Yard[];
  onClose: () => void;
  onSave: (routeId: string, updates: Partial<BusRoute>) => Promise<void>;
}

export const RouteEditModal: React.FC<RouteEditModalProps> = ({
  route,
  yards,
  onClose,
  onSave
}) => {
  const { currentUser } = useAuth();
  const [routeNo, setRouteNo] = useState(route.routeNo || '');
  const [routeName, setRouteName] = useState(route.routeName || '');
  const [instructions, setInstructions] = useState(route.instructions || '');
  const [yardId, setYardId] = useState<number>(route.yardId || 0);
  const [active, setActive] = useState<boolean>(route.active !== false);
  const [autoMarryup, setAutoMarryup] = useState<boolean>(isAutoMarryupEnabled(route));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeNo.trim()) {
      setError('Route number is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const selectedYard = yards.find((y) => y.yardId === yardId);
      const updates: Partial<BusRoute> = {
        routeNo: routeNo.trim(),
        routeName: routeName.trim(),
        instructions: instructions.trim(),
        active,
        autoMarryup,
        yardId: yardId || 0,
        yardName: selectedYard ? selectedYard.name : route.yardName
      };

      await onSave(route.id, updates);

      // Audit Log: Compute diffs and record change with current user identity
      const diffs: RouteChangeFieldDiff[] = [];
      if (route.routeNo !== updates.routeNo) {
        diffs.push({ field: 'routeNo', fieldLabel: 'Route Number', oldValue: route.routeNo, newValue: updates.routeNo });
      }
      if (route.routeName !== updates.routeName) {
        diffs.push({ field: 'routeName', fieldLabel: 'Route Name', oldValue: route.routeName, newValue: updates.routeName });
      }
      if (route.active !== updates.active) {
        diffs.push({ field: 'active', fieldLabel: 'Active Status', oldValue: route.active, newValue: updates.active });
      }
      if (isAutoMarryupEnabled(route) !== updates.autoMarryup) {
        diffs.push({ field: 'autoMarryup', fieldLabel: 'Auto Marryup', oldValue: isAutoMarryupEnabled(route), newValue: updates.autoMarryup });
      }
      if (route.yardId !== updates.yardId) {
        diffs.push({ field: 'yardName', fieldLabel: 'Operational Yard', oldValue: route.yardName, newValue: updates.yardName });
      }
      if ((route.instructions || '') !== (updates.instructions || '')) {
        diffs.push({ field: 'instructions', fieldLabel: 'Instructions', oldValue: route.instructions || '', newValue: updates.instructions || '' });
      }

      if (diffs.length > 0) {
        const actorName = currentUser?.displayName || currentUser?.email || 'Dispatcher';
        const actorId = currentUser?.employeeId || currentUser?.uid || 'usr-dispatcher';
        const actorRole = currentUser?.role || 'dispatcher';
        const actorEmail = currentUser?.email || undefined;

        RouteAuditService.logRouteChange({
          routeId: route.id,
          routeNo: updates.routeNo || route.routeNo,
          routeName: updates.routeName || route.routeName,
          category: 'route',
          action: 'update',
          summary: `Updated route settings: ${diffs.map((d) => d.fieldLabel).join(', ')}`,
          diffs,
          userId: actorId,
          userName: actorName,
          userEmail: actorEmail,
          userRole: actorRole
        }).catch((auditErr) => console.warn('[RouteEditModal] Audit log warning:', auditErr));
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to update route:', err);
      setError(err?.message || 'Failed to update route settings.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Edit Route</h2>
              <p className="text-xs text-slate-400">{route.routeNo} — {route.routeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Route Number */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Route Number</label>
            <input
              type="text"
              value={routeNo}
              onChange={(e) => setRouteNo(e.target.value)}
              placeholder="e.g. OCDSB-001"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition font-mono"
            />
          </div>

          {/* Route Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Route Name</label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g. Route 001 - Bell High School"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Operating Yard */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Operational Yard</label>
            <select
              value={yardId}
              onChange={(e) => setYardId(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition"
            >
              <option value={0}>Unassigned Yard</option>
              {yards.map((y) => (
                <option key={y.id} value={y.yardId}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          {/* Instructions / Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Instructions / Notes</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="Operational instructions for drivers..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition placeholder:text-slate-600 resize-none"
            />
          </div>

          {/* Auto Marryup Toggle Card */}
          <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white flex items-center space-x-1.5">
                  <span>Auto Marryup</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Dispatch
                  </span>
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  AM and PM shifts will be automatically matched and dispatched together.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={autoMarryup}
                  onChange={(e) => setAutoMarryup(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* Active Status Toggle */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-800/40 flex items-center justify-between">
            <div>
              <span className="font-bold text-white">Active Status</span>
              <p className="text-[11px] text-slate-400">
                Determines whether this route is currently in operational service.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/10 transition flex items-center space-x-1.5"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
