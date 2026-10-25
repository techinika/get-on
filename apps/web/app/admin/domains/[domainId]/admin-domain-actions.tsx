"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  approveDomainAction,
  recheckDomainAction,
  rejectDomainAction,
  retryHostnameAction,
} from "../actions";

export function AdminDomainActions({
  domainId,
  reviewState,
  hostnames,
}: {
  domainId: string;
  reviewState: string;
  hostnames: { id: string; hostname: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function run(key: string, work: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    setBusy(key);
    setError(null);
    const result = await work();
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "That did not work.");
      return false;
    }
    toast(message);
    router.refresh();
    return true;
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          loading={busy === "recheck"}
          loadingLabel="Checking..."
          onClick={() =>
            void run("recheck", () => recheckDomainAction(domainId), "Domain checked")
          }
        >
          Re-check now
        </Button>
        {hostnames.map((host) => (
          <Button
            key={host.id}
            type="button"
            variant="ghost"
            loading={busy === `host-${host.id}`}
            loadingLabel="Checking..."
            onClick={() =>
              void run(`host-${host.id}`, () => retryHostnameAction(host.id), "Validation retried")
            }
          >
            Retry {host.hostname}
          </Button>
        ))}
        {reviewState !== "approved" ? (
          <Button
            type="button"
            loading={busy === "approve"}
            loadingLabel="Saving..."
            onClick={() =>
              void run("approve", () => approveDomainAction(domainId), "Domain approved")
            }
          >
            Approve
          </Button>
        ) : null}
        {reviewState !== "rejected" ? (
          <Button type="button" variant="danger-outline" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-danger-text" role="alert">{error}</p> : null}

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this domain?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={busy === "reject"}
              loadingLabel="Rejecting..."
              onClick={() =>
                void run(
                  "reject",
                  async () => {
                    const result = await rejectDomainAction(domainId, reason);
                    if (result.ok) setRejectOpen(false);
                    return result;
                  },
                  "Domain rejected",
                )
              }
            >
              Reject domain
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          The claim will be marked as rejected and the website will stop using this domain. Add a short note for the history.
        </p>
        <label htmlFor="reject-reason" className="mt-4 block text-sm font-semibold text-text">Reason</label>
        <Input
          id="reject-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2"
          maxLength={200}
        />
      </Dialog>
    </div>
  );
}
