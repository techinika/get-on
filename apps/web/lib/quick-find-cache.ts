import type { QuickFindItem } from "@/lib/quick-find";

/**
 * Quick find data cache (spec §5.9).
 *
 * The quick find dialog fetches its results on first open. The payload is
 * kept in memory for 60 seconds and dropped straight away when a website or
 * a page is created, changed or deleted.
 */

export const QUICK_FIND_TTL_MS = 60_000;

export type QuickFindPayload = {
  websites: QuickFindItem[];
  pages: QuickFindItem[];
  project?: QuickFindItem[];
};

type CacheEntry = {
  expiresAt: number;
  payload: QuickFindPayload;
};

const cache = new Map<string, CacheEntry>();

/** Cache key: the team, and the project when the dialog asks for its pages. */
export function quickFindKey(teamId: string, projectId?: string | null): string {
  return projectId ? `${teamId}:${projectId}` : `${teamId}:`;
}

export function getCachedQuickFind(
  key: string,
  now: number = Date.now(),
): QuickFindPayload | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return entry.payload;
}

export function setCachedQuickFind(
  key: string,
  payload: QuickFindPayload,
  now: number = Date.now(),
): void {
  cache.set(key, { expiresAt: now + QUICK_FIND_TTL_MS, payload });
}

/**
 * Drop the cached results. Called after a website or a page changes so the
 * next open of the dialog shows the new list straight away.
 */
export function invalidateQuickFindCache(teamId?: string | null): void {
  if (!teamId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key === teamId || key.startsWith(`${teamId}:`)) {
      cache.delete(key);
    }
  }
}

/** Test helper: forget everything that is cached. */
export function clearQuickFindCache(): void {
  cache.clear();
}
