import { Check, CircleAlert } from "lucide-react";
import { AppCard } from "@/components/app/card";

export type DesignReportSummary = {
  accuracy: number;
  unmet: Array<{ requirementId?: string; evidence?: string }>;
  unsupported: Array<{ text?: string; nearest?: string }>;
  createdAt: string;
};

function percent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function DesignReportCard({ report }: { report: DesignReportSummary }) {
  const accuracy = percent(Number(report.accuracy ?? 0));
  const unmet = Array.isArray(report.unmet) ? report.unmet : [];
  const unsupported = Array.isArray(report.unsupported) ? report.unsupported : [];

  return (
    <AppCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-text">Last design check</h2>
          <p className="mt-1 text-sm text-text-muted">
            How closely the last AI look matched what you asked for.
          </p>
        </div>
        <span className="rounded-pill bg-surface-muted px-3 py-1 text-sm font-semibold text-text">
          {accuracy}% match
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-pill bg-surface-muted" aria-hidden>
        <div
          className="h-full rounded-pill bg-primary"
          style={{ width: `${accuracy}%` }}
        />
      </div>

      {accuracy === 100 && unsupported.length === 0 ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-text">
          <Check size={17} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-success" />
          Everything you asked for is in place.
        </p>
      ) : null}

      {unmet.length > 0 ? (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-text">
            <CircleAlert size={17} strokeWidth={1.75} aria-hidden className="text-warning-text" />
            {unmet.length === 1
              ? "One thing could not be fully matched"
              : `${unmet.length} things could not be fully matched`}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Try a more specific request, or change the look by hand.
          </p>
        </div>
      ) : null}

      {unsupported.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-sm font-semibold text-text">Not available yet</p>
          <ul className="mt-1 flex flex-col gap-1">
            {unsupported.slice(0, 4).map((item, index) => (
              <li key={`${item.text ?? "unsupported"}-${index}`} className="text-sm text-text-muted">
                {item.text ?? "That request"}
                {item.nearest ? ` Try: ${item.nearest}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppCard>
  );
}
