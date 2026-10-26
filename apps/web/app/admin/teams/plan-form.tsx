"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setTeamPlan } from "./actions";

export function PlanForm({
  teamId,
  planId,
  plans,
}: {
  teamId: string;
  planId: string;
  plans: Array<{ id: string; name: string }>;
}) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const result = await setTeamPlan(formData);
    setPending(false);
    setMessage(result.ok ? "Plan updated." : result.error ?? "Please try again.");
  }

  return (
    <form action={submit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="team_id" value={teamId} />
      <select
        name="plan_id"
        defaultValue={planId}
        className="h-10 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-sm font-semibold text-text"
        aria-label="Plan"
      >
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>{plan.name}</option>
        ))}
      </select>
      <Input name="note" placeholder="Reason" required minLength={3} className="sm:max-w-[220px]" />
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? "Saving..." : "Change plan"}
      </Button>
      {message ? <span className="text-[13px] text-text-muted">{message}</span> : null}
    </form>
  );
}
