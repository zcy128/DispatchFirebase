import { describe, expect, it, vi } from 'vitest';
import { importWithChunkRetry, isChunkLoadError } from './lazyWithRetry';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('lazyWithRetry', () => {
  it('detects dynamic import and chunk load errors across browsers', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://schoolbus.pcytech.ca/assets/TemporaryAssignmentsView-Cv5sJibq.js'
        )
      )
    ).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 12 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Regular runtime failure'))).toBe(false);
  });

  it('triggers a one-time reload on first chunk error and rethrows if it persists after reload', async () => {
    const storage = createMemoryStorage();
    const reload = vi.fn();
    const chunkErr = new TypeError(
      'Failed to fetch dynamically imported module: https://schoolbus.pcytech.ca/assets/TemporaryAssignmentsView-Cv5sJibq.js'
    );

    // First attempt: triggers reload and stays pending
    let settled = false;
    void importWithChunkRetry(() => Promise.reject(chunkErr), 'TemporaryAssignmentsView', storage, reload)
      .then(() => {
        settled = true;
      })
      .catch(() => {
        settled = true;
      });
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    expect(storage.getItem('pcy_chunk_reload_TemporaryAssignmentsView')).toBe('1');

    // Second attempt after reload: rethrows and clears flag
    await expect(
      importWithChunkRetry(() => Promise.reject(chunkErr), 'TemporaryAssignmentsView', storage, reload)
    ).rejects.toThrow('Failed to fetch dynamically imported module');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem('pcy_chunk_reload_TemporaryAssignmentsView')).toBeNull();
  });

  it('clears reload flag when chunk import succeeds', async () => {
    const storage = createMemoryStorage();
    storage.setItem('pcy_chunk_reload_Dashboard', '1');
    const reload = vi.fn();

    const result = await importWithChunkRetry(
      () => Promise.resolve({ default: 'ok' }),
      'Dashboard',
      storage,
      reload
    );

    expect(result).toEqual({ default: 'ok' });
    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem('pcy_chunk_reload_Dashboard')).toBeNull();
  });
});
