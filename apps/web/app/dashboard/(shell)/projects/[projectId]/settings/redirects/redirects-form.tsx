"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { deleteRedirect, saveRedirect } from "../actions";

type Redirect = { id: string; from: string; to: string; code: number };

export function RedirectsForm({ projectId, redirects = [] }: { projectId: string; redirects?: Redirect[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, startRemoving] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const res = await saveRedirect(projectId, formData);
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      toast("Moved page added");
      router.refresh();
    } else {
      setMessage(res.error);
    }
  }

  function onDelete(id: string) {
    startRemoving(async () => {
      const res = await deleteRedirect(projectId, id);
      if (res.ok) {
        toast("Moved page removed");
        router.refresh();
      } else {
        toast(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Moved pages</h2>
            <p className="mt-1 text-[14px] text-text-muted">Send visitors from old addresses to new ones.</p>
          </div>
          <Button type="button" onClick={() => setOpen(true)}>Add a moved page</Button>
        </div>
        {redirects.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border p-4 text-[15px] text-text-muted">
            No moved pages yet.
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {redirects.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0 break-all text-sm text-text">
                  <span className="font-medium">{r.from}</span> → <span className="text-text-muted">{r.to}</span>
                  <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-muted">{r.code}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onDelete(r.id)}
                  loading={removing}
                  loadingLabel="Removing..."
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AppCard>
      {open ? (
        <AppCard className="max-w-[760px] p-6">
          <form action={onSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-text">Add moved page</h2>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="from">Old address (path)</Label>
              <Input id="from" name="from" placeholder="/old-page" maxLength={200} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="to">New address (path or full link)</Label>
              <Input id="to" name="to" placeholder="/new-page" maxLength={500} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={saving} loadingLabel="Adding...">Save</Button>
              {message ? <p className="text-sm text-text-muted" role="status">{message}</p> : null}
            </div>
          </form>
        </AppCard>
      ) : null}
    </div>
  );
}
