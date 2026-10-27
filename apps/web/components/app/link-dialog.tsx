"use client";

import { useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";

export function LinkDialog({ open, onClose, defaultCampaign }: { open: boolean; onClose: () => void; defaultCampaign?: string }) {
  const [name, setName] = useState("My link");
  const [campaign, setCampaign] = useState(defaultCampaign ?? "");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-scrim flex items-end justify-center sm:items-center p-4">
      <div className="w-full max-w-[480px] rounded-dialog bg-surface p-6 shadow-raised">
        <h2 className="text-h3">Create a tracked link</h2>
        <p className="mt-1 text-text-muted">Every open is counted. No one is identified.</p>
        <label className="mt-4 block text-sm font-semibold text-text">Link name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="mt-1.5 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 py-2.5 text-sm text-text"
        />
        <label className="mt-3 block text-sm font-semibold text-text">Campaign name (optional)</label>
        <input
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          maxLength={40}
          className="mt-1.5 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 py-2.5 text-sm text-text"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full bg-surface-muted px-4 py-2 text-sm font-medium hover:bg-row-hover">Cancel</button>
          <button onClick={() => { /* create call to /api/projects/{id}/links */ }} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-dark">Create link</button>
        </div>
      </div>
    </div>
  );
}
