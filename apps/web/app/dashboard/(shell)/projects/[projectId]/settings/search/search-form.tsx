"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveSearchSettings } from "../actions";

type Initial = {
  title?: string;
  description?: string;
  titleFormat?: string;
  twitterHandle?: string;
  indexing?: boolean;
};

export function SearchForm({
  projectId,
  initial = {},
  siteName,
  siteUrl,
}: {
  projectId: string;
  initial?: Initial;
  siteName: string;
  siteUrl: string;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(initial.indexing !== false);
  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");

  async function onSubmit(formData: FormData) {
    formData.set("indexing", indexing ? "true" : "false");
    setSaving(true);
    setMessage(null);
    const res = await saveSearchSettings(projectId, formData);
    setSaving(false);
    if (res.ok) {
      setMessage("Saved. Publish your website to show these changes.");
      toast("Saved");
    } else {
      setMessage(res.error);
    }
  }

  const previewTitle = title || siteName || "Your website";
  const previewDescription =
    description || "A short description of your business will appear here.";

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Website title and description</h2>
            <p className="mt-1 text-[14px] text-text-muted">How your site appears in search results.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="site-title">Website title</Label>
            <Input
              id="site-title"
              name="site-title"
              maxLength={60}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="site-desc">Website description</Label>
            <Textarea
              id="site-desc"
              name="site-desc"
              maxLength={160}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="title-format">Title format</Label>
            <select
              id="title-format"
              name="title-format"
              defaultValue={initial.titleFormat || "{page} | {site}"}
              className="h-11 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-[15px] text-text"
            >
              <option value="{page} | {site}" className="bg-surface text-text">Page | Site</option>
              <option value="{page} - {site}" className="bg-surface text-text">Page - Site</option>
              <option value="{site}: {page}" className="bg-surface text-text">Site: Page</option>
              <option value="{page}" className="bg-surface text-text">Page only</option>
            </select>
          </div>
          <div className="rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Preview</p>
            <p className="mt-2 truncate text-[12px] text-success">{siteUrl || "your-site.get-on.tech"}</p>
            <p className="truncate text-[17px] font-medium text-primary">{previewTitle}</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] text-text-muted">{previewDescription}</p>
          </div>
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
            <Input id="twitter" name="twitter" placeholder="@yourbusiness" defaultValue={initial.twitterHandle || ""} maxLength={40} />
          </div>
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <Switch
          checked={indexing}
          onCheckedChange={setIndexing}
          label="Let search engines list my website"
          description="Turn this off if you do not want your website to appear in Google."
        />
      </AppCard>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving} loadingLabel="Saving...">Save</Button>
        {message ? <p className="text-sm text-text-muted" role="status">{message}</p> : null}
      </div>
    </form>
  );
}
