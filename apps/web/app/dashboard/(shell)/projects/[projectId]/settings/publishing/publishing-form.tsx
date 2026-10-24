"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { pauseWebsite, saveCustom404 } from "../actions";

type Initial = {
  paused?: boolean;
  pauseTitle?: string;
  pauseText?: string;
  notFoundTitle?: string;
  notFoundText?: string;
  notFoundButton?: string;
};

export function PublishingForm({ projectId, initial = {} }: { projectId: string; initial?: Initial }) {
  const { toast } = useToast();
  const [paused, setPaused] = useState(initial.paused === true);
  const [title, setTitle] = useState(initial.pauseTitle || "We will be back soon");
  const [text, setText] = useState(
    initial.pauseText || "This website is being updated. Please check again in a little while.",
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);

  async function savePause(enabled: boolean) {
    const formData = new FormData();
    formData.set("enabled", enabled ? "true" : "false");
    formData.set("title", title);
    formData.set("text", text);
    setSaving(true);
    setPauseMessage(null);
    const res = await pauseWebsite(projectId, formData);
    setSaving(false);
    if (res.ok) {
      setPaused(enabled);
      setConfirmOpen(false);
      setPauseMessage(enabled ? "Your website is paused." : "Your website is live again.");
      toast(enabled ? "Website paused" : "Website resumed");
    } else {
      setPauseMessage(res.error);
    }
    return res.ok;
  }

  function onToggle(next: boolean) {
    if (next) {
      setConfirmOpen(true);
    } else {
      void savePause(false);
    }
  }

  async function onSaveNotFound(formData: FormData) {
    setSaving(true);
    setNotFoundMessage(null);
    const res = await saveCustom404(projectId, formData);
    setSaving(false);
    if (res.ok) {
      setNotFoundMessage("Saved. Publish your website to show these changes.");
      toast("Saved");
    } else {
      setNotFoundMessage(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Pause my website</h2>
            <p className="mt-1 text-[14px] text-text-muted">
              Show a friendly message instead of your website while you make changes. Visitors and search engines are told to come back later.
            </p>
          </div>
          <Switch checked={paused} onCheckedChange={onToggle} label="Pause my website" disabled={saving} />
          {paused ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pause-title">Title</Label>
                <Input id="pause-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pause-text">Message</Label>
                <Textarea id="pause-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={300} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => savePause(true)} loading={saving} loadingLabel="Saving...">Save pause message</Button>
                {pauseMessage ? <p className="text-sm text-text-muted" role="status">{pauseMessage}</p> : null}
              </div>
            </div>
          ) : null}
          {!paused && pauseMessage ? <p className="text-sm text-text-muted" role="status">{pauseMessage}</p> : null}
        </div>
      </AppCard>

      <AppCard className="max-w-[760px] p-6">
        <form action={onSaveNotFound} className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Page not found message</h2>
            <p className="mt-1 text-[14px] text-text-muted">What people see when a page is missing.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-title">Title</Label>
            <Input id="nf-title" name="not_found_title" defaultValue={initial.notFoundTitle} maxLength={60} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-text">Message</Label>
            <Textarea id="nf-text" name="not_found_text" defaultValue={initial.notFoundText} maxLength={200} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-btn">Button label</Label>
            <Input id="nf-btn" name="not_found_button" defaultValue={initial.notFoundButton} maxLength={30} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={saving} loadingLabel="Saving...">Save</Button>
            {notFoundMessage ? <p className="text-sm text-text-muted" role="status">{notFoundMessage}</p> : null}
          </div>
        </form>
      </AppCard>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Pause this website?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => savePause(true)} loading={saving} loadingLabel="Pausing...">
              Pause website
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          Your pages are kept safe. Visitors will see a short message until you turn this off. Search engines are told to come back later.
        </p>
        {pauseMessage && !paused ? <p className="mt-3 text-sm text-danger-text" role="alert">{pauseMessage}</p> : null}
      </Dialog>
    </div>
  );
}
