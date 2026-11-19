import React, { ComponentType } from 'react';

const RELOAD_PREFIX = 'pcy_chunk_reload_';

/**
 * Returns true when an error indicates a stale or missing dynamically imported JS chunk
 * (typically caused by a new production deployment while an older tab is still open).
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('error loading dynamically imported module') ||
    lower.includes('loading chunk') ||
    lower.includes('chunkloaderror')
  );
}

/**
 * Executes a dynamic import with a one-time automatic page reload when a stale
 * deployment chunk is encountered, preventing ErrorBoundary crashes after releases.
 */
export async function importWithChunkRetry<T>(
  importer: () => Promise<T>,
  chunkKey: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null =
    typeof window !== 'undefined' ? window.sessionStorage : null,
  reloadPage: () => void = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
): Promise<T> {
  const storageKey = `${RELOAD_PREFIX}${chunkKey}`;
  try {
    const mod = await importer();
    try {
      storage?.removeItem(storageKey);
    } catch {
      // Ignore sessionStorage restrictions in private browsing
    }
    return mod;
  } catch (error) {
    if (isChunkLoadError(error)) {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = storage?.getItem(storageKey) === '1';
      } catch {
        alreadyReloaded = true;
      }

      if (!alreadyReloaded) {
        try {
          storage?.setItem(storageKey, '1');
        } catch {
          // Ignore sessionStorage quota errors
        }
        reloadPage();
        // Keep Suspense fallback mounted while the browser reloads
        return new Promise<T>(() => {});
      }

      try {
        storage?.removeItem(storageKey);
      } catch {
        // Ignore sessionStorage errors
      }
    }
    throw error;
  }
}

/**
 * Drop-in replacement for `React.lazy` that recovers from stale hashed chunks after deploys.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  chunkKey: string
): React.LazyExoticComponent<T> {
  return React.lazy(() => importWithChunkRetry(importer, chunkKey));
}
