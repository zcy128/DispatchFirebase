import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

export const ExpenseReimbursementsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [claims, setClaims] = useState<ExpenseReimbursement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedClaim, setSelectedClaim] = useState<ExpenseReimbursement | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    currentIndex: number;
    claimTitle: string;
  } | null>(null);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
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

  // 1. 超过6个月是bigquery冷数据
  const [timeRange, setTimeRange] = useState<'6months' | 'all'>('6months');

  const isArchivedDate = (claimDate?: string) => {
    return ExpenseReimbursementService.isColdClaim(claimDate);
  };

  const loadClaims = async (targetQuery?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    if (timeRange === 'all' && !q) {
      setClaims([]);
      setLoading(false);
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
      setClaims(data);
    } catch (err) {
      console.error('Failed to load expense claims:', err);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time updates (live data <= 6 months) or load targeted archives
  useEffect(() => {
    if (timeRange === '6months') {
      setLoading(true);
      const unsubscribe = ExpenseReimbursementService.subscribeClaims((data) => {
        setClaims(data);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      if (searchQuery.trim()) {
        loadClaims(searchQuery.trim());
      } else {
        setClaims([]);
        setLoading(false);
      }
    }
  }, [timeRange]);

  const refreshData = async () => {
    if (timeRange === 'all') {
      if (searchQuery.trim()) {
        loadClaims(searchQuery.trim());
      } else {
        setClaims([]);
      }
    } else {
      loadClaims();
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = claims.length;
    const pending = claims.filter((c) => c.status === 'pending').length;
    const approved = claims.filter((c) => c.status === 'approved').length;
    const rejected = claims.filter((c) => c.status === 'rejected').length;
    const approvedDollars = claims
      .filter((c) => c.status === 'approved')
      .reduce((sum, c) => sum + (c.totalAmount || 0), 0);
    const pendingDollars = claims
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + (c.totalAmount || 0), 0);

    return { total, pending, approved, rejected, approvedDollars, pendingDollars };
  }, [claims]);

  // 3. 按照日期逆序 (Newest claim date first)
  const filteredClaims = useMemo(() => {
    const list = claims.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
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
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [claims, statusFilter, searchQuery]);

  // 2. 虚拟滚动 (Virtual Scrolling for large expense roster)
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
    setIsReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setIsReviewModalOpen(false);
    setSelectedClaim(null);
  };

  const handleSaveReview = async () => {
    if (!selectedClaim) return;
    setSaving(true);
    try {
      const payload: ReviewExpenseClaimPayload = {
        status: reviewAction,
        approvalNotes: approvalNotes.trim(),
        approvedByName: reviewerName.trim() || 'Dispatch Office',
      };

      const updated = await ExpenseReimbursementService.reviewClaim(selectedClaim.id, payload);
      setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      closeReviewModal();
    } catch (err) {
      console.error('Failed to submit review:', err);
      alert('Failed to save review decision. Please check server logs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-xl border border-teal-500/20">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Expense Reimbursements
              {timeRange === '6months' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Data (≤6 Months)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                  <Database className="w-3.5 h-3.5 text-sky-500" />
                  BigQuery Historical Archive (&gt;6 Months)
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review driver receipts, verify expenses, and approve reimbursement payouts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Claims
            </span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.total}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>All recorded submissions</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-amber-200 dark:border-amber-700/50 shadow-sm bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Pending Review
            </span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-2">
            {stats.pending}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
            <span>${stats.pendingDollars.toFixed(2)} awaiting review</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-emerald-200 dark:border-emerald-700/50 shadow-sm bg-gradient-to-br from-emerald-50/30 to-transparent dark:from-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Approved Payouts
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-2">
            ${stats.approvedDollars.toFixed(2)}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80">
            <span>{stats.approved} claims approved</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Rejected / Cancelled
            </span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.rejected}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Declined or withdrawn claims</span>
          </div>
        </div>
      </div>

      {/* ─── Search and Filters Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* 1. TimeRange Tier Selector (6 Months Live vs BigQuery All History) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-750 p-1 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setTimeRange('6months')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              timeRange === '6months'
                ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            ⏱️ Live (&le;6 Months)
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              timeRange === 'all'
                ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-sky-500" />
            <span>All History (BigQuery)</span>
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              timeRange === 'all'
                ? "Search BigQuery archives by driver, ID, route, receipt notes..."
                : "Search by driver, employee ID, route, receipt notes..."
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (timeRange === 'all') {
                loadClaims(e.target.value);
              }
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter expense claims by status"
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* ─── Claims Table (2. 虚拟滚动) ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[350px]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 shadow-xs backdrop-blur-xs">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Date & Claim</th>
                <th className="px-4 py-3.5 font-semibold">Driver</th>
                <th className="px-4 py-3.5 font-semibold">Route</th>
                <th className="px-4 py-3.5 font-semibold">Categories</th>
                <th className="px-4 py-3.5 font-semibold">Items</th>
                <th className="px-4 py-3.5 font-semibold">Total Amount</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {timeRange === 'all' && !searchQuery.trim() ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                    <Database className="w-10 h-10 text-sky-400 mx-auto mb-3" />
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      BigQuery Historical Cold Archive
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                      To protect system performance across multi-year archives, please enter a search term (driver name, employee ID, route #, or claim ID) above to query BigQuery.
                    </p>
                  </td>
                </tr>
              ) : loading && claims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                    Loading expense claims...
                  </td>
                </tr>
              ) : filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="font-medium text-slate-700 dark:text-slate-300">
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
                      bg: 'bg-slate-100',
                      text: 'text-slate-700',
                      border: 'border-slate-300',
                    };

                    const uniqueCategories = Array.from(
                      new Set(
                        claim.lines.map(
                          (l) => l.categoryDisplayName || l.categoryCode || 'Expense'
                        )
                      )
                    );

                    const isCold = isArchivedDate(claim.claimDate);

                    return (
                      <tr
                        key={claim.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{claim.claimDate}</span>
                            {isCold && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                                <Database className="w-2.5 h-2.5" />
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
                                title={`View ${claim.attachmentUrls.length} receipt photo(s) directly`}
                                className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700/60 hover:bg-teal-100 dark:hover:bg-teal-800/60 hover:ring-2 hover:ring-teal-400/30 transition-all cursor-pointer shadow-xs"
                              >
                                <div className="w-4 h-4 rounded overflow-hidden bg-slate-200 shrink-0 border border-teal-300 dark:border-teal-600">
                                  <img
                                    src={claim.attachmentUrls[0]}
                                    alt="Thumbnail"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                </div>
                                <Paperclip className="w-3 h-3" />
                                <span>{claim.attachmentUrls.length}</span>
                                <Eye className="w-3 h-3 text-teal-500 opacity-60 group-hover:opacity-100" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {claim.employeeName || 'Unknown Driver'}
                          </div>
                          <div className="text-xs text-slate-400">
                            ID: {claim.employeeId || 'N/A'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {claim.routeNo ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                              <RouteIcon className="w-3 h-3" />
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                              >
                                <Tag className="w-2.5 h-2.5 text-slate-400" />
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
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {claim.lines.length}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-base font-bold text-slate-900 dark:text-white">
                            ${(claim.totalAmount || 0).toFixed(2)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
                          >
                            {claim.status === 'approved' && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {claim.status === 'rejected' && (
                              <XCircle className="w-3 h-3 text-rose-600" />
                            )}
                            {claim.status === 'pending' && (
                              <Clock className="w-3 h-3 text-amber-600" />
                            )}
                            {EXPENSE_CLAIM_STATUS_LABELS[claim.status] || claim.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => openReviewModal(claim)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-sm cursor-pointer ${
                              claim.status === 'pending'
                                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200'
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
      {isReviewModalOpen && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-lg">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Expense Claim Review
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ID: #{selectedClaim.id} • Submitted {selectedClaim.claimDate}
                  </p>
                </div>
              </div>
              <button
                onClick={closeReviewModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Claim Overview Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div>
                  <span className="text-xs text-slate-400">Driver</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedClaim.employeeName}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Employee ID</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedClaim.employeeId || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Route #</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
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
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                  <span>Itemized Expenses ({selectedClaim.lines.length})</span>
                  <span className="text-teal-600 dark:text-teal-400 font-bold">
                    Total: ${(selectedClaim.totalAmount || 0).toFixed(2)}
                  </span>
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Receipt / Description</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {selectedClaim.lines.map((line, idx) => (
                        <tr key={line.id || idx}>
                          <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                            {line.categoryDisplayName || line.categoryCode}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                            {line.note || <span className="italic text-slate-400">No notes</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                            ${(line.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/70 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={3} className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                          Total Reimbursement Amount
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-sm text-teal-600 dark:text-teal-400">
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
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      Attached Receipts & Proof of Purchase ({selectedClaim.attachmentUrls.length})
                    </span>
                    <span className="text-xs text-slate-400">Click image to open original</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedClaim.attachmentUrls.map((url, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() =>
                          setLightbox({
                            urls: selectedClaim.attachmentUrls!,
                            currentIndex: i,
                            claimTitle: `${selectedClaim.employeeName || 'Driver'} - ${selectedClaim.claimDate} (#${selectedClaim.id.slice(-6)})`,
                          })
                        }
                        className="group relative block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-teal-500 transition-all shadow-sm cursor-pointer text-left"
                      >
                        <img
                          src={url}
                          alt={`Receipt #${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                          <Eye className="w-3.5 h-3.5" />
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
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Office Review & Approval Decision
                  </h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Decision
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReviewAction('approved')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold text-sm transition-all ${
                          reviewAction === 'approved'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Approve for Reimbursement
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewAction('rejected')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold text-sm transition-all ${
                          reviewAction === 'rejected'
                            ? 'bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400 ring-2 ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Reject Claim
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Reviewer Name
                    </label>
                    <input
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      placeholder="e.g. Alice Smith (Payroll / Dispatch)"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Administrative Notes / Payroll Code
                    </label>
                    <textarea
                      rows={3}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="e.g. Verified Shell gas receipt #9842. Added to cycle #14 payroll payout."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReview}
                disabled={saving}
                className={`px-5 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-md flex items-center gap-2 ${
                  reviewAction === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {reviewAction === 'approved' ? 'Approve & Confirm' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receipt Image Multi-Photo Lightbox Modal ───────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="w-full flex items-center justify-between p-3.5 border-b border-slate-800 text-white bg-slate-900/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="text-sm font-semibold truncate">
                  {lightbox.claimTitle}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 shrink-0">
                  {lightbox.currentIndex + 1} / {lightbox.urls.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightbox.urls[lightbox.currentIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Full Size
                </a>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
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
                  className="absolute left-3 z-10 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-sm shadow-lg"
                  title="Previous image (Left arrow)"
                >
                  <ChevronLeft className="w-6 h-6" />
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
                  className="absolute right-3 z-10 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer backdrop-blur-sm shadow-lg"
                  title="Next image (Right arrow)"
                >
                  <ChevronRight className="w-6 h-6" />
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
                    onClick={() => setLightbox((prev) => (prev ? { ...prev, currentIndex: idx } : null))}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      idx === lightbox.currentIndex
                        ? 'border-teal-400 ring-2 ring-teal-400/40 scale-105'
                        : 'border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
