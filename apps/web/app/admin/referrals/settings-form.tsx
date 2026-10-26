"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { updateReferralSettings } from "./actions";

export function ReferralSettingsForm({
  settings,
}: {
  settings: {
    enabled: boolean;
    qualify_hours: number;
    monthly_cap: number;
    referred_bonus_credits: number;
    velocity_hold_per_day: number;
  };
}) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const result = await updateReferralSettings(formData);
    setPending(false);
    setMessage(result.ok ? "Saved." : result.error ?? "Please try again.");
  }

  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-[14px] text-text sm:col-span-2">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
        Referral programme is on
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qualify_hours">Hours before a friend counts</Label>
        <Input id="qualify_hours" name="qualify_hours" type="number" min={1} max={720} defaultValue={settings.qualify_hours} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="monthly_cap">Friends per month</Label>
        <Input id="monthly_cap" name="monthly_cap" type="number" min={1} max={10000} defaultValue={settings.monthly_cap} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="referred_bonus_credits">Welcome credits</Label>
        <Input id="referred_bonus_credits" name="referred_bonus_credits" type="number" min={0} max={1000} defaultValue={settings.referred_bonus_credits} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="velocity_hold_per_day">Friends per day before a check</Label>
        <Input id="velocity_hold_per_day" name="velocity_hold_per_day" type="number" min={1} max={1000} defaultValue={settings.velocity_hold_per_day} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button size="sm" type="submit" disabled={pending}>{pending ? "Saving..." : "Save settings"}</Button>
        {message ? <span className="text-[13px] text-text-muted">{message}</span> : null}
      </div>
    </form>
  );
}
