"use client";

import Link from "next/link";
import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveAnalyticsSettings } from "../actions";

type Initial = {
  visitors?: boolean;
  gaEnabled?: boolean;
  gaId?: string;
  gaConsent?: string;
};

export function AnalyticsForm({ projectId, initial = {} }: { projectId: string; initial?: Initial }) {
  const { toast } = useToast();
  const [visitors, setVisitors] = useState(initial.visitors !== false);
  const [ga, setGa] = useState(initial.gaEnabled === true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    formData.set("visitors", visitors ? "true" : "false");
    formData.set("ga-enabled", ga ? "true" : "false");
    setSaving(true);
    setMessage(null);
    const res = await saveAnalyticsSettings(projectId, formData);
    setSaving(false);
    if (res.ok) {
      setMessage("Saved. Publish your website to show these changes.");
      toast("Saved");
    } else {
      setMessage(res.error);
    }
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Visitors</h2>
            <p className="mt-1 text-[14px] text-text-muted">
              We count visits on your website without cookies. No one&apos;s IP address is stored. Numbers are kept for 90 days.
            </p>
          </div>
          <Switch checked={visitors} onCheckedChange={setVisitors} label="Count visitors" />
          <Link
            href={`/dashboard/projects/${projectId}/visitors`}
            className="text-[15px] font-semibold text-primary hover:underline"
          >
            See your visitor numbers
          </Link>
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Google Analytics</h2>
            <p className="mt-1 text-[14px] text-text-muted">
              If you already use Google Analytics, you can turn it on here. It only loads if someone gives permission, unless you choose to count everyone.
            </p>
          </div>
          <Switch checked={ga} onCheckedChange={setGa} label="Use Google Analytics" />
          {ga ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ga-id">Measurement ID</Label>
                <Input id="ga-id" name="ga-id" placeholder="G-XXXXXXXXXX" defaultValue={initial.gaId || ""} maxLength={40} />
                <p className="text-sm text-text-muted">Looks like G- followed by letters and numbers.</p>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-[15px] font-semibold text-text">When should it load?</legend>
                <label className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <input type="radio" name="ga-consent" value="ask" defaultChecked={initial.gaConsent !== "all"} className="mt-1" />
                  <span>
                    <span className="block text-[15px] font-semibold text-text">Ask for permission first</span>
                    <span className="block text-sm text-text-muted">Recommended. Nothing loads until someone agrees.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <input type="radio" name="ga-consent" value="all" defaultChecked={initial.gaConsent === "all"} className="mt-1" />
                  <span>
                    <span className="block text-[15px] font-semibold text-text">Count everyone</span>
                    <span className="block text-sm text-text-muted">Loads straight away for every visitor.</span>
                  </span>
                </label>
              </fieldset>
            </>
          ) : (
            <input type="hidden" name="ga-consent" value={initial.gaConsent === "all" ? "all" : "ask"} />
          )}
        </div>
      </AppCard>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving} loadingLabel="Saving...">Save</Button>
        {message ? <p className="text-sm text-text-muted" role="status">{message}</p> : null}
      </div>
    </form>
  );
}
