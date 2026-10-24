"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { friendlyError } from "@/lib/errors";

export type PublishHistoryRow = {
  id: string;
  status: string;
  created_at: string;
  live_at: string | null;
  pages_count: number | null;
  error_code: string | null;
  created_by_name?: string | null;
};

const LABELS: Record<string, { label: string; variant: "live" | "neutral" | "draft" | "danger" }> = {
  live: { label: "Live", variant: "live" },
  superseded: { label: "Earlier version", variant: "neutral" },
  offline: { label: "Taken offline", variant: "draft" },
  ready: { label: "Ready", variant: "neutral" },
  failed: { label: "Did not finish", variant: "danger" },
};

export function PublishHistory({
  projectId,
  rows,
  address,
}: {
  projectId: string;
  rows: PublishHistoryRow[];
  address: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [restoreId, setRestoreId] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  async function restore() {
    if (!restoreId) return;
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/publish/${restoreId}/restore`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok || body?.error) {
        toast(friendlyError(body?.error), "error");
        return;
      }
      setRestoreId(null);
      toast("That version is live again.", "success");
      router.refresh();
    } catch {
      toast(friendlyError("NETWORK_ERROR"), "error");
    } finally {
      setRestoring(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="app-card p-6 text-center">
        <p className="text-base text-text-muted">
          You have not published this website yet. When you do, its versions appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="app-card divide-y divide-border px-4">
        {rows.map((row) => {
          const meta = LABELS[row.status] ?? { label: "Version", variant: "neutral" as const };
          const restorable = row.status === "superseded" || row.status === "offline";
          return (
            <li key={row.id} className="flex flex-wrap items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-text">
                    {formatDate(row.live_at ?? row.created_at)}
                  </p>
                  <Badge variant={meta.variant} dot={row.status === "live"}>
                    {meta.label}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-text-muted">
                  {row.status === "failed"
                    ? "Something went wrong. Your previous website stayed online."
                    : [row.pages_count ? `${row.pages_count} page${row.pages_count === 1 ? "" : "s"}` : "Website version", row.created_by_name ? `by ${row.created_by_name}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              </div>
              {restorable ? (
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setRestoreId(row.id)}
                >
                  <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
                  Use this version
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={restoreId !== null}
        onClose={() => (restoring ? undefined : setRestoreId(null))}
        title="Use this version again?"
        description="This replaces what visitors see right now. Your newer versions stay saved, so you can switch back."
        confirmLabel="Use this version"
        loading={restoring}
        onConfirm={() => void restore()}
      />

      <p className="mt-4 break-all text-sm text-text-muted">
        Every version is shown at {address.replace(/^https?:\/\//, "")}.
      </p>
    </>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
