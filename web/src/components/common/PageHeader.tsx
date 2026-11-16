import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAIOptional } from '../../contexts/AIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';

interface PageHeaderProps {
  /** Primary page heading rendered inside the <h1> element. */
  title: React.ReactNode;
  /** Optional descriptive subtitle displayed beneath the title. */
  subtitle?: React.ReactNode;
  /** Optional leading icon rendered next to the title. */
  icon?: React.ReactNode;
  /** Optional status or count badge rendered inline with the title. */
  badge?: React.ReactNode;
  /** Right-aligned action controls (refresh, export, primary CTA). */
  actions?: React.ReactNode;
  /** Optional embedded toolbar/search bar rendered inside the header card. */
  children?: React.ReactNode;
  /** Optional extra classes for the header card container. */
  className?: string;
}

/**
 * Shared dark-first page header card modeled after StagingRouteListView,
 * providing a consistent <h1> hierarchy, subtitle, action slot, and optional filter bar.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  badge,
  actions,
  children,
  className = '',
}) => {
  const ai = useAIOptional();
  const { currentUser } = useAuth();
  const { isFrench } = useI18n();
  const canUseAI = ai !== null && Boolean(currentUser);
  const contextChip = ai?.pageContext.selectedDate
    ? ai.pageContext.selectedDate
    : ai?.pageContext.activePage === 'routes'
      ? (isFrench ? 'Permanent' : 'Permanent')
      : undefined;

  return (
    <header
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3 ${className}`.trim()}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {icon && <span className="shrink-0 flex items-center">{icon}</span>}
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {(actions || canUseAI) && (
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
            {actions}
            {canUseAI && (
              <button
                type="button"
                onClick={() => ai.openAI()}
                title={isFrench ? 'Ouvrir l\'assistant IA pour cette page' : 'Open page-scoped AI Assistant'}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-bold transition inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                <span>{isFrench ? 'Assistant IA' : 'AI Assistant'}</span>
                {contextChip && (
                  <span className="hidden sm:inline px-1.5 py-0.5 rounded-md bg-slate-950/60 border border-amber-500/25 text-[10px] font-mono text-amber-200">
                    {contextChip}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </header>
  );
};
