"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function SearchForm() {
  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Website title and description</h2>
            <p className="mt-1 text-[14px] text-text-muted">How your site appears in search results.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="site-title">Website title</Label>
            <Input id="site-title" name="site-title" maxLength={60} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="site-desc">Website description</Label>
            <Textarea id="site-desc" name="site-desc" maxLength={160} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title-format">Title format</Label>
            <select id="title-format" className="h-11 rounded-input border-[1.5px] border-border-strong px-3 text-[15px]">
              <option value="{page} | {site}">Page | Site</option>
              <option value="{page} - {site}">Page - Site</option>
              <option value="{site}: {page}">Site: Page</option>
              <option value="{page}">Page only</option>
            </select>
            <p className="text-sm text-text-muted">Example: Our menu | The Olive Table</p>
          </div>
          <Button type="button">Save</Button>
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Sharing</h2>
            <p className="mt-1 text-[14px] text-text-muted">Picture and X name when shared.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="twitter">Your X (Twitter) name (optional)</Label>
            <Input id="twitter" placeholder="@yourbusiness" />
          </div>
          <Button type="button">Save</Button>
        </div>
      </AppCard>
    </div>
  );
}
