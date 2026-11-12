import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  groupLabel?: string;
  searchText: string;
  badgeText?: string;
  badgeClassName?: string;
  secondaryBadgeText?: string;
  secondaryBadgeClassName?: string;
  subtext?: string;
  warningText?: string;
  isHighlighted?: boolean;
  disabled?: boolean;
}

/**
 * Filters options using whitespace-separated tokens against each option's `searchText` and `label`.
 */
export function filterSearchableOptions(
  options: SearchableSelectOption[],
  query: string
): SearchableSelectOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return options;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return options.filter((opt) => {
    const haystack = `${opt.label} ${opt.searchText}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  emptyOptionLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  icon?: React.ReactNode;
  variant?: 'adaptive' | 'dark';
  compact?: boolean;
  allowClear?: boolean;
  testId?: string;
  accentColor?: 'amber' | 'indigo' | 'blue' | 'emerald';
}

const ACCENT_RING: Record<NonNullable<SearchableSelectProps['accentColor']>, string> = {
  amber: 'border-amber-500 ring-2 ring-amber-500/20',
  indigo: 'border-indigo-500 ring-2 ring-indigo-500/20',
  blue: 'border-blue-500 ring-2 ring-blue-500/20',
  emerald: 'border-emerald-500 ring-2 ring-emerald-500/20',
};

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  emptyOptionLabel,
  placeholder = '-- Select --',
  searchPlaceholder = 'Search...',
  noResultsText = 'No matches found',
  icon,
  variant = 'adaptive',
  compact = false,
  allowClear = true,
  testId,
  accentColor = 'amber',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(
    () => filterSearchableOptions(options, query),
    [options, query]
  );

  const groupedSections = useMemo(() => {
    const sections: Array<{ groupLabel: string; items: SearchableSelectOption[] }> = [];
    const byLabel = new Map<string, SearchableSelectOption[]>();
    for (const opt of filteredOptions) {
      const label = opt.groupLabel || '';
      let list = byLabel.get(label);
      if (!list) {
        list = [];
        byLabel.set(label, list);
        sections.push({ groupLabel: label, items: list });
      }
      list.push(opt);
    }
    return sections;
  }, [filteredOptions]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const isDarkOnly = variant === 'dark';

  const triggerClasses = isDarkOnly
    ? `w-full bg-slate-800 border rounded-xl ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'} text-white flex items-center justify-between cursor-pointer transition text-left ${
        isOpen ? ACCENT_RING[accentColor] : 'border-slate-700 hover:border-slate-600'
      }`
    : `w-full bg-white dark:bg-slate-800 border rounded-xl ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'} text-slate-900 dark:text-white flex items-center justify-between cursor-pointer transition text-left ${
        isOpen
          ? ACCENT_RING[accentColor]
          : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
      }`;

  const popoverClasses = isDarkOnly
    ? 'absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden'
    : 'absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden';

  const searchHeaderClasses = isDarkOnly
    ? 'p-2 border-b border-slate-800 bg-slate-950/60'
    : 'p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50';

  const searchInputClasses = isDarkOnly
    ? 'w-full pl-8 pr-7 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500'
    : 'w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500';

  const groupHeaderClasses = isDarkOnly
    ? 'px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/80 border-y border-slate-800/80 sticky top-0 z-10'
    : 'px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/90 border-y border-slate-200/70 dark:border-slate-700/70 sticky top-0 z-10';

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={containerRef} data-testid={testId}>
      <button
        type="button"
        data-testid={testId ? `${testId}-trigger` : undefined}
        onClick={() => setIsOpen((prev) => !prev)}
        className={triggerClasses}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          {icon && <span className="shrink-0">{icon}</span>}
          <span
            className={`truncate ${
              selectedOption
                ? isDarkOnly
                  ? 'text-white font-medium'
                  : 'text-slate-900 dark:text-white font-medium'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {selectedOption ? selectedOption.label : emptyOptionLabel || placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {allowClear && value !== '' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setQuery('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                  setQuery('');
                }
              }}
              className={
                isDarkOnly
                  ? 'p-0.5 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white'
                  : 'p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full'
              }
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className={popoverClasses}>
          <div className={searchHeaderClasses}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                data-testid={testId ? `${testId}-search` : undefined}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={searchInputClasses}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setIsOpen(false);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
                      handleSelect(filteredOptions[0].value);
                    }
                  }
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div
            className={`max-h-60 overflow-y-auto divide-y ${
              isDarkOnly
                ? 'divide-slate-800/70'
                : 'divide-slate-100 dark:divide-slate-800/60'
            }`}
          >
            {emptyOptionLabel && !query.trim() && (
              <div
                onClick={() => handleSelect('')}
                className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                  value === ''
                    ? isDarkOnly
                      ? 'bg-amber-500/15 text-amber-300 font-medium'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 font-medium'
                    : isDarkOnly
                      ? 'hover:bg-slate-800 text-slate-400 italic'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 italic'
                }`}
              >
                <span>{emptyOptionLabel}</span>
                {value === '' && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-400">{noResultsText}</div>
            ) : (
              groupedSections.map((section) => (
                <React.Fragment key={section.groupLabel || '__default'}>
                  {section.groupLabel && (
                    <div className={groupHeaderClasses}>{section.groupLabel}</div>
                  )}
                  {section.items.map((opt) => {
                    const isSelected = value === opt.value;
                    return (
                      <div
                        key={opt.value}
                        data-testid={testId ? `${testId}-option-${opt.value}` : undefined}
                        onClick={() => {
                          if (!opt.disabled) handleSelect(opt.value);
                        }}
                        className={`px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                          opt.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isSelected
                            ? isDarkOnly
                              ? 'bg-amber-500/15 text-amber-200 font-medium'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 font-medium'
                            : opt.isHighlighted
                              ? isDarkOnly
                                ? 'bg-amber-500/5 hover:bg-amber-500/10 text-slate-200'
                                : 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-300'
                              : isDarkOnly
                                ? 'hover:bg-slate-800/80 text-slate-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`truncate ${
                                isDarkOnly
                                  ? 'text-slate-100 font-medium'
                                  : 'text-slate-900 dark:text-slate-100 font-medium'
                              }`}
                            >
                              {opt.label}
                            </span>
                            {opt.badgeText && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                                  opt.badgeClassName ||
                                  (isDarkOnly
                                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700')
                                }`}
                              >
                                {opt.badgeText}
                              </span>
                            )}
                            {opt.secondaryBadgeText && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                                  opt.secondaryBadgeClassName ||
                                  (isDarkOnly
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800')
                                }`}
                              >
                                {opt.secondaryBadgeText}
                              </span>
                            )}
                          </div>
                          {opt.subtext && (
                            <div
                              className={`text-[10px] truncate mt-0.5 ${
                                isDarkOnly ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {opt.subtext}
                            </div>
                          )}
                          {opt.warningText && (
                            <div
                              className={`text-[10px] truncate mt-0.5 font-medium ${
                                isDarkOnly
                                  ? 'text-amber-300'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {opt.warningText}
                            </div>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
