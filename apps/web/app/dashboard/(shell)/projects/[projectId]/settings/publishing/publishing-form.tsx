"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function PublishingForm({ projectId }: { projectId: string }) {
  const [paused, setPaused] = useState(false);
  const [title, setTitle] = useState("We will be back soon");
  const [text, setText] = useState("This website is being updated. Please check again in a little while.");

  async function onPause() {
    const formData = new FormData();
    formData.set("enabled", paused ? "false" : "true");
    formData.set("title", title);
    formData.set("text", text);
    const { pauseWebsite } = await import("../actions");
    await pauseWebsite(projectId, formData);
    setPaused(!paused);
  }

  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Pause my website</h2>
            <p className="mt-1 text-[14px] text-text-muted">Show a friendly message instead of your website while you make changes. Visitors and search engines are told to come back later.</p>
          </div>
          <Switch checked={paused} onCheckedChange={setPaused} label="Pause my website" />
          {paused ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pause-title">Title</Label>
                <Input id="pause-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pause-text">Message</Label>
                <Textarea id="pause-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
              </div>
              <Button type="button" onClick={onPause}>Save</Button>
            </div>
          ) : null}
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Page not found message</h2>
            <p className="mt-1 text-[14px] text-text-muted">Customize your 404 page.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-title">Title</Label>
            <Input id="nf-title" defaultValue="Page not found" maxLength={60} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-text">Message</Label>
            <Textarea id="nf-text" defaultValue="That page does not exist. It may have been moved or removed." maxLength={200} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-btn">Button label</Label>
            <Input id="nf-btn" defaultValue="Go to the homepage" maxLength={30} />
          </div>
          <Button type="button">Save</Button>
        </div>
      </AppCard>
    </div>
  );
}
