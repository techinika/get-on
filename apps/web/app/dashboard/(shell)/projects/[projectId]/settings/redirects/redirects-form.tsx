"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function RedirectsForm() {
  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-text">Moved pages</h2>
              <p className="mt-1 text-[14px] text-text-muted">Send visitors from old addresses to new ones.</p>
            </div>
            <Button type="button">Add a moved page</Button>
          </div>
          <div className="rounded-xl border border-border p-4 text-[15px] text-text-muted">
            No moved pages yet.
          </div>
        </div>
      </AppCard>
    </div>
  );
}
