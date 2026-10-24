"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function AnalyticsForm() {
  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Visitors</h2>
            <p className="mt-1 text-[14px] text-text-muted">We count visits on your website without cookies. No one&apos;s IP address is stored.</p>
          </div>
          <Switch checked label="Count visitors" />
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Google Analytics</h2>
            <p className="mt-1 text-[14px] text-text-muted">If you already use Google Analytics, you can turn it on here. It only loads if someone gives permission or if you choose to count everyone.</p>
          </div>
          <Switch label="Use Google Analytics" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="ga-id">Measurement ID</Label>
            <Input id="ga-id" placeholder="G-XXXXXXXXXX" />
            <p className="text-sm text-text-muted">Looks like G- followed by letters and numbers.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ga-consent">Consent</Label>
            <select id="ga-consent" className="h-11 rounded-input border-[1.5px] border-border-strong px-3 text-[15px]">
              <option value="ask">Ask for permission first</option>
              <option value="all">Count everyone</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button">Save</Button>
            <Button type="button" variant="secondary">Test</Button>
          </div>
        </div>
      </AppCard>
    </div>
  );
}
