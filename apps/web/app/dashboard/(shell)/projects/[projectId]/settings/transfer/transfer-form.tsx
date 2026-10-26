"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cancelTransfer, moveProjectToTeam, requestTransfer } from "../actions";

type TeamOption = { id: string; name: string; role: string };
type PendingTransfer = { id: string; email: string; expiresAt: string };

export function TransferForm({
  projectId,
  teams = [],
  pending = null,
}: {
  projectId: string;
  teams?: TeamOption[];
  pending?: PendingTransfer | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onMove(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const res = await moveProjectToTeam(projectId, formData);
    setSaving(false);
    if (res.ok) {
      toast("Website moved");
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage(res.error);
  }

  async function onSend(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const res = await requestTransfer(projectId, formData);
    setSaving(false);
    setMessage(res.ok ? res.message ?? "Transfer request sent." : res.error);
    if (res.ok) router.refresh();
  }

  async function onCancel() {
    if (!pending) return;
    setSaving(true);
    setMessage(null);
    const res = await cancelTransfer(projectId, pending.id);
    setSaving(false);
    setMessage(res.ok ? res.message ?? "Transfer cancelled." : res.error);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <form action={onMove} className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Move to another of my teams</h2>
            <p className="mt-1 text-[14px] text-text-muted">
              Move this website to another team where you are owner or admin.
            </p>
          </div>
          {teams.length === 0 ? (
            <p className="rounded-xl border border-border p-4 text-[15px] text-text-muted">
              You are not in another team yet. Create or join a team first.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="team_id">Team</Label>
                <select
                  id="team_id"
                  name="team_id"
                  className="h-11 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-[15px] text-text"
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id} className="bg-surface text-text">
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="secondary" loading={saving} loadingLabel="Moving...">Move website</Button>
            </>
          )}
        </form>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        {pending ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-[17px] font-semibold text-text">Waiting for an answer</h2>
              <p className="mt-1 text-[14px] text-text-muted">
                We sent the transfer to {pending.email}. The website stays in your team until they accept.
                The link ends on {new Date(pending.expiresAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={onCancel} loading={saving} loadingLabel="Cancelling...">
                Cancel transfer
              </Button>
              {message ? <p className="text-sm text-text-muted" role="status">{message}</p> : null}
            </div>
          </div>
        ) : (
          <form action={onSend} className="flex flex-col gap-4">
            <div>
              <h2 className="text-[17px] font-semibold text-text">Send to someone else</h2>
              <p className="mt-1 text-[14px] text-text-muted">
                We email them a private link. They choose a team they own or manage and accept.
                Their plan must have room for this website. You can cancel while it is waiting.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Their email address</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-message" optional>Add a note</Label>
              <Textarea
                id="transfer-message"
                name="message"
                maxLength={500}
                placeholder="For example: this is the website we talked about."
                className="min-h-[80px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={saving} loadingLabel="Sending...">Send transfer request</Button>
              {message ? <p className="text-sm text-text-muted" role="status">{message}</p> : null}
            </div>
          </form>
        )}
      </AppCard>
    </div>
  );
}
