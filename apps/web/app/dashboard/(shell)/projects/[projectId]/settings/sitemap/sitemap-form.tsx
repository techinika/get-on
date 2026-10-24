"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function SitemapForm() {
  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Your sitemap</h2>
            <p className="mt-1 text-[14px] text-text-muted">This is a list of your pages for Google. We create and update it for you each time you publish.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary">Preview sitemap</Button>
            <Button type="button">Check my sitemap</Button>
          </div>
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Google Search Console</h2>
            <p className="mt-1 text-[14px] text-text-muted">Prove it is your website with a tag or file.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gsc-tag">HTML tag content</Label>
            <Input id="gsc-tag" placeholder="Paste the code from Google" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gsc-file">HTML file name</Label>
            <Input id="gsc-file" placeholder="google1234567890abcdef.html" />
          </div>
          <Button type="button">Save</Button>
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Bing Webmaster Tools</h2>
            <p className="mt-1 text-[14px] text-text-muted">msvalidate.01 tag content.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bing">Content</Label>
            <Input id="bing" placeholder="32 hex characters" />
          </div>
          <Button type="button">Save</Button>
        </div>
      </AppCard>
    </div>
  );
}
