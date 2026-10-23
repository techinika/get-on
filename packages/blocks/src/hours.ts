import type { DayHours, Hours, Period } from './schemas';

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

function minutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isValidPeriods(periods: Period[]): boolean {
  for (let i = 0; i < periods.length; i += 1) {
    const p = periods[i]!;
    if (minutes(p.to) <= minutes(p.from)) return false;
    const next = periods[i + 1];
    if (next && minutes(next.from) < minutes(p.to)) return false;
  }
  return true;
}

function clock(value: string, format: '12h' | '24h'): string {
  const [hRaw, mRaw] = value.split(':').map(Number);
  const h = hRaw ?? 0;
  const m = mRaw ?? 0;
  if (format === '24h') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDayHours(day: DayHours, format: '12h' | '24h' = '12h'): string {
  if (day === 'closed') return 'Closed';
  if (day === '24h') return 'Open 24 hours';
  if (!Array.isArray(day) || day.length === 0) return 'Closed';
  return day.map((p) => `${clock(p.from, format)} – ${clock(p.to, format)}`).join(', ');
}

function same(a: DayHours, b: DayHours): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Groups identical consecutive days into lines such as "Mon to Fri  9:00 am – 5:00 pm". */
export function formatHours(hours: Hours | undefined, format: '12h' | '24h' = '12h'): string[] {
  if (!hours) return [];
  const rows = DAY_KEYS.map((key) => ({ key, value: hours[key] }));
  if (rows.every((r) => same(r.value, rows[0]!.value))) {
    return [`Every day  ${formatDayHours(rows[0]!.value, format)}`];
  }
  const lines: string[] = [];
  let start = 0;
  for (let i = 1; i <= rows.length; i += 1) {
    if (i < rows.length && same(rows[i]!.value, rows[start]!.value)) continue;
    const label = i - start === 1
      ? DAY_LABELS[rows[start]!.key]
      : `${DAY_LABELS[rows[start]!.key]} to ${DAY_LABELS[rows[i - 1]!.key]}`;
    lines.push(`${label}  ${formatDayHours(rows[start]!.value, format)}`);
    start = i;
  }
  return lines;
}

export function compactHours(hours: Hours | undefined, format: '12h' | '24h' = '12h'): string[] {
  return formatHours(hours, format);
}
