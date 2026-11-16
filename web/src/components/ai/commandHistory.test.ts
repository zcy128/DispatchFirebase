import { describe, it, expect, beforeEach } from 'vitest';
import {
  appendPersistedCommandHistory,
  getCommandHistoryStorageKey,
  loadPersistedCommandHistory,
  MAX_COMMAND_HISTORY,
  navigateCommandHistory,
} from './commandHistory';

describe('navigateCommandHistory', () => {
  const history = ['first query', 'second query', 'third query'];

  it('walks backwards with ArrowUp while preserving current draft', () => {
    const step1 = navigateCommandHistory(history, -1, 'up', 'my draft', '');
    expect(step1).toEqual({
      nextIndex: 2,
      nextValue: 'third query',
      nextDraft: 'my draft',
    });

    const step2 = navigateCommandHistory(history, step1!.nextIndex, 'up', step1!.nextValue, step1!.nextDraft);
    expect(step2).toEqual({
      nextIndex: 1,
      nextValue: 'second query',
      nextDraft: 'my draft',
    });

    const step3 = navigateCommandHistory(history, step2!.nextIndex, 'up', step2!.nextValue, step2!.nextDraft);
    expect(step3?.nextIndex).toBe(0);
    expect(step3?.nextValue).toBe('first query');

    // Clamps at oldest entry
    const step4 = navigateCommandHistory(history, 0, 'up', 'first query', 'my draft');
    expect(step4?.nextIndex).toBe(0);
    expect(step4?.nextValue).toBe('first query');
  });

  it('walks forwards with ArrowDown and restores saved draft at the end', () => {
    const step1 = navigateCommandHistory(history, 1, 'down', 'second query', 'my draft');
    expect(step1).toEqual({
      nextIndex: 2,
      nextValue: 'third query',
      nextDraft: 'my draft',
    });

    const step2 = navigateCommandHistory(history, 2, 'down', 'third query', 'my draft');
    expect(step2).toEqual({
      nextIndex: -1,
      nextValue: 'my draft',
      nextDraft: 'my draft',
    });

    expect(navigateCommandHistory(history, -1, 'down', 'my draft', 'my draft')).toBeNull();
  });

  it('returns null when history is empty', () => {
    expect(navigateCommandHistory([], -1, 'up', 'draft', '')).toBeNull();
  });
});

describe('persisted command history', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    };
  });

  it('persists and reloads per-user, per-page history and skips consecutive duplicates', () => {
    let list = loadPersistedCommandHistory('user-1', 'dispatch');
    expect(list).toEqual([]);

    list = appendPersistedCommandHistory(list, 'shift without vehicle', 'user-1', 'dispatch');
    list = appendPersistedCommandHistory(list, 'shift without vehicle', 'user-1', 'dispatch');
    list = appendPersistedCommandHistory(list, 'assign 1002 to CEPEO-021', 'user-1', 'dispatch');

    expect(loadPersistedCommandHistory('user-1', 'dispatch')).toEqual([
      'shift without vehicle',
      'assign 1002 to CEPEO-021',
    ]);
    expect(loadPersistedCommandHistory('user-1', 'routes')).toEqual([]);
    expect(getCommandHistoryStorageKey('User-1', 'Dispatch')).toBe('dispatch_ai_cmd_history_v1:user-1:dispatch');
  });

  it('caps history at MAX_COMMAND_HISTORY entries', () => {
    let list: string[] = [];
    for (let i = 0; i < MAX_COMMAND_HISTORY + 10; i++) {
      list = appendPersistedCommandHistory(list, `cmd-${i}`, 'user-1', 'dispatch');
    }
    expect(list.length).toBe(MAX_COMMAND_HISTORY);
    expect(list[0]).toBe('cmd-10');
  });
});
