export interface CommandHistoryStep {
  nextIndex: number;
  nextValue: string;
  nextDraft: string;
}

export const MAX_COMMAND_HISTORY = 50;

/**
 * Builds the localStorage key for per-user, per-page AI prompt history.
 */
export function getCommandHistoryStorageKey(userKey: string, activePage: string): string {
  const safeUser = (userKey || 'anonymous').trim().toLowerCase() || 'anonymous';
  const safePage = (activePage || 'dashboard').trim().toLowerCase() || 'dashboard';
  return `dispatch_ai_cmd_history_v1:${safeUser}:${safePage}`;
}

/**
 * Loads persisted prompt history from localStorage (returns [] safely if unavailable/corrupt).
 */
export function loadPersistedCommandHistory(userKey: string, activePage: string): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(getCommandHistoryStorageKey(userKey, activePage));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Appends a sent prompt to the per-page history (skipping consecutive duplicates and capping length)
 * and persists it to localStorage.
 */
export function appendPersistedCommandHistory(
  prev: string[],
  command: string,
  userKey: string,
  activePage: string
): string[] {
  const trimmed = command.trim();
  if (!trimmed) return prev;
  const next = prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed].slice(-MAX_COMMAND_HISTORY);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(getCommandHistoryStorageKey(userKey, activePage), JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

/**
 * Navigates backwards (ArrowUp) or forwards (ArrowDown) through previously sent
 * prompts while preserving any unsent draft text.
 */
export function navigateCommandHistory(
  history: string[],
  currentIndex: number,
  direction: 'up' | 'down',
  currentInput: string,
  savedDraft: string
): CommandHistoryStep | null {
  if (history.length === 0) return null;

  if (direction === 'up') {
    const nextDraft = currentIndex === -1 ? currentInput : savedDraft;
    const nextIndex = currentIndex === -1 ? history.length - 1 : Math.max(0, currentIndex - 1);
    return {
      nextIndex,
      nextValue: history[nextIndex],
      nextDraft,
    };
  }

  if (currentIndex === -1) return null;

  if (currentIndex >= history.length - 1) {
    return {
      nextIndex: -1,
      nextValue: savedDraft,
      nextDraft: savedDraft,
    };
  }

  const nextIndex = currentIndex + 1;
  return {
    nextIndex,
    nextValue: history[nextIndex],
    nextDraft: savedDraft,
  };
}
