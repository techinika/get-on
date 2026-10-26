import {
  addDays,
  daysBetween,
  isAtOrAfter,
  isBefore,
  maxDate,
  parseDate,
  termStartForRenewal,
} from "./dates";
import type { CoverageSummary, SubscriptionTerm } from "./types";

export function sortTerms(terms: readonly SubscriptionTerm[]): SubscriptionTerm[] {
  return [...terms].sort((a, b) => {
    const byStart = parseDate(a.startsAt).getTime() - parseDate(b.startsAt).getTime();
    if (byStart !== 0) return byStart;
    return parseDate(a.endsAt).getTime() - parseDate(b.endsAt).getTime();
  });
}

export function activeTermAt(
  terms: readonly SubscriptionTerm[],
  now: Date,
): SubscriptionTerm | null {
  const active = terms.filter((term) => {
    if (term.status === "cancelled") return false;
    return (
      isAtOrAfter(now, parseDate(term.startsAt)) &&
      isBefore(now, parseDate(term.endsAt))
    );
  });
  if (active.length === 0) return null;
  return active.sort((a, b) => parseDate(b.startsAt).getTime() - parseDate(a.startsAt).getTime())[0] ?? null;
}

export function coverageSummary(
  terms: readonly SubscriptionTerm[],
  now: Date,
): CoverageSummary {
  const usable = sortTerms(terms.filter((term) => term.status !== "cancelled"));
  const activeTerm = activeTermAt(usable, now);
  const lastEnd = maxDate(usable.map((term) => parseDate(term.endsAt)));
  const gaps: Array<{ startsAt: string; endsAt: string }> = [];

  let coveredUntil: Date | null = null;
  for (const term of usable) {
    const start = parseDate(term.startsAt);
    const end = parseDate(term.endsAt);
    if (coveredUntil && start.getTime() > coveredUntil.getTime()) {
      gaps.push({
        startsAt: coveredUntil.toISOString(),
        endsAt: start.toISOString(),
      });
    }
    if (!coveredUntil || end.getTime() > coveredUntil.getTime()) {
      coveredUntil = end;
    }
  }

  if (lastEnd && isBefore(lastEnd, now)) {
    gaps.push({
      startsAt: lastEnd.toISOString(),
      endsAt: now.toISOString(),
    });
  }

  return {
    activeTerm,
    paidThrough: lastEnd ? lastEnd.toISOString() : null,
    nextStart: lastEnd ? lastEnd.toISOString() : null,
    lastEnd: lastEnd ? lastEnd.toISOString() : null,
    gaps,
  };
}

export function nextTermStart(
  terms: readonly SubscriptionTerm[],
  now: Date,
): Date {
  const lastEnd = maxDate(
    terms
      .filter((term) => term.status !== "cancelled")
      .map((term) => parseDate(term.endsAt)),
  );
  return termStartForRenewal(lastEnd, now);
}

export function termEndDate(term: SubscriptionTerm): Date {
  return parseDate(term.endsAt);
}

export function coverageEndsAt(
  terms: readonly SubscriptionTerm[],
): Date | null {
  return maxDate(
    terms
      .filter((term) => term.status !== "cancelled")
      .map((term) => parseDate(term.endsAt)),
  );
}

/**
 * How many whole days have passed since the last paid term ended. This is the
 * gap shown as debt. It is zero while coverage is active.
 */
export function uncoveredDays(
  terms: readonly SubscriptionTerm[],
  now: Date,
): number {
  const end = coverageEndsAt(terms);
  if (!end || !isBefore(end, now)) return 0;
  return daysBetween(end, now);
}

export function graceEndsAt(
  terms: readonly SubscriptionTerm[],
  graceDays: number,
): Date | null {
  const end = coverageEndsAt(terms);
  if (!end) return null;
  return addDays(end, Math.max(0, graceDays));
}

export function termsOverlap(a: SubscriptionTerm, b: SubscriptionTerm): boolean {
  const aStart = parseDate(a.startsAt).getTime();
  const aEnd = parseDate(a.endsAt).getTime();
  const bStart = parseDate(b.startsAt).getTime();
  const bEnd = parseDate(b.endsAt).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function termProgress(term: SubscriptionTerm, now: Date): number {
  const start = parseDate(term.startsAt).getTime();
  const end = parseDate(term.endsAt).getTime();
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, Math.round(((now.getTime() - start) / (end - start)) * 100)));
}
