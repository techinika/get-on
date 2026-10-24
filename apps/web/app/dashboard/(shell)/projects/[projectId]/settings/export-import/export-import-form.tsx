"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";

export function ExportImportForm() {
  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Download my website</h2>
            <p className="mt-1 text-[14px] text-text-muted">A single file with your pages, design, settings and pictures.</p>
          </div>
          <Button type="button">Create file</Button>
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Bring back a website file</h2>
            <p className="mt-1 text-[14px] text-text-muted">Use a file made by Get-On to restore this website or add its pages.</p>
          </div>
          <Button type="button" variant="secondary">Choose a file</Button>
        </div>
      </AppCard>
    </div>
  );
}
