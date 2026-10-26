"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { claimReferralReward } from "./actions";

export function ClaimButton({ rewardId }: { rewardId: string }) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function claim() {
    setPending(true);
    setMessage(null);
    setError(null);
    const result = await claimReferralReward(rewardId);
    setPending(false);
    if (result.ok) setMessage(result.message ?? "Claimed.");
    else setError(result.error ?? "Please try again.");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={claim} disabled={pending}>
        {pending ? "Claiming..." : "Claim"}
      </Button>
      {message ? <p className="text-[13px] text-text-muted">{message}</p> : null}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
