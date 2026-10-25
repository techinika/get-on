"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { attachDomainAction } from "./actions";

export function AttachDomainButton({
  domainId,
  domainName,
  websites,
}: {
  domainId: string;
  domainName: string;
  websites: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attach() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const result = await attachDomainAction(domainId, target);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast(`${domainName} is now used by a website`);
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Use it
      </Button>
      <Dialog
        open={open}
        onClose={() => { setOpen(false); setTarget(""); setError(null); }}
        title={`Use ${domainName}?`}
        width="form"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setTarget(""); setError(null); }}>Cancel</Button>
            <Button type="button" onClick={attach} disabled={!target} loading={busy} loadingLabel="Saving...">
              Use this website
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          Choose the website this domain should open. You can change this later.
        </p>
        {error ? <p className="mt-3 text-sm text-danger-text" role="alert">{error}</p> : null}
        <label htmlFor="attach-website" className="mt-4 block text-sm font-semibold text-text">
          Website
        </label>
        <select
          id="attach-website"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="mt-2 h-11 w-full rounded-card border border-border bg-surface px-3 text-[15px] text-text"
        >
          <option value="">Choose a website</option>
          {websites.map((website) => (
            <option key={website.id} value={website.id}>{website.name}</option>
          ))}
        </select>
      </Dialog>
    </>
  );
}
