"use client";

import * as React from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { relativeTime } from "@/lib/relative-time";
import { purgeProject, restoreProject } from "@/app/dashboard/(shell)/projects/[projectId]/settings/actions";

export type DeletedWebsite = {
  id: string;
  name: string;
  subdomain: string;
  deletedAt: string;
  purgeAfter: string | null;
};

function daysLeft(purgeAfter: string | null): number | null {
  if (!purgeAfter) return null;
  return Math.max(0, Math.ceil((new Date(purgeAfter).getTime() - Date.now()) / 864e5));
}

export function RecentlyDeleted({
  websites,
  canRestore,
  canPurge,
}: {
  websites: DeletedWebsite[];
  canRestore: boolean;
  canPurge: boolean;
}) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [purge, setPurge] = React.useState<DeletedWebsite | null>(null);

  if (websites.length === 0) return null;

  async function restore(id: string) {
    setPendingId(id);
    setError(null);
    setMessage(null);
    const result = await restoreProject(id);
    setPendingId(null);
    if (result.ok) setMessage("Restored. It is back in your websites.");
    else setError(result.error);
  }

  async function removeForGood() {
    if (!purge) return;
    setPendingId(purge.id);
    setError(null);
    const result = await purgeProject(purge.id);
    setPendingId(null);
    setPurge(null);
    if (result.ok) setMessage("The website was removed for good.");
    else setError(result.error);
  }

  return (
    <section id="recently-deleted" className="mt-8 scroll-mt-24" aria-labelledby="recently-deleted-heading">
      <div className="mb-2 flex items-center gap-2">
        <Trash2 size={18} strokeWidth={1.75} aria-hidden className="text-text-muted" />
        <h2 id="recently-deleted-heading" className="text-[17px] font-semibold text-text">
          Recently deleted
        </h2>
      </div>
      <AppCard className="p-0">
        <div className="border-b border-border px-4 py-2">
          <p className="text-[13px] text-text-muted">
            Deleted websites stay here for 14 days. They do not count toward your plan.
          </p>
        </div>
        {message ? <p className="border-b border-border px-4 py-2 text-[14px] text-success-text">{message}</p> : null}
        {error ? <p className="border-b border-border px-4 py-2 text-[14px] text-danger">{error}</p> : null}
        <ul className="divide-y divide-border">
          {websites.map((website) => {
            const left = daysLeft(website.purgeAfter);
            return (
              <li key={website.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-text">{website.name}</p>
                  <p className="text-[13px] text-text-muted">
                    {website.subdomain}.get-on.tech · deleted {relativeTime(website.deletedAt)}
                    {left !== null ? ` · ${left} ${left === 1 ? "day" : "days"} left` : ""}
                  </p>
                </div>
                {canRestore ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => restore(website.id)}
                      disabled={pendingId === website.id}
                    >
                      <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
                      {pendingId === website.id ? "Restoring..." : "Restore"}
                    </Button>
                    {canPurge ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPurge(website)}
                        disabled={pendingId === website.id}
                      >
                        Delete forever
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-[13px] text-text-muted">Ask an owner or admin to restore it.</span>
                )}
              </li>
            );
          })}
        </ul>
      </AppCard>
      <ConfirmDialog
        open={Boolean(purge)}
        title={`Delete ${purge?.name ?? "this website"} for good?`}
        description="This cannot be undone. The web address will be held for 30 days. The history stays in Activity."
        confirmLabel="Delete forever"
        destructive
        loading={Boolean(purge && pendingId === purge.id)}
        onConfirm={removeForGood}
        onClose={() => setPurge(null)}
      />
    </section>
  );
}
