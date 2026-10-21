export type QuickFindItem = {
  id: string;
  title: string;
  detail?: string;
  href: string;
  icon: "website" | "page" | "link";
};

export type QuickFindGroup = {
  label: string;
  items: QuickFindItem[];
};

export const MAX_RESULTS_PER_GROUP = 6;

/** Lower case and remove accents so "cafe" matches "Café". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Score a candidate against the query. Substring matches rank above
 * subsequence matches. Returns null when there is no match at all.
 */
export function matchScore(query: string, candidate: string): number | null {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q) return 0;
  if (!c) return null;

  const direct = c.indexOf(q);
  if (direct !== -1) return 1000 - direct;

  let position = 0;
  for (const char of q) {
    position = c.indexOf(char, position);
    if (position === -1) return null;
    position += 1;
  }
  return 500;
}

/** Rank items by best match of title or detail. */
export function rankItems<T extends QuickFindItem>(query: string, items: T[]): T[] {
  if (!query.trim()) return items.slice(0, MAX_RESULTS_PER_GROUP);
  return items
    .map((item) => {
      const title = matchScore(query, item.title);
      const detail = item.detail ? matchScore(query, item.detail) : null;
      const best = title === null ? detail : detail === null ? title : Math.max(title, detail);
      return { item, best };
    })
    .filter((entry): entry is { item: T; best: number } => entry.best !== null)
    .sort((a, b) => b.best - a.best)
    .slice(0, MAX_RESULTS_PER_GROUP)
    .map((entry) => entry.item);
}
