"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { deleteProject } from "../actions";

export function DeleteForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const res = await deleteProject(projectId, formData);
    setSaving(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage(res.error);
  }

  return (
    <AppCard className="max-w-[760px] p-6">
      <form action={onSubmit} className="flex flex-col gap-4">
        <div>
          <h2 className="text-[17px] font-semibold text-danger-text">Delete this website</h2>
          <p className="mt-1 text-[14px] text-text-muted">This takes your website offline. You can get it back for 14 days.</p>
        </div>
        <ul className="list-disc pl-5 text-[15px] text-text-muted">
          <li>Your website goes offline right away.</li>
          <li>Your pages, pictures, messages and backups are kept for 14 days, then deleted for good.</li>
          <li>The web address is kept for 30 days after that.</li>
        </ul>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Type the web address to confirm</Label>
          <Input id="confirm" name="confirm" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-[15px] text-text">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I understand the website will go offline.
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="danger" loading={saving} loadingLabel="Deleting..." disabled={!checked || value.length === 0}>Delete website</Button>
          {message ? <p className="text-sm text-text-muted">{message}</p> : null}
        </div>
      </form>
    </AppCard>
  );
}
