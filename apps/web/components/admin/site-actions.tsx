"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldCheck, ShieldX, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  approveSite,
  bringSiteOnline,
  rebuildSite,
  removeReport,
  requestSiteReview,
  takeSiteOffline,
  type AdminActionResult,
} from "@/app/admin/actions";
import type { AdminReport } from "@/lib/admin-data";
import { REPORT_REASON_LABELS } from "@/lib/report";
import { relativeTime } from "@/lib/relative-time";

export function SiteActions({
  siteId,
  address,
  suspended,
  reviewPending,
}: {
  siteId: string;
  address: string;
  suspended: boolean;
  reviewPending: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [offlineOpen, setOfflineOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  async function run(
    key: string,
    action: () => Promise<AdminActionResult>,
    success: string,
  ) {
    setPending(key);
    try {
      const result = await action();
      if (!result.ok) {
        if (result.code === "REASON_REQUIRED") {
          setError("Please give a reason.");
        } else {
          toast(errorMessage(result.code), "error");
        }
        return false;
      }
      toast(success, "success");
      router.refresh();
      return true;
    } catch {
      toast("That did not work. Please try again.", "error");
      return false;
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {suspended ? (
          <Button
            variant="primary"
            size="md"
            type="button"
            loading={pending === "online"}
            onClick={() =>
              void run("online", () => bringSiteOnline(siteId), "The website is live again.")
            }
          >
            <ShieldCheck size={18} strokeWidth={1.75} aria-hidden />
            Bring back online
          </Button>
        ) : (
          <Button
            variant="danger-outline"
            size="md"
            type="button"
            onClick={() => {
              setReason("");
              setError(null);
              setOfflineOpen(true);
            }}
          >
            <WifiOff size={18} strokeWidth={1.75} aria-hidden />
            Take offline
          </Button>
        )}

        {reviewPending ? (
          <Button
            variant="primary"
            size="md"
            type="button"
            loading={pending === "approve"}
            onClick={() =>
              void run("approve", () => approveSite(siteId), "The website was approved and published.")
            }
          >
            <ShieldCheck size={18} strokeWidth={1.75} aria-hidden />
            Approve and publish
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="md"
            type="button"
            loading={pending === "review"}
            onClick={() =>
              void run("review", () => requestSiteReview(siteId), "The website is waiting for review.")
            }
          >
            <ShieldX size={18} strokeWidth={1.75} aria-hidden />
            Ask for a review
          </Button>
        )}

        <Button
          variant="secondary"
          size="md"
          type="button"
          loading={pending === "rebuild"}
          onClick={() =>
            void run("rebuild", () => rebuildSite(siteId), "The website was rebuilt with the latest styles.")
          }
        >
          <RefreshCw size={18} strokeWidth={1.75} aria-hidden />
          Rebuild website
        </Button>

        <a
          href={address}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text transition-colors hover:bg-surface-muted"
        >
          Open website
        </a>
      </div>

      <Dialog
        open={offlineOpen}
        onClose={() => (pending ? undefined : setOfflineOpen(false))}
        title={`Take ${address.replace(/^https?:\/\//, "")} offline?`}
        width="form"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={() => setOfflineOpen(false)}
              disabled={Boolean(pending)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              type="button"
              loading={pending === "offline"}
              onClick={async () => {
                const done = await run(
                  "offline",
                  () => takeSiteOffline(siteId, reason),
                  "The website is offline.",
                );
                if (done) setOfflineOpen(false);
              }}
            >
              Take offline
            </Button>
          </>
        }
      >
        <p className="text-base leading-6 text-text-muted">
          Visitors will see a short message instead of the website. The owner will see the reason
          in their publish window.
        </p>
        <div className="mt-4">
          <Label htmlFor="offline-reason">Reason</Label>
          <div className="mt-1.5">
            <Textarea
              id="offline-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (error) setError(null);
              }}
              maxLength={500}
              error={error ?? undefined}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function ReportList({
  siteId,
  reports,
}: {
  siteId: string;
  reports: AdminReport[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState<string | null>(null);

  if (reports.length === 0) {
    return <p className="text-sm text-text-muted">No reports for this website.</p>;
  }

  async function remove(reportId: string) {
    setPending(reportId);
    const result = await removeReport(siteId, reportId).catch(() => null);
    setPending(null);
    if (!result?.ok) {
      toast("That did not work. Please try again.", "error");
      return;
    }
    toast("The report was marked as handled.", "success");
    router.refresh();
  }

  return (
    <ul className="divide-y divide-border">
      {reports.map((report) => (
        <li key={report.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-text">
              {REPORT_REASON_LABELS[report.reason] ?? report.reason}
            </span>
            <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-xs font-semibold text-text-muted">
              {report.status === "handled" ? "Handled" : "New"}
            </span>
            <span className="text-xs text-text-muted">{relativeTime(report.created_at)}</span>
          </div>
          {report.details ? <p className="text-sm leading-5 text-text">{report.details}</p> : null}
          <p className="text-sm text-text-muted">
            {report.reporter_email ?? "No email given"}
          </p>
          {report.status === "new" ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                loading={pending === report.id}
                onClick={() => void remove(report.id)}
              >
                Remove a report
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function FlagList({
  flags,
}: {
  flags: Array<{
    id: string;
    kind: string;
    reason: string | null;
    created_at: string;
    resolved_at: string | null;
  }>;
}) {
  if (flags.length === 0) {
    return <p className="text-sm text-text-muted">No flags for this website.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {flags.map((flag) => (
        <li key={flag.id} className="flex flex-wrap items-center gap-2 py-3 first:pt-0 last:pb-0">
          <span className="text-[15px] font-semibold capitalize text-text">{flag.kind}</span>
          {flag.resolved_at ? (
            <span className="rounded-pill bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-text">
              Resolved
            </span>
          ) : (
            <span className="rounded-pill bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-text">
              Open
            </span>
          )}
          <span className="w-full text-sm text-text-muted">{flag.reason ?? "No reason given"}</span>
          <span className="text-xs text-text-muted">{relativeTime(flag.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "NO_LIVE_VERSION":
      return "This website has not been published yet.";
    case "PUBLISH_FAILED":
      return "The website could not be published. Please try again.";
    case "HAS_UNPUBLISHED_CHANGES":
      return "This website has unpublished changes. Publish those first, then rebuild.";
    case "NOT_FOUND":
      return "We could not find that website.";
    default:
      return "That did not work. Please try again.";
  }
}
