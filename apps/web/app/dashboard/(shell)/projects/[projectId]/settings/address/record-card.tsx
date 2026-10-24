"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyValue } from "@/components/app/copy-value";

export type RecordStatus = "missing" | "wrong" | "found" | "optional";

export function RecordCard({
  type,
  title,
  name,
  fullName,
  value,
  status = "missing",
  onCheck,
  checking = false,
}: {
  type: "TXT" | "CNAME";
  title: string;
  name: string;
  fullName?: string;
  value: string;
  status?: RecordStatus;
  onCheck?: () => void;
  checking?: boolean;
}) {
  const statusLabel =
    status === "found"
      ? "Found"
      : status === "wrong"
        ? "Wrong value"
        : status === "optional"
          ? "Optional"
          : "Not found yet";
  const statusVariant =
    status === "found"
      ? "live"
      : status === "wrong"
        ? "danger"
        : status === "optional"
          ? "neutral"
          : "draft";

  return (
    <div className="rounded-card border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-lg bg-surface-muted px-2.5 text-xs font-bold text-text">
            {type}
          </span>
          <p className="text-[15px] font-semibold text-text">{title}</p>
        </div>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
      <dl className="mt-4 grid gap-3">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">Name</dt>
          <dd className="mt-1">
            <CopyValue value={name} label="name" />
            {fullName ? (
              <p className="mt-1 text-xs text-text-muted">
                Some providers want the full name: {fullName}
              </p>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">Value</dt>
          <dd className="mt-1">
            <CopyValue value={value} label="value" />
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[13px] text-text-muted">Use Automatic, or 5 minutes if asked.</p>
      {onCheck ? (
        <div className="mt-3">
          <Button type="button" size="sm" variant="ghost" onClick={onCheck} loading={checking} loadingLabel="Checking...">
            Check now
          </Button>
        </div>
      ) : null}
    </div>
  );
}
