"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveBusinessSettings } from "../actions";

const timezones = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "America/Denver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

type Initial = {
  name?: string;
  tagline?: string;
  timezone?: string;
  themeColor?: string;
  twitterHandle?: string;
  addressParts?: Record<string, string>;
};

export function BusinessForm({ projectId, initial = {} }: { projectId: string; initial?: Initial }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const res = await saveBusinessSettings(projectId, formData);
    setSaving(false);
    if (res.ok) {
      setMessage("Saved. Publish your website to show these changes.");
      toast("Saved");
    } else {
      setMessage(res.error);
    }
  }

  return (
    <AppCard className="max-w-[760px] p-6">
      <form action={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Business name</Label>
          <Input id="name" name="name" placeholder="Your business name" defaultValue={initial.name || ""} maxLength={60} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" name="tagline" placeholder="A short line about what you do" maxLength={120} defaultValue={initial.tagline || ""} />
          <p className="text-sm text-text-muted">Used in search results and when your link is shared.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="timezone">Time zone</Label>
          <select id="timezone" name="timezone" defaultValue={initial.timezone || "UTC"} className="h-11 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-[15px] text-text">
            {timezones.map((tz) => (
              <option key={tz} value={tz} className="bg-surface text-text">{tz}</option>
            ))}
          </select>
          <p className="text-sm text-text-muted">Used for your opening hours and your visitor numbers.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="theme_color">Browser bar colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Choose browser bar colour"
              defaultValue={initial.themeColor || "#1f6feb"}
              onChange={(event) => {
                const input = document.getElementById("theme_color") as HTMLInputElement | null;
                if (input) input.value = event.target.value;
              }}
              className="h-11 w-14 cursor-pointer rounded-input border border-border-strong bg-surface p-1"
            />
            <Input id="theme_color" name="theme_color" placeholder="#1f6feb" defaultValue={initial.themeColor || ""} maxLength={7} />
          </div>
          <p className="text-sm text-text-muted">Tints the bar in some mobile browsers. Leave empty to use the default.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="twitter_handle">X (Twitter) name (optional)</Label>
          <Input id="twitter_handle" name="twitter_handle" placeholder="@yourbusiness" defaultValue={initial.twitterHandle || ""} maxLength={40} />
        </div>
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-[15px] font-semibold text-text">Address details for Google (optional)</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="street">Street</Label>
              <Input id="street" name="street" defaultValue={initial.addressParts?.street || ""} maxLength={120} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={initial.addressParts?.city || ""} maxLength={80} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="region">Region or state</Label>
              <Input id="region" name="region" defaultValue={initial.addressParts?.region || ""} maxLength={80} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="postal">Postal code</Label>
              <Input id="postal" name="postal" defaultValue={initial.addressParts?.postal || ""} maxLength={24} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" placeholder="US" maxLength={2} defaultValue={initial.addressParts?.country || ""} />
            </div>
          </div>
          <p className="mt-2 text-sm text-text-muted">These help Google show your address correctly.</p>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving} loadingLabel="Saving...">Save</Button>
          {message ? <p className="text-sm text-text-muted" role="status">{message}</p> : null}
        </div>
      </form>
    </AppCard>
  );
}
