"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveBusinessSettings } from "../actions";

export function BusinessForm({ projectId }: { projectId: string }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const res = await saveBusinessSettings(projectId, formData);
    setSaving(false);
    setMessage(res.ok ? "Saved." : res.error);
  }

  return (
    <AppCard className="max-w-[760px] p-6">
      <form action={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Business name</Label>
          <Input id="name" name="name" placeholder="Your business name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" name="tagline" placeholder="A short line about what you do" maxLength={120} />
          <p className="text-sm text-text-muted">A short line about what you do. Used in search results and when your link is shared.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="timezone">Time zone</Label>
          <Input id="timezone" name="timezone" placeholder="UTC" defaultValue="UTC" />
          <p className="text-sm text-text-muted">Used for your opening hours and your visitor numbers.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="twitter_handle">X (Twitter) name (optional)</Label>
          <Input id="twitter_handle" name="twitter_handle" placeholder="@yourbusiness" />
        </div>
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-[15px] font-semibold text-text">Address details for Google (optional)</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-2">
              <Label htmlFor="street">Street</Label>
              <Input id="street" name="street" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="region">Region or state</Label>
              <Input id="region" name="region" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="postal">Postal code</Label>
              <Input id="postal" name="postal" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" placeholder="US" maxLength={2} />
            </div>
          </div>
          <p className="mt-2 text-sm text-text-muted">These help Google show your address correctly. What you wrote above is what visitors see.</p>
        </details>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>Save</Button>
          {message ? <p className="text-sm text-text-muted">{message}</p> : null}
        </div>
      </form>
    </AppCard>
  );
}
