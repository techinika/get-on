"use client";

import { AppCard } from "@/components/app/card";

export function ActivityList() {
  return (
    <AppCard className="max-w-[760px] p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm text-text-muted">Everything</span>
        <span className="text-sm text-text-muted">Last 30 days</span>
      </div>
      <div className="p-4 text-[15px] text-text-muted">Nothing has happened yet.</div>
    </AppCard>
  );
}
