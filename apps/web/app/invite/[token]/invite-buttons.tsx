"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { acceptInvitation, declineInvitation } from "./actions";

export function InviteButtons({ token, teamName }: { token: string; teamName: string }) {
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function join() {
    setBusy(true);
    const result = await acceptInvitation(token);
    setBusy(false);
    if (result && !result.ok) toast(result.error, "error");
  }

  async function decline() {
    setBusy(true);
    const result = await declineInvitation(token);
    setBusy(false);
    setConfirm(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("You declined the invitation.", "success");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 min-[420px]:flex-row">
        <Button size="lg" type="button" loading={busy} loadingLabel="Joining..." onClick={join}>
          Join {teamName}
        </Button>
        <Button variant="secondary" size="lg" type="button" disabled={busy} onClick={() => setConfirm(true)}>
          Decline
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Decline this invitation?"
        description="The team will be told you declined. You can ask for a new invitation later."
        confirmLabel="Decline"
        loading={busy}
        onConfirm={decline}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
