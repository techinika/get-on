"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { acceptTransfer, declineTransfer } from "./actions";

type TeamOption = {
  id: string;
  name: string;
  role: string;
  canAccept: boolean;
  reason?: string;
};

export function TransferActions({ token, teams }: { token: string; teams: TeamOption[] }) {
  const router = useRouter();
  const eligible = teams.filter((team) => team.canAccept);
  const [teamId, setTeamId] = useState(eligible[0]?.id ?? "");
  const [working, setWorking] = useState<"accept" | "decline" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function accept() {
    if (!teamId) return;
    setWorking("accept");
    setMessage(null);
    const result = await acceptTransfer(token, teamId);
    setWorking(null);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setDone(true);
    setMessage(result.message);
    router.refresh();
  }

  async function decline() {
    setWorking("decline");
    setMessage(null);
    const result = await declineTransfer(token);
    setWorking(null);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setDone(true);
    setMessage(result.message);
    router.refresh();
  }

  if (done) {
    return (
      <div className="mt-6">
        <p className="rounded-card bg-success-soft p-4 text-sm text-success-text" role="status">
          {message}
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-semibold text-on-primary"
        >
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {teams.length === 0 ? (
        <p className="rounded-card border border-border p-4 text-sm text-text-muted">
          You are not an owner or admin of a team yet. Create a team or ask for an admin role,
          then open this link again.
        </p>
      ) : eligible.length === 0 ? (
        <div className="rounded-card border border-border p-4">
          <p className="text-sm text-text-muted">
            None of your teams has room for this website. Delete a website, remove some pages,
            or upgrade a plan, then open this link again.
          </p>
          <Link href="/dashboard/plan" className="mt-3 inline-flex text-sm font-semibold text-primary underline">
            See plans
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="transfer-team">Put the website in</Label>
          <select
            id="transfer-team"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            className="h-11 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-[15px] text-text"
          >
            {eligible.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.role})
              </option>
            ))}
          </select>
          {teams.some((team) => !team.canAccept) ? (
            <ul className="mt-1 space-y-1 text-xs text-text-muted">
              {teams
                .filter((team) => !team.canAccept)
                .map((team) => (
                  <li key={team.id}>
                    {team.name}: {team.reason}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      )}

      {message ? (
        <p className="text-sm text-danger-text" role="alert">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={accept}
          loading={working === "accept"}
          loadingLabel="Accepting..."
          disabled={!teamId || working !== null}
        >
          Accept website
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={decline}
          loading={working === "decline"}
          loadingLabel="Declining..."
          disabled={working !== null}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
