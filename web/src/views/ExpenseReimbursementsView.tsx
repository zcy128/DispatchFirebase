import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import {
  Receipt,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  X,
  User,
  Phone,
  Route as RouteIcon,
  Tag,
  ShieldCheck,
  Paperclip,
  ExternalLink,
  Eye,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import {
  ExpenseReimbursement,
  ReviewExpenseClaimPayload,
  EXPENSE_CLAIM_STATUS_LABELS,
  EXPENSE_CLAIM_STATUS_COLORS,
} from '../types/expenseReimbursement';
import { ExpenseReimbursementService } from '../services/expenseReimbursementService';
import { useAuth } from '../contexts/AuthContext';
import { Employee } from '../types/employee';

// Pure helper to identify historical claims archived in BigQuery cold storage
function isArchivedClaimDate(claimDate?: string): boolean {
  return ExpenseReimbursementService.isColdClaim(claimDate);
}

function employeePhone(emp?: Employee | null): string {
  if (!emp) return '';
  return (
    emp.preferredPhone ||
    emp.mobilePhone ||
    emp.workPhonePhone ||
    emp.homePhone ||
    ''
  ).trim();
}

interface ExpenseModalDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  backdropClassName: string;
  panelClassName: string;
  children: React.ReactNode;
}

const ExpenseModalDialog: React.FC<ExpenseModalDialogProps> = ({
  open,
  onClose,
  ariaLabelledBy,
  backdropClassName,
  panelClassName,
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ariaLabelledBy}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className={`m-0 max-w-none max-h-none w-screen h-screen bg-transparent p-4 flex items-center justify-center overflow-y-auto overscroll-contain backdrop:overscroll-contain ${backdropClassName}`}
    >
      <div className={panelClassName} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </dialog>
  );
};

interface ExpenseReimbursementsViewProps {
  employees?: Employee[];
  onSelectEmployee?: (employeeId?: string, employeeName?: string) => void;
}

export const ExpenseReimbursementsView: React.FC<ExpenseReimbursementsViewProps> = ({
  employees = [],
  onSelectEmployee,
}) => {
  const { currentUser } = useAuth();
  const [claims, setClaims] = useState<ExpenseReimbursement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedClaim, setSelectedClaim] = useState<ExpenseReimbursement | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    currentIndex: number;
    claimTitle: string;
  } | null>(null);

  // Keyboard navigation for Lightbox (Escape is handled natively by <dialog>)
  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && lightbox.currentIndex > 0) {
        setLightbox((prev) => (prev ? { ...prev, currentIndex: prev.currentIndex - 1 } : null));
      }
      if (e.key === 'ArrowRight' && lightbox.currentIndex < lightbox.urls.length - 1) {
        setLightbox((prev) => (prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : null));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox]);

  // Review form state
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewerName, setReviewerName] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Claims older than six months are BigQuery cold data.
  const [timeRange, setTimeRange] = useState<'6months' | 'all'>('6months');

  const resolveEmployeePhone = (employeeId?: string, employeeName?: string): string => {
    const id = (employeeId || '').trim().toLowerCase();
    const name = (employeeName || '').trim().toLowerCase();
    if (!employees.length) return '';

    const tokens = (e: Employee) =>
      [e.id, e.employeeNumber, String(e.employeeId ?? ''), e.username || '']
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);

    const byId = id
      ? employees.find((e) => tokens(e).includes(id))
      : undefined;
    if (byId) return employeePhone(byId);

    if (!name) return '';
    const byName =
      employees.find((e) => {
        const full = (e.fullName || `${e.firstName} ${e.lastName}`).trim().toLowerCase();
        return full === name;
      }) ||
      employees.find((e) => {
        const full = (e.fullName || `${e.firstName} ${e.lastName}`).trim().toLowerCase();
        return full.includes(name) || name.includes(full);
      });
    return employeePhone(byName);
  };

  const loadClaims = async (targetQuery?: string, opts?: { isCancelled?: () => boolean }) => {
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q) {
      if (!opts?.isCancelled?.()) {
        setClaims([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = { timeRange };
      if (q) {
        params.query = q;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await ExpenseReimbursementService.listClaims(params);
      if (!opts?.isCancelled?.()) {
        setClaims(data);
      }
    } catch (err) {
      if (!opts?.isCancelled?.()) {
        console.error('Failed to load expense claims:', err);
        setClaims([]);
      }
    } finally {
      if (!opts?.isCancelled?.()) {
        setLoading(false);
      }
    }
  };

  // Subscribe to real-time updates (live data <= 6 months) or load targeted archives
  useEffect(() => {
    let isCancelled = false;
    if (timeRange === '6months') {
      setLoading(true);
      const unsubscribe = ExpenseReimbursementService.subscribeClaims((data) => {
        if (!isCancelled) {
          setClaims(data);
          setLoading(false);
        }
      });
      return () => {
        isCancelled = true;
        unsubscribe();
      };
    } else {
      if (searchQuery.trim()) {
        void loadClaims(searchQuery.trim(), { isCancelled: () => isCancelled });
      } else {
        setClaims([]);
        setLoading(false);
      }
      return () => {
        isCancelled = true;
      };
    }
  }, [timeRange]);

  const refreshData = async () => {
    if (timeRange === 'all') {
      if (searchQuery.trim()) {
        await loadClaims(searchQuery.trim());
      } else {
        setClaims([]);
      }
    } else {
      await loadClaims();
    }
  };

  // KPIs
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let approvedDollars = 0;
    let pendingDollars = 0;

    for (const c of claims) {
      const amt = c.totalAmount || 0;
      if (c.status === 'pending') {
        pending++;
        pendingDollars += amt;
      } else if (c.status === 'approved') {
        approved++;
        approvedDollars += amt;
      } else if (c.status === 'rejected' || c.status === 'cancelled') {
        rejected++;
      }
    }

    return {
      total: claims.length,
      pending,
      approved,
      rejected,
      approvedDollars: Math.round(approvedDollars * 100) / 100,
      pendingDollars: Math.round(pendingDollars * 100) / 100,
    };
  }, [claims]);

  // Newest claim date first.
  const filteredClaims = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const hasQuery = q.length > 0;

    const list = claims.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (hasQuery) {
        const matchesDriver = (c.employeeName || '').toLowerCase().includes(q);
        const matchesEmpId = (c.employeeId || '').toLowerCase().includes(q);
        const matchesRoute = (c.routeNo || '').toLowerCase().includes(q);
        const matchesClaimId = (c.id || '').toLowerCase().includes(q);
        const matchesNotes = c.lines.some((l) => (l.note || '').toLowerCase().includes(q));
        const matchesCat = c.lines.some((l) =>
          (l.categoryDisplayName || l.categoryCode || '').toLowerCase().includes(q)
        );

        if (
          !matchesDriver &&
          !matchesEmpId &&
          !matchesRoute &&
          !matchesClaimId &&
          !matchesNotes &&
          !matchesCat
        ) {
          return false;
        }
      }
      return true;
    });

    return list.sort((a, b) => {
      const dateA = a.claimDate || a.createdAt || '';
      const dateB = b.claimDate || b.createdAt || '';
      if (dateA !== dateB) return dateB > dateA ? 1 : -1;
      const createdA = a.createdAt || '';
      const createdB = b.createdAt || '';
      return createdB > createdA ? 1 : createdB < createdA ? -1 : 0;
    });
  }, [claims, statusFilter, deferredSearchQuery]);

  // Virtual scrolling for a large expense roster.
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredClaims.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  const openReviewModal = (claim: ExpenseReimbursement) => {
    setSelectedClaim(claim);
    setReviewAction(claim.status === 'rejected' ? 'rejected' : 'approved');
    setReviewerName(
      claim.approvedByName ||
        currentUser?.displayName ||
        currentUser?.email?.split('@')[0] ||
        'Dispatch Office'
    );
    setApprovalNotes(claim.approvalNotes || '');
    setReviewError(null);
    setIsReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setIsReviewModalOpen(false);
    setSelectedClaim(null);
  };

  const handleSaveReview = async () => {
    if (!selectedClaim) return;
    if (!reviewerName.trim()) {
      setReviewError('Reviewer name is required.');
      return;
    }
    setReviewError(null);
    setSaving(true);
    try {
      const payload: ReviewExpenseClaimPayload = {
        status: reviewAction,
        approvalNotes: approvalNotes.trim(),
        approvedByName: reviewerName.trim(),
      };

      const updated = await ExpenseReimbursementService.reviewClaim(selectedClaim.id, payload);
      setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      closeReviewModal();
    } catch (err) {
      console.error('Failed to submit review:', err);
      setReviewError('Failed to save review decision. Please check server logs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Expense Reimbursements"
        subtitle="Review driver receipts, verify expenses, and approve reimbursement payouts."
        icon={
          <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/20">
            <Receipt className="w-5 h-5" aria-hidden="true" />
          </div>
        }
        badge={
          timeRange === '6months' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              Live Data (≤6 Months)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950 text-sky-300 border border-sky-800">
              <Database className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              BigQuery Historical Archive (&gt;6 Months)
            </span>
          )
        }
        actions={
          <button
            type="button"
            onClick={() => void refreshData()}
            disabled={loading}
            aria-label="Refresh expense claims"
            className="flex items-center gap-2 px-3.5 py-2 min-h-[36px] text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors shadow-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {/* ─── KPI Metrics ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Claims
            </span>
            <Receipt className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {stats.total}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
            <span>All recorded submissions</span>
          </div>
        </div>

        <div className="p-4 bg-slate-800/80 rounded-xl border border-amber-700/50 shadow-sm bg-gradient-to-br from-amber-50/30 to-transparent from-amber-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Pending Review
            </span>
            <Clock className="w-4 h-4" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold mt-2">
            {stats.pending}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs">
            <span>${stats.pendingDollars.toFixed(2)} awaiting review</span>
          </div>
        </div>

        <div className="p-4 bg-slate-800/80 rounded-xl border border-emerald-700/50 shadow-sm bg-gradient-to-br from-emerald-50/30 to-transparent from-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Approved Payouts
            </span>
            <DollarSign className="w-4 h-4" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold mt-2">
            ${stats.approvedDollars.toFixed(2)}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs">
            <span>{stats.approved} claims approved</span>
          </div>
        </div>

        <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Rejected / Cancelled
            </span>
            <XCircle className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            {stats.rejected}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
            <span>Declined or withdrawn claims</span>
          </div>
        </div>
      </div>

      {/* ─── Search and Filters Bar ────────────────────────────────────────── */}
      <search
        aria-label="Filter expense claims"
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm"
      >
        {/* 1. TimeRange Tier Selector (6 Months Live vs BigQuery All History) */}
        <div className="flex items-center bg-slate-800 p-1 rounded-lg shrink-0" role="group" aria-label="Claim data range">
          <button
            type="button"
            onClick={() => setTimeRange('6months')}
            aria-pressed={timeRange === '6months'}
            className={`px-3 py-1.5 min-h-[32px] rounded-md text-xs font-semibold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
              timeRange === '6months'
                ? 'bg-slate-800 text-sky-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⏱️ Live (&le;6 Months)
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all')}
            aria-pressed={timeRange === 'all'}
            className={`px-3 py-1.5 min-h-[32px] rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
              timeRange === 'all'
                ? 'bg-slate-800 text-sky-300 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
            <span>All History (BigQuery)</span>
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search expense claims"
            placeholder={
              timeRange === 'all'
                ? "Search BigQuery archives by driver, ID, route, receipt notes... (Press Enter)"
                : "Search by driver, employee ID, route, receipt notes..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && timeRange === 'all') {
                void loadClaims(searchQuery.trim());
              }
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-base sm:text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {timeRange === 'all' && (
          <button
            type="button"
            onClick={() => void loadClaims(searchQuery.trim())}
            disabled={loading}
            className="px-3.5 py-2 min-h-[36px] text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>Search Archive</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter expense claims by status"
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </search>

      {/* Claims table with virtual scrolling. */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm overflow-hidden">
        <div
          ref={tableContainerRef}
          tabIndex={0}
          role="region"
          aria-label="Expense reimbursement claims table"
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[350px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-500"
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Expense reimbursement claims</caption>
            <thead className="sticky top-0 z-10 bg-slate-900 text-slate-400 border-b border-slate-700 shadow-xs backdrop-blur-xs">
              <tr>
                <th scope="col" className="px-4 py-3.5 font-semibold">Date & Claim</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Driver</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Route</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Categories</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Items</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Total Amount</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {timeRange === 'all' && !searchQuery.trim() ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                    <Database className="w-10 h-10 text-sky-400 mx-auto mb-3" aria-hidden="true" />
                    <p className="font-semibold text-slate-200 text-sm">
                      BigQuery Historical Cold Archive
                    </p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      To protect system performance across multi-year archives, please enter a search term (driver name, employee ID, route #, or claim ID) above to query BigQuery.
                    </p>
                  </td>
                </tr>
              ) : loading && claims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500" role="status">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" aria-hidden="true" />
                    Loading expense claims...
                  </td>
                </tr>
              ) : filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto mb-3" aria-hidden="true" />
                    <p className="font-medium text-slate-300">
                      No expense claims found
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria or status filter.
                    </p>
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} colSpan={8} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const claim = filteredClaims[virtualRow.index];
                    if (!claim) return null;

                    const statusColors = EXPENSE_CLAIM_STATUS_COLORS[claim.status] || {
                      bg: 'bg-slate-800',
                      text: 'text-slate-200',
                      border: 'border-slate-300',
                    };

                    const uniqueCategories = Array.from(
                      new Set(
                        claim.lines.map(
                          (l) => l.categoryDisplayName || l.categoryCode || 'Expense'
                        )
                      )
                    );

                    const isCold = isArchivedClaimDate(claim.claimDate);
                    const phone = resolveEmployeePhone(claim.employeeId, claim.employeeName);

                    return (
                      <tr
                        key={claim.id}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                            <span>{claim.claimDate}</span>
                            {isCold && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded border">
                                <Database className="w-2.5 h-2.5" aria-hidden="true" />
                                BigQuery
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400 font-mono">
                              #{claim.id.slice(-8)}
                            </span>
                            {claim.attachmentUrls && claim.attachmentUrls.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightbox({
                                    urls: claim.attachmentUrls!,
                                    currentIndex: 0,
                                    claimTitle: `${claim.employeeName || 'Driver'} - ${claim.claimDate} (#${claim.id.slice(-6)})`,
                                  });
                                }}
                                aria-label={`View ${claim.attachmentUrls.length} receipt photos for ${claim.employeeName || 'Driver'} on ${claim.claimDate}`}
                                title={`View ${claim.attachmentUrls.length} receipt photo(s) directly`}
                                className="group inline-flex items-center gap-1.5 px-2 py-0.5 min-h-[24px] rounded-md text-xs font-semibold border hover:bg-teal-500/15 hover:bg-teal-800/60 hover:ring-2 hover:ring-teal-400/30 transition-all cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                              >
                                <div className="w-4 h-4 rounded overflow-hidden bg-slate-800 shrink-0 border">
                                  <img
                                    src={claim.attachmentUrls[0]}
                                    alt=""
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                </div>
                                <Paperclip className="w-3 h-3" aria-hidden="true" />
                                <span>{claim.attachmentUrls.length}</span>
                                <Eye className="w-3 h-3 text-teal-500 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {onSelectEmployee && claim.employeeName ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEmployee(claim.employeeId, claim.employeeName);
                              }}
                              className="font-medium text-slate-200 flex items-center gap-1.5 hover:text-teal-600 hover:text-teal-300 hover:underline transition text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                              title="View employee details"
                            >
                              <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              {claim.employeeName}
                            </button>
                          ) : (
                            <div className="font-medium text-white flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              {claim.employeeName || 'Unknown Driver'}
                            </div>
                          )}
                          {phone ? (
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <a
                                href={`tel:${phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-teal-600 hover:text-teal-300 hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                              >
                                {phone}
                              </a>
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3.5">
                          {claim.routeNo ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border">
                              <RouteIcon className="w-3 h-3" aria-hidden="true" />
                              {claim.routeNo}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {uniqueCategories.slice(0, 2).map((cat, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300"
                              >
                                <Tag className="w-2.5 h-2.5 text-slate-400" aria-hidden="true" />
                                {cat}
                              </span>
                            ))}
                            {uniqueCategories.length > 2 && (
                              <span className="text-xs text-slate-400 self-center">
                                +{uniqueCategories.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-slate-300 font-medium">
                            {claim.lines.length}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-base font-bold text-white">
                            ${(claim.totalAmount || 0).toFixed(2)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
                          >
                            {claim.status === 'approved' && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                            )}
                            {claim.status === 'rejected' && (
                              <XCircle className="w-3 h-3 text-rose-600" aria-hidden="true" />
                            )}
                            {claim.status === 'pending' && (
                              <Clock className="w-3 h-3 text-amber-600" aria-hidden="true" />
                            )}
                            {EXPENSE_CLAIM_STATUS_LABELS[claim.status] || claim.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => openReviewModal(claim)}
                            aria-label={`${claim.status === 'pending' ? 'Review claim' : 'View details'} for ${claim.employeeName || 'Driver'} on ${claim.claimDate}`}
                            className={`px-3 py-1.5 min-h-[28px] text-xs font-semibold rounded-lg transition-colors shadow-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
                              claim.status === 'pending'
                                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                            }`}
                          >
                            {claim.status === 'pending' ? 'Review Claim' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} colSpan={8} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Review & Details Modal ────────────────────────────────────────── */}
      <ExpenseModalDialog
        open={Boolean(isReviewModalOpen && selectedClaim)}
        onClose={closeReviewModal}
        ariaLabelledBy="expense-review-modal-title"
        backdropClassName="bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        panelClassName="bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-700 overflow-hidden my-8"
      >
        {selectedClaim && (
          <>
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900/60 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 rounded-lg">
                  <Receipt className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="expense-review-modal-title" className="text-lg font-bold text-slate-200">
                    Expense Claim Review
                  </h3>
                  <p className="text-xs text-slate-400">
                    ID: #{selectedClaim.id} • Submitted {selectedClaim.claimDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                autoFocus
                onClick={closeReviewModal}
                aria-label="Close expense claim review modal"
                className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:text-slate-200 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Claim Overview Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-900/40 rounded-xl border border-slate-700/60">
                <div>
                  <span className="text-xs text-slate-400">Driver</span>
                  {onSelectEmployee && selectedClaim.employeeName ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectEmployee(selectedClaim.employeeId, selectedClaim.employeeName)
                      }
                      className="text-sm font-semibold text-slate-200 hover:text-teal-600 hover:text-teal-300 hover:underline transition text-left rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                      title="View employee details"
                    >
                      {selectedClaim.employeeName}
                    </button>
                  ) : (
                    <p className="text-sm font-semibold text-white">
                      {selectedClaim.employeeName}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-slate-400">Phone</span>
                  <p className="text-sm font-semibold text-white">
                    {resolveEmployeePhone(selectedClaim.employeeId, selectedClaim.employeeName) ||
                      'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Route #</span>
                  <p className="text-sm font-semibold text-white">
                    {selectedClaim.routeNo || 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Current Status</span>
                  <div className="mt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        EXPENSE_CLAIM_STATUS_COLORS[selectedClaim.status]?.bg
                      } ${EXPENSE_CLAIM_STATUS_COLORS[selectedClaim.status]?.text}`}
                    >
                      {EXPENSE_CLAIM_STATUS_LABELS[selectedClaim.status] || selectedClaim.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Line Items */}
              <div>
                <h4 className="text-sm font-bold text-white mb-2 flex items-center justify-between">
                  <span>Itemized Expenses ({selectedClaim.lines.length})</span>
                  <span className="font-bold">
                    Total: ${(selectedClaim.totalAmount || 0).toFixed(2)}
                  </span>
                </h4>
                <div className="border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <caption className="sr-only">Itemized expenses for claim {selectedClaim.id}</caption>
                    <thead className="bg-slate-900/60 text-slate-500 font-semibold border-b border-slate-700">
                      <tr>
                        <th scope="col" className="px-3 py-2">#</th>
                        <th scope="col" className="px-3 py-2">Category</th>
                        <th scope="col" className="px-3 py-2">Receipt / Description</th>
                        <th scope="col" className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {selectedClaim.lines.map((line, idx) => (
                        <tr key={line.id || idx}>
                          <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-white">
                            {line.categoryDisplayName || line.categoryCode}
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">
                            {line.note || <span className="italic text-slate-400">No notes</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-white">
                            ${(line.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-900/40 border-t border-slate-700">
                      <tr>
                        <td colSpan={3} className="px-3 py-2.5 font-bold text-slate-200">
                          Total Reimbursement Amount
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-sm">
                          ${(selectedClaim.totalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Attached Receipts & Documentation */}
              {selectedClaim.attachmentUrls && selectedClaim.attachmentUrls.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-white mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4" aria-hidden="true" />
                      Attached Receipts & Proof of Purchase ({selectedClaim.attachmentUrls.length})
                    </span>
                    <span className="text-xs text-slate-400">Click image to open original</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedClaim.attachmentUrls.map((url, i) => (
                      <button
                        type="button"
                        key={i}
                        aria-label={`Open receipt ${i + 1} of ${selectedClaim.attachmentUrls!.length} in lightbox`}
                        onClick={() =>
                          setLightbox({
                            urls: selectedClaim.attachmentUrls!,
                            currentIndex: i,
                            claimTitle: `${selectedClaim.employeeName || 'Driver'} - ${selectedClaim.claimDate} (#${selectedClaim.id.slice(-6)})`,
                          })
                        }
                        className="group relative block rounded-xl overflow-hidden border border-slate-700 aspect-square bg-slate-800 hover:ring-2 hover:ring-teal-500 transition-all shadow-sm cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                      >
                        <img
                          src={url}
                          alt={`Receipt #${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          View Full
                        </div>
                        <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                          Receipt #{i + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Administrative Review Section */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-600" aria-hidden="true" />
                  <h4 className="text-sm font-bold text-white">
                    Office Review & Approval Decision
                  </h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Decision
                    </span>
                    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Approval decision">
                      <button
                        type="button"
                        aria-pressed={reviewAction === 'approved'}
                        onClick={() => setReviewAction('approved')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold text-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                          reviewAction === 'approved'
                            ? 'bg-emerald-500/10 border-emerald-500  ring-2 ring-emerald-500/20'
                            : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        Approve for Reimbursement
                      </button>

                      <button
                        type="button"
                        aria-pressed={reviewAction === 'rejected'}
                        onClick={() => setReviewAction('rejected')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold text-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
                          reviewAction === 'rejected'
                            ? 'bg-rose-500/10 border-rose-500  ring-2 ring-rose-500/20'
                            : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <XCircle className="w-4 h-4 text-rose-600" aria-hidden="true" />
                        Reject Claim
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="expense-reviewer-name" className="block text-xs font-semibold text-slate-200 mb-1">
                      Reviewer Name *
                    </label>
                    <input
                      id="expense-reviewer-name"
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      placeholder="e.g. Alice Smith (Payroll / Dispatch)"
                      className="w-full px-3 py-2 text-base sm:text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="expense-approval-notes" className="block text-xs font-semibold text-slate-200 mb-1">
                      Administrative Notes / Payroll Code
                    </label>
                    <textarea
                      id="expense-approval-notes"
                      rows={3}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="e.g. Verified Shell gas receipt #9842. Added to cycle #14 payroll payout."
                      className="w-full px-3 py-2 text-base sm:text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-700 flex items-center justify-end gap-3">
              {reviewError && (
                <span role="alert" className="mr-auto text-xs font-semibold text-rose-500">
                  {reviewError}
                </span>
              )}
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={saving}
                className="px-4 py-2 min-h-[36px] text-sm font-medium text-slate-200 hover:bg-slate-700 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReview}
                disabled={saving}
                className={`px-5 py-2 min-h-[36px] text-sm font-bold text-white rounded-lg transition-all shadow-md flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
                  reviewAction === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {reviewAction === 'approved' ? 'Approve & Confirm' : 'Confirm Rejection'}
              </button>
            </div>
          </>
        )}
      </ExpenseModalDialog>

      {/* ─── Receipt Image Multi-Photo Lightbox Modal ───────────────────────── */}
      <ExpenseModalDialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        ariaLabelledBy="expense-lightbox-modal-title"
        backdropClassName="bg-black/90 backdrop-blur-md animate-fade-in"
        panelClassName="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center border border-slate-700"
      >
        {lightbox && (
          <>
            {/* Lightbox Header */}
            <div className="w-full flex items-center justify-between p-3.5 border-b border-slate-800 text-white bg-slate-900/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="w-4 h-4 text-teal-400 shrink-0" aria-hidden="true" />
                <h3 id="expense-lightbox-modal-title" className="text-sm font-semibold truncate">
                  {lightbox.claimTitle}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 shrink-0">
                  {lightbox.currentIndex + 1} / {lightbox.urls.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.urls[lightbox.currentIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 min-h-[28px] text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Full Size
                </a>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setLightbox(null)}
                  aria-label="Close receipt lightbox"
                  className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Lightbox Image Preview + Prev/Next Controls */}
            <div className="relative w-full p-4 flex items-center justify-center max-h-[75vh] min-h-[300px] overflow-hidden bg-slate-950/60">
              {lightbox.urls.length > 1 && (
                <button
                  type="button"
                  disabled={lightbox.currentIndex === 0}
                  onClick={() =>
                    setLightbox((prev) =>
                      prev && prev.currentIndex > 0
                        ? { ...prev, currentIndex: prev.currentIndex - 1 }
                        : prev
                    )
                  }
                  aria-label="Previous receipt image"
                  className="absolute left-3 z-10 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-sm shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                  title="Previous image (Left arrow)"
                >
                  <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                </button>
              )}

              <img
                src={lightbox.urls[lightbox.currentIndex]}
                alt={`Receipt #${lightbox.currentIndex + 1}`}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl transition-all"
              />

              {lightbox.urls.length > 1 && (
                <button
                  type="button"
                  disabled={lightbox.currentIndex === lightbox.urls.length - 1}
                  onClick={() =>
                    setLightbox((prev) =>
                      prev && prev.currentIndex < prev.urls.length - 1
                        ? { ...prev, currentIndex: prev.currentIndex + 1 }
                        : prev
                    )
                  }
                  aria-label="Next receipt image"
                  className="absolute right-3 z-10 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-sm shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
                  title="Next image (Right arrow)"
                >
                  <ChevronRight className="w-6 h-6" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Thumbnail Bottom Strip if multiple */}
            {lightbox.urls.length > 1 && (
              <div className="w-full p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-2 overflow-x-auto">
                {lightbox.urls.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`View receipt ${idx + 1} of ${lightbox.urls.length}`}
                    aria-pressed={idx === lightbox.currentIndex}
                    onClick={() => setLightbox((prev) => (prev ? { ...prev, currentIndex: idx } : null))}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 ${
                      idx === lightbox.currentIndex
                        ? 'border-teal-400 ring-2 ring-teal-400/40 scale-105'
                        : 'border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </ExpenseModalDialog>
    </PageShell>
  );
};


