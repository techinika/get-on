"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setReferralStatus } from "./actions";

export function StatusForm({ referralId }: { referralId: string }) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const result = await setReferralStatus(formData);
    setPending(false);
    setMessage(result.ok ? "Updated." : result.error ?? "Please try again.");
  }

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="referral_id" value={referralId} />
      <select name="status" className="h-9 rounded-input border border-border-strong bg-surface px-2 text-[13px] text-text" aria-label="Status">
        <option value="held">Hold</option>
        <option value="published">Release hold</option>
        <option value="rejected">Reject</option>
        <option value="revoked">Revoke</option>
      </select>
      <Input name="reason" placeholder="Reason" className="h-9 max-w-[160px] text-[13px]" />
      <Button size="sm" type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving..." : "Apply"}
      </Button>
      {message ? <span className="text-[12px] text-text-muted">{message}</span> : null}
    </form>
  );
}
