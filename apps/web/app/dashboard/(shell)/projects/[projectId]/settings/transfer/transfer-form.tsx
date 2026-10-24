"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function TransferForm() {
  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Move to another of my teams</h2>
            <p className="mt-1 text-[14px] text-text-muted">Move this website to another team where you are owner or admin.</p>
          </div>
          <Button type="button" variant="secondary">Move website</Button>
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Send to someone else</h2>
            <p className="mt-1 text-[14px] text-text-muted">Send a transfer request by email.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Their email address</Label>
            <Input id="email" type="email" />
          </div>
          <Button type="button">Send transfer request</Button>
        </div>
      </AppCard>
    </div>
  );
}
