import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/common/PageShell';
import { PageHeader } from '../components/common/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import {
  ClientOperationErrorRecord,
  listClientOperationErrors,
} from '../services/clientErrorReporter';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  MailX,
  RefreshCw,
  Search,
} from 'lucide-react';

export const ErrorLogsView: React.FC = memo(function ErrorLogsView() {
  const { isFrench } = useI18n();
  const [rows, setRows] = useState<ClientOperationErrorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageFilter, setPageFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClientOperationErrors({
        limit: 200,
        page: pageFilter === 'all' ? undefined : pageFilter,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load client operation errors:', err);
      setError(err instanceof Error ? err.message : 'Failed to load error logs');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [pageFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.page) set.add(r.page);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        (r.page || '').toLowerCase().includes(q) ||
        (r.userName || '').toLowerCase().includes(q) ||
        (r.userId || '').toLowerCase().includes(q) ||
        (r.endpoint || '').toLowerCase().includes(q) ||
        (r.message || '').toLowerCase().includes(q) ||
        (r.method || '').toLowerCase().includes(q) ||
        String(r.status || '').includes(q)
      );
    });
  }, [rows, search]);

  return (
    <PageShell>
      <PageHeader
        title={isFrench ? 'Journaux d\'erreurs client' : 'Client Error Logs'}
        subtitle={
          isFrench
            ? 'Échecs de lecture/écriture du portail web, avec état d\'envoi des alertes courriel.'
            : 'Failed web portal reads and writes, including email alert delivery status.'
        }
        icon={<AlertTriangle className="w-5 h-5 text-rose-400" aria-hidden="true" />}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isFrench ? 'Actualiser' : 'Refresh'}
          </button>
        }
      />

      <search
        aria-label={isFrench ? 'Rechercher et filtrer les journaux d\'erreurs' : 'Search and filter error logs'}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label={isFrench ? 'Rechercher page, utilisateur, endpoint ou message' : 'Search page, user, endpoint, or message'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isFrench
                ? 'Rechercher page, utilisateur, endpoint, message...'
                : 'Search page, user, endpoint, message...'
            }
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-base sm:text-sm text-slate-100 placeholder:text-slate-550 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-rose-400"
          />
        </div>
        <select
          value={pageFilter}
          onChange={(e) => setPageFilter(e.target.value)}
          aria-label={isFrench ? 'Filtrer par page' : 'Filter by page'}
          className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-base sm:text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-rose-400"
        >
          <option value="all">{isFrench ? 'Toutes les pages' : 'All pages'}</option>
          {Array.from(
            new Set([
              ...pages,
              'dispatch',
              'charter',
              'routes',
              'students',
              'expenses',
              'hazards',
              'payroll',
              'time_off',
            ])
          )
            .sort()
            .map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
        </select>
      </search>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/40">
        <div
          tabIndex={0}
          role="region"
          aria-label={isFrench ? 'Tableau des journaux d\'erreurs client' : 'Client error logs table'}
          className="overflow-x-auto max-h-[70vh] overflow-y-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rose-400"
        >
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              {isFrench ? 'Journaux d\'erreurs client' : 'Client error logs'}
            </caption>
            <thead className="sticky top-0 bg-slate-900 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{isFrench ? 'Heure' : 'Time'}</th>
                <th scope="col" className="px-4 py-3 font-semibold">Page</th>
                <th scope="col" className="px-4 py-3 font-semibold">{isFrench ? 'Utilisateur' : 'User'}</th>
                <th scope="col" className="px-4 py-3 font-semibold">Request</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Message</th>
                <th scope="col" className="px-4 py-3 font-semibold">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <div role="status">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-400" aria-hidden="true" />
                      {isFrench ? 'Chargement...' : 'Loading...'}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    {isFrench ? 'Aucune erreur enregistrée' : 'No errors recorded'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const timeStr = row.timestamp?.includes('T')
                    ? row.timestamp.replace('T', ' ').replace('Z', '')
                    : row.timestamp;
                  return (
                    <tr key={row.id} className="hover:bg-slate-900/60 align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                        <div className="text-[10px] text-slate-500">{row.date}</div>
                        <div className="flex items-center gap-1 font-mono text-xs">
                          <Clock className="w-3 h-3 text-amber-500/70" aria-hidden="true" />
                          {timeStr}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-amber-300">{row.page}</span>
                        {row.action ? (
                          <div className="text-[10px] text-slate-500 mt-0.5">{row.action}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-100 text-xs font-medium">
                          {row.userName || '—'}
                        </div>
                        {row.userId ? (
                          <div className="text-[10px] text-slate-500 font-mono">{row.userId}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="font-mono text-[11px] text-sky-300">
                          {(row.method || '—') + (row.status ? ` · ${row.status}` : '')}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate" title={row.endpoint}>
                          {row.endpoint || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                            !row.status || row.status >= 500
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : row.status >= 400
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                          }`}
                        >
                          {row.status || 'n/a'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[320px]">
                        <p className="text-xs text-slate-300 line-clamp-3" title={row.message}>
                          {row.message}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.emailSent ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                            Sent
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500"
                            title={row.emailSkipped || undefined}
                          >
                            {row.emailSkipped ? (
                              <>
                                <MailX className="w-3.5 h-3.5" aria-hidden="true" />
                                {row.emailSkipped}
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />
                                —
                              </>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
});
