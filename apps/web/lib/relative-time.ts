/** Short relative time, for example "3 days ago". */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";

  const plural = (count: number, unit: string) =>
    `${count} ${unit}${count === 1 ? "" : "s"} ago`;

  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return plural(days, "day");
  const weeks = Math.round(days / 7);
  if (weeks < 5) return plural(weeks, "week");
  const months = Math.round(days / 30);
  if (months < 12) return plural(months, "month");
  return plural(Math.round(days / 365), "year");
}
