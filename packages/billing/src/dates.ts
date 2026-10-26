import type { TermMonths } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value: string | Date): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Calendar-month arithmetic with day clamping. 31 January plus one month is
 * 28/29 February, not 3 March.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** The exclusive end of a paid term. */
export function termEnd(start: Date, months: TermMonths | number): Date {
  return addMonthsClamped(start, months);
}

/** The date shown as "paid through" is the last included day. */
export function lastIncludedDay(endExclusive: Date): Date {
  return addDays(endExclusive, -1);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

export function isAtOrBefore(a: Date, b: Date): boolean {
  return a.getTime() <= b.getTime();
}

export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

export function isAtOrAfter(a: Date, b: Date): boolean {
  return a.getTime() >= b.getTime();
}

export function isBetween(value: Date, start: Date, endExclusive: Date | null): boolean {
  return isAtOrAfter(value, start) && (endExclusive === null || isBefore(value, endExclusive));
}

export function maxDate(values: Array<Date | null | undefined>): Date | null {
  const dates = values.filter((value): value is Date => value instanceof Date && isValidDate(value));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export function minDate(values: Array<Date | null | undefined>): Date | null {
  const dates = values.filter((value): value is Date => value instanceof Date && isValidDate(value));
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toIsoDateTime(date: Date): string {
  return date.toISOString();
}

export function startOfUtcDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function endOfUtcDay(date: Date): Date {
  const result = startOfUtcDay(date);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

export function termStartForRenewal(
  lastEndExclusive: Date | null,
  now: Date,
  firstPaymentDate?: Date | null,
): Date {
  if (lastEndExclusive && lastEndExclusive.getTime() > now.getTime()) {
    return new Date(lastEndExclusive.getTime());
  }
  if (firstPaymentDate) return new Date(firstPaymentDate.getTime());
  return new Date(now.getTime());
}

export function daysUntil(date: Date, now: Date): number {
  return Math.max(0, wholeDaysBetween(now, date));
}

export function isExpired(date: Date | null | undefined, now: Date): boolean {
  return Boolean(date && date.getTime() <= now.getTime());
}
