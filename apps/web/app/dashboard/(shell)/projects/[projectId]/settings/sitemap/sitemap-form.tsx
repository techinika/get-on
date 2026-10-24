"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { InfoBox } from "@/components/app/info-box";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  checkSitemap,
  previewSitemap,
  saveSitemapSettings,
  type SitemapResult,
} from "../actions";

type Initial = {
  gscTag?: string;
  gscFile?: string;
  bing?: string;
  includeImages?: boolean;
};

export function SitemapForm({
  projectId,
  initial = {},
  connectedHost = null,
}: {
  projectId: string;
  initial?: Initial;
  connectedHost?: string | null;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [includeImages, setIncludeImages] = useState(initial.includeImages !== false);
  const [preview, setPreview] = useState<SitemapResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function onSubmit(formData: FormData) {
    formData.set("include-images", includeImages ? "true" : "false");
    setSaving(true);
    setMessage(null);
    const res = await saveSitemapSettings(projectId, formData);
    setSaving(false);
    if (res.ok) {
      setMessage("Saved. Publish your website to show these changes.");
      toast("Saved");
    } else {
      setMessage(res.error);
    }
  }

  async function onPreview() {
    setChecking(true);
    const res = await previewSitemap(projectId);
    setChecking(false);
    setPreview(res);
    setDialogOpen(true);
  }

  async function onCheck() {
    setChecking(true);
    const res = await checkSitemap(projectId);
    setChecking(false);
    setPreview(res);
    setDialogOpen(true);
    if (res.ok) toast("Sitemap looks good");
  }

  return (
    <>
      <form action={onSubmit} className="flex flex-col gap-6">
        {connectedHost ? (
          <InfoBox variant="info" className="max-w-[760px]">
            Your website now uses {connectedHost}. Publish so search engines see the new address.
          </InfoBox>
        ) : null}
        <AppCard className="max-w-[760px] p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-[17px] font-semibold text-text">Your sitemap</h2>
              <p className="mt-1 text-[14px] text-text-muted">
                This is a list of your pages for search engines. We create and update it for you each time you publish.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={onPreview} loading={checking} loadingLabel="Preparing...">
                Preview sitemap
              </Button>
              <Button type="button" variant="secondary" onClick={onCheck} loading={checking} loadingLabel="Checking...">
                Check my sitemap
              </Button>
            </div>
            <Switch
              checked={includeImages}
              onCheckedChange={setIncludeImages}
              label="Include your pictures"
              description="Helps search engines show your pictures in image results."
            />
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
              <Input id="gsc-tag" name="gsc-tag" placeholder="Paste the code from Google" defaultValue={initial.gscTag || ""} maxLength={200} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gsc-file">HTML file name</Label>
              <Input id="gsc-file" name="gsc-file" placeholder="google1234567890abcdef.html" defaultValue={initial.gscFile || ""} maxLength={60} />
            </div>
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
              <Input id="bing" name="bing" placeholder="32 letters or numbers" defaultValue={initial.bing || ""} maxLength={40} />
            </div>
          </div>
        </AppCard>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving} loadingLabel="Saving...">Save</Button>
          {message ? <p className="text-sm text-text-muted" role="status">{message}</p> : null}
        </div>
      </form>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={preview?.ok ? "Sitemap" : "Sitemap check"}
        footer={<Button type="button" onClick={() => setDialogOpen(false)}>Close</Button>}
        width="form"
      >
        {preview?.ok ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] text-text-muted">{preview.message}</p>
            <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-surface-muted p-3 text-xs text-text">
              {preview.xml}
            </pre>
          </div>
        ) : (
          <p className="text-[15px] text-text-muted">
            {preview && !preview.ok ? preview.error : "Nothing to show yet."}
          </p>
        )}
      </Dialog>
    </>
  );
}
