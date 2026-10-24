"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function DeleteForm({ projectId }: { projectId: string }) {
  return (
    <AppCard className="max-w-[760px] p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-[17px] font-semibold text-danger-text">Delete this website</h2>
          <p className="mt-1 text-[14px] text-text-muted">This takes your website offline. You can get it back for 14 days.</p>
        </div>
        <ul className="list-disc pl-5 text-[15px] text-text-muted">
          <li>Your website goes offline right away.</li>
          <li>Your pages, pictures, messages and backups are kept for 14 days, then deleted for good.</li>
          <li>The web address is kept for 30 days after that.</li>
        </ul>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Type the web address to confirm</Label>
          <Input id="confirm" />
        </div>
        <label className="flex items-center gap-2 text-[15px] text-text">
          <input type="checkbox" />
          I understand the website will go offline.
        </label>
        <Button type="button" variant="danger" disabled>Delete website</Button>
      </div>
    </AppCard>
  );
}
