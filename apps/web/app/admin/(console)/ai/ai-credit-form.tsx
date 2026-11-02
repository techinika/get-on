"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { grantAiCredits } from "./actions";

const selectClass =
  "h-12 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-base text-text";

export function AiCreditForm({
  teams,
}: {
  teams: Array<{ id: string; name: string }>;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    setError(null);
    const rawExpiry = String(formData.get("expires_at") ?? "");
    if (rawExpiry) {
      const parsed = new Date(rawExpiry);
      if (Number.isFinite(parsed.getTime())) {
        formData.set("expires_at", parsed.toISOString());
      }
    }
    const result = await grantAiCredits(formData);
    setPending(false);
    if (result.ok) {
      formRef.current?.reset();
      setMessage(result.message);
    } else {
      setError(result.error);
    }
  }

  return (
    <form ref={formRef} action={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2">
        <div>
          <Label htmlFor="credit-team">Team</Label>
          <select
            id="credit-team"
            name="team_id"
            required
            className={`mt-1.5 ${selectClass}`}
            defaultValue=""
          >
            <option value="" disabled>
              Choose a team
            </option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="credit-amount">Credits</Label>
          <Input
            id="credit-amount"
            name="credits"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000000}
            step={1}
            required
            placeholder="100"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="credit-expiry" optional>
            Expiry
          </Label>
          <Input
            id="credit-expiry"
            name="expires_at"
            type="datetime-local"
            className="mt-1.5"
          />
          <p className="mt-1.5 text-[13px] text-text-muted">
            No expiry if left empty.
          </p>
        </div>
        <div>
          <Label htmlFor="credit-reason">Reason</Label>
          <Input
            id="credit-reason"
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder="Why these credits are needed"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add credits"}
        </Button>
        {message ? (
          <p role="status" className="text-sm text-success-text">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
