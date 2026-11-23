import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Edit3,
  Lock,
  Sparkles,
  History,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  ExpenseCategory,
  ExpenseApproverGroup,
  ExpensePeriodType,
  ExpensePolicyAuditLog,
  BiweeklyPayrollConfig,
} from '../../types/expenseReimbursement';
import { ExpenseReimbursementService } from '../../services/expenseReimbursementService';
import {
  canManageExpensePolicyGroup,
  roundCurrencyHalfUp,
} from '../../utils/biweeklyPeriodUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useAIOptional } from '../../contexts/AIContext';

const PERIOD_LABELS: Record<ExpensePeriodType, string> = {
  per_claim: 'Per Claim',
  one_time: 'One-Time (Lifetime)',
  biweekly_pay_period: 'Bi-Weekly Pay Period',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

interface ExpensePoliciesPanelProps {
  onPoliciesUpdated?: () => void;
}

export const ExpensePoliciesPanel: React.FC<ExpensePoliciesPanelProps> = ({
  onPoliciesUpdated,
}) => {
  const { currentUser } = useAuth();
  const aiCtx = useAIOptional();

  const [policies, setPolicies] = useState<ExpenseCategory[]>([]);
  const [auditLogs, setAuditLogs] = useState<ExpensePolicyAuditLog[]>([]);
  const [biweeklyCfg, setBiweeklyCfg] = useState<BiweeklyPayrollConfig | null>(null);
  const [autoApproveDays, setAutoApproveDays] = useState<number>(5);
  const [slaInputDays, setSlaInputDays] = useState<string>('5');
  const [savingSla, setSavingSla] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [groupFilter, setGroupFilter] = useState<'all' | ExpenseApproverGroup>('all');
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);

  // Edit modal state
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [formDisplayName, setFormDisplayName] = useState<string>('');
  const [formPeriodType, setFormPeriodType] = useState<ExpensePeriodType>('per_claim');
  const [formMaxAmount, setFormMaxAmount] = useState<string>('');
  const [formMaxCount, setFormMaxCount] = useState<string>('');
  const [formRequireAttachment, setFormRequireAttachment] = useState<boolean>(true);
  const [formAutoPreApprove, setFormAutoPreApprove] = useState<boolean>(false);
  const [formGuidance, setFormGuidance] = useState<string>('');
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formReason, setFormReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canEditSla =
    canManageExpensePolicyGroup(currentUser?.role, 'hr') ||
    canManageExpensePolicyGroup(currentUser?.role, 'fleet');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, cfg, settings] = await Promise.all([
        ExpenseReimbursementService.listCategories({ includeInactive: true }),
        ExpenseReimbursementService.getBiweeklyPayrollConfig(),
        ExpenseReimbursementService.getExpensePolicySettings(),
      ]);
      setPolicies(cats);
      setBiweeklyCfg(cfg);
      if (settings?.autoApproveDays) {
        setAutoApproveDays(settings.autoApproveDays);
        setSlaInputDays(String(settings.autoApproveDays));
      }
      try {
        const logs = await ExpenseReimbursementService.listPolicyAuditLogs(undefined, 30);
        setAuditLogs(logs);
      } catch {
        setAuditLogs([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlaDays = async () => {
    const parsed = Math.floor(Number(slaInputDays));
    if (!canEditSla || Number.isNaN(parsed) || parsed < 1 || parsed > 30 || savingSla) return;
    setSavingSla(true);
    try {
      const saved = await ExpenseReimbursementService.saveExpensePolicySettings({
        autoApproveDays: parsed,
      });
      setAutoApproveDays(saved.autoApproveDays);
      setSlaInputDays(String(saved.autoApproveDays));
      onPoliciesUpdated?.();
    } finally {
      setSavingSla(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredPolicies = useMemo(() => {
    return policies.filter(
      (p) => groupFilter === 'all' || (p.approverGroup || 'hr') === groupFilter
    );
  }, [policies, groupFilter]);

  const openEditModal = (policy: ExpenseCategory) => {
    setEditing(policy);
    setFormDisplayName(policy.displayName);
    setFormPeriodType((policy.periodType as ExpensePeriodType) || 'per_claim');
    setFormMaxAmount(
      policy.maxTotalAmount !== null && policy.maxTotalAmount !== undefined
        ? String(policy.maxTotalAmount)
        : ''
    );
    setFormMaxCount(
      policy.maxCountPerPeriod !== null && policy.maxCountPerPeriod !== undefined
        ? String(policy.maxCountPerPeriod)
        : ''
    );
    setFormRequireAttachment(Boolean(policy.requireAttachment));
    setFormAutoPreApprove(Boolean(policy.autoPreApprove));
    setFormGuidance(policy.aiReviewGuidance || '');
    setFormActive(policy.active);
    setFormReason('');
    setSaveError(null);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaveError(null);

    const parsedAmt =
      formMaxAmount.trim() === '' ? null : roundCurrencyHalfUp(Number(formMaxAmount));
    if (parsedAmt !== null && (Number.isNaN(parsedAmt) || parsedAmt < 0)) {
      setSaveError('Maximum amount must be a non-negative number.');
      return;
    }

    const parsedCnt =
      formMaxCount.trim() === '' ? null : Math.floor(Number(formMaxCount));
    if (parsedCnt !== null && (Number.isNaN(parsedCnt) || parsedCnt < 1)) {
      setSaveError('Maximum count per period must be at least 1.');
      return;
    }

    setSaving(true);
    try {
      await ExpenseReimbursementService.upsertCategory(editing.code, {
        code: editing.code,
        displayName: formDisplayName.trim() || editing.displayName,
        approverGroup: (editing.approverGroup as ExpenseApproverGroup) || 'hr',
        periodType: formPeriodType,
        maxTotalAmount: parsedAmt,
        maxCountPerPeriod: parsedCnt,
        requireAttachment: formRequireAttachment,
        autoPreApprove: formAutoPreApprove,
        aiReviewGuidance: formGuidance.trim(),
        sortOrder: editing.sortOrder,
        active: formActive,
        reason: formReason.trim() || 'Updated via Policies & Limits panel',
      });
      setEditing(null);
      await loadData();
      onPoliciesUpdated?.();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update expense policy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-800/80 rounded-xl border border-slate-700/60">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'hr', 'fleet'] as const).map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setGroupFilter(grp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                groupFilter === grp
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-900/60 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              {grp === 'all' ? 'All Groups' : grp === 'hr' ? 'HR Policies' : 'Fleet Policies'}
            </button>
          ))}
          {biweeklyCfg?.biweeklyAnchorDate && (
            <span className="text-xs text-slate-400 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700">
              Bi-Weekly Anchor: <strong className="text-slate-200">{biweeklyCfg.biweeklyAnchorDate}</strong>
            </span>
          )}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200"
            title="Calendar days after submission before eligible pre-approved claims automatically finalize to Finance"
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
            <span>Pre-Approve SLA:</span>
            {canEditSla ? (
              <>
                <input
                  type="number"
                  min={1}
                  max={30}
                  aria-label="Auto-approve SLA calendar days"
                  value={slaInputDays}
                  onChange={(e) => setSlaInputDays(e.target.value)}
                  className="w-12 px-1.5 py-0.5 text-center font-mono font-bold bg-slate-900 border border-slate-600 rounded text-white text-xs"
                />
                <span>days</span>
                {Number(slaInputDays) !== autoApproveDays && (
                  <button
                    type="button"
                    onClick={handleSaveSlaDays}
                    disabled={savingSla}
                    className="ml-1 px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] cursor-pointer disabled:opacity-50"
                  >
                    {savingSla ? '...' : 'Save'}
                  </button>
                )}
              </>
            ) : (
              <strong className="font-mono text-white">{autoApproveDays} days</strong>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => aiCtx?.openAI({ activePage: 'expenses' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Update via AI Copilot
          </button>
          <button
            type="button"
            onClick={() => setShowAuditLogs((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/60 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            {showAuditLogs ? 'Hide Audit Log' : `Audit Log (${auditLogs.length})`}
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-900/60 text-slate-300 border border-slate-700 hover:bg-slate-700 cursor-pointer"
            aria-label="Refresh expense policies"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Strict Isolation Info Banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60 text-xs text-slate-300">
        <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" aria-hidden="true" />
        <span>
          Strict group isolation is active: <strong>HR</strong> manages HR policies,{' '}
          <strong>Fleet</strong> manages Fleet policies, and <strong>Admin</strong> manages all groups.
          Bi-weekly limits are scoped per employee and aligned with Bi-Weekly Payroll.
        </span>
      </div>

      {/* Policy Table */}
      <div className="overflow-x-auto bg-slate-800/80 rounded-xl border border-slate-700/60 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Max Amount</th>
              <th className="px-4 py-3">Triage ({autoApproveDays}-Day SLA)</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-sm">
            {filteredPolicies.map((policy) => {
              const grp = (policy.approverGroup || 'hr') as ExpenseApproverGroup;
              const canEdit = canManageExpensePolicyGroup(currentUser?.role, grp);
              return (
                <tr key={policy.code} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{policy.displayName}</div>
                    <div className="text-xs text-slate-400">
                      <code>{policy.code}</code>
                      {policy.limitLabel ? ` · ${policy.limitLabel}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        grp === 'fleet'
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {grp}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200 text-xs">
                    {PERIOD_LABELS[(policy.periodType as ExpensePeriodType) || 'per_claim'] ||
                      policy.periodType}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-white">
                    {policy.maxTotalAmount !== null && policy.maxTotalAmount !== undefined
                      ? `$${policy.maxTotalAmount.toFixed(2)}`
                      : 'No cap'}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">
                    {policy.autoPreApprove ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        Auto Pre-Approve ({autoApproveDays}d)
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Manual Review Required
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        policy.active
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-600/40 text-slate-400'
                      }`}
                    >
                      {policy.active ? 'Active' : 'Inactive'}
                      {policy.version ? ` · v${policy.version}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => openEditModal(policy)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-teal-600 text-white transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        Edit
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 bg-slate-900/50 border border-slate-700/60"
                        title={`Restricted to ${grp.toUpperCase()} and Admin roles`}
                      >
                        <Lock className="w-3 h-3" aria-hidden="true" />
                        {grp.toUpperCase()} Only
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Audit Log Panel */}
      {showAuditLogs && (
        <div className="bg-slate-800/80 rounded-xl border border-slate-700/60 p-4 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-teal-400" aria-hidden="true" />
            Policy Change Audit History
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400">No policy changes recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-white">{log.categoryCode}</span>{' '}
                    <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 uppercase text-[10px]">
                      {log.action}
                    </span>{' '}
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                      {log.source}
                    </span>
                    {log.reason && <span className="text-slate-300 ml-2">— {log.reason}</span>}
                  </div>
                  <div className="text-slate-400">
                    {log.actorName || log.actorEmail || 'System'} ({log.actorRole || 'admin'}) ·{' '}
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePolicy}
            className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Edit Expense Policy</h3>
                <p className="text-xs text-slate-400">
                  <code>{editing.code}</code> · Group:{' '}
                  <strong className="uppercase text-slate-200">{editing.approverGroup}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                aria-label="Close policy editor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Period Type
                  </label>
                  <select
                    value={formPeriodType}
                    onChange={(e) => setFormPeriodType(e.target.value as ExpensePeriodType)}
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="per_claim">Per Claim</option>
                    <option value="biweekly_pay_period">Bi-Weekly Pay Period</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One-Time (Lifetime)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Max Cumulative Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Blank = No cap"
                    value={formMaxAmount}
                    onChange={(e) => setFormMaxAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Max Claims / Period (Optional)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Blank = Amount cap only"
                    value={formMaxCount}
                    onChange={(e) => setFormMaxCount(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div className="flex flex-col justify-end gap-2 pb-1">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRequireAttachment}
                      onChange={(e) => setFormRequireAttachment(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    Require Receipt Attachment
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAutoPreApprove}
                      onChange={(e) => setFormAutoPreApprove(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    Auto Pre-Approve ({autoApproveDays}-Day SLA)
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    Policy Active
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Soft-Rule Review Guidance (Optional)
                </label>
                <input
                  type="text"
                  value={formGuidance}
                  onChange={(e) => setFormGuidance(e.target.value)}
                  placeholder="e.g. Verify proof of successful completion is attached"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Change Reason (Audit Log)
                </label>
                <input
                  type="text"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g. Winter bus washing rate adjustment"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              {saveError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-950/50 border-t border-slate-700 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save Policy
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
