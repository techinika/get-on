"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";

export function BackupsForm() {
  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Your backups</h2>
            <p className="mt-1 text-[14px] text-text-muted">Safe copies of your website you can go back to.</p>
          </div>
          <Button type="button">Back up now</Button>
        </div>
        <div className="mt-4 rounded-xl border border-border p-4 text-[15px] text-text-muted">
          No backups yet.
        </div>
      </AppCard>
    </div>
  );
}
