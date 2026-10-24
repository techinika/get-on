"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { createBackup } from "../actions";

type Backup = {
  id: string;
  kind: string;
  label: string | null;
  status: string;
  pageCount: number | null;
  picturesIncluded: boolean | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  auto: "Automatic",
  manual: "Manual",
  safety: "Before a big change",
};

export function BackupsForm({ projectId, backups = [] }: { projectId: string; backups?: Backup[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onBackup() {
    setSaving(true);
    setMessage(null);
    const res = await createBackup(projectId);
    setSaving(false);
    setMessage(
      res.ok
        ? "Backup made."
        : res.error,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Your backups</h2>
            <p className="mt-1 text-[14px] text-text-muted">Safe copies of your website you can go back to.</p>
          </div>
          <Button type="button" onClick={onBackup} loading={saving} loadingLabel="Starting...">Back up now</Button>
        </div>
        {backups.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border p-4 text-[15px] text-text-muted">
            No backups yet. Backups are not switched on for this website yet.
          </div>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border">
            {backups.map((backup) => (
              <li key={backup.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="text-[15px] font-semibold text-text">
                    {backup.label || KIND_LABEL[backup.kind] || "Backup"}
                  </p>
                  <p className="text-sm text-text-muted">
                    {new Date(backup.createdAt).toLocaleString()}
                    {backup.pageCount !== null ? ` - ${backup.pageCount} page${backup.pageCount === 1 ? "" : "s"}` : ""}
                    {backup.picturesIncluded ? " - pictures included" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-muted">
                  {backup.status === "ready" ? "Ready" : backup.status === "building" ? "Being made" : "Could not be made"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {message ? <p className="mt-4 text-sm text-text-muted" role="status">{message}</p> : null}
      </AppCard>
    </div>
  );
}
