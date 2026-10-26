/**
 * All billing arithmetic is integer minor units. The only place a float is
 * allowed is parsing a display value or an external provider amount.
 */

export function toCents(value: number | string): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5 + Number.EPSILON);
}

export function applyBps(cents: number, bps: number): number {
  return roundHalfUp((cents * clampBps(bps)) / 10_000);
}

export function clampBps(bps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.min(10_000, Math.max(0, Math.trunc(bps)));
}

export function clampCents(cents: number, min = 0): number {
  if (!Number.isFinite(cents)) return min;
  return Math.max(min, Math.trunc(cents));
}

export function formatMoney(cents: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(cents));
}

export function sameMoney(a: number, b: number, toleranceCents = 0): boolean {
  return Math.abs(Math.round(a) - Math.round(b)) <= toleranceCents;
}

export function percentLabel(bps: number): string {
  const percent = clampBps(bps) / 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
}
