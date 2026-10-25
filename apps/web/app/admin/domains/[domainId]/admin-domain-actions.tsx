"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  approveDomainAction,
  deleteProviderHostnameAction,
  pauseDomainAction,
  recheckDomainAction,
  rejectDomainAction,
  resumeDomainAction,
  restorePlanLapseAction,
  retryHostnameAction,
  simulatePlanLapseAction,
} from "../actions";

export function AdminDomainActions({
  domainId,
  reviewState,
  status,
  canSimulate,
  hostnames,
}: {
  domainId: string;
  reviewState: string;
  status: string;
  canSimulate: boolean;
  hostnames: { id: string; hostname: string; providerId: string | null }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteHostId, setDeleteHostId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const deleteHost = hostnames.find((host) => host.id === deleteHostId) ?? null;

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
        {["draft", "awaiting_txt", "unassigned", "removing", "removed", "failed"].includes(status) ? null : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPauseOpen(true)}
          >
            {status === "paused" ? "Resume website" : "Pause website"}
          </Button>
        )}
        {canSimulate && status !== "paused" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPlanOpen(true)}
          >
            {status === "plan_lapsed" ? "Restore plan" : "Simulate plan lapse"}
          </Button>
        ) : null}
        {hostnames.some((host) => host.providerId) ? (
          <Button type="button" variant="danger-outline" onClick={() => setDeleteOpen(true)}>
            Delete provider hostname
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
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title={status === "paused" ? "Resume this website?" : "Pause this website?"}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPauseOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={status === "paused" ? "primary" : "danger"}
              loading={busy === "pause"}
              loadingLabel="Saving..."
              onClick={() =>
                void run(
                  "pause",
                  async () => {
                    const result =
                      status === "paused"
                        ? await resumeDomainAction(domainId)
                        : await pauseDomainAction(domainId);
                    if (result.ok) setPauseOpen(false);
                    return result;
                  },
                  status === "paused" ? "Website resumed" : "Website paused",
                )
              }
            >
              {status === "paused" ? "Resume website" : "Pause website"}
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          {status === "paused"
            ? "Visitors will see the website again as soon as the connection is ready."
            : "Visitors will see a short pause message until you resume the website."}
        </p>
      </Dialog>

      <Dialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title={status === "plan_lapsed" ? "Restore this domain?" : "Simulate a plan lapse?"}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPlanOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={status === "plan_lapsed" ? "primary" : "danger"}
              loading={busy === "plan"}
              loadingLabel="Saving..."
              onClick={() =>
                void run(
                  "plan",
                  async () => {
                    const result =
                      status === "plan_lapsed"
                        ? await restorePlanLapseAction(domainId)
                        : await simulatePlanLapseAction(domainId);
                    if (result.ok) setPlanOpen(false);
                    return result;
                  },
                  status === "plan_lapsed" ? "Domain restored" : "Plan lapse simulated",
                )
              }
            >
              {status === "plan_lapsed" ? "Restore domain" : "Simulate lapse"}
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          {status === "plan_lapsed"
            ? "This restores the addresses that were paused by the simulation."
            : "This pauses the domain the same way a plan lapse does. Use it only to test the paused state."}
        </p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteHostId("");
          setDeleteConfirm("");
        }}
        title="Delete provider hostname?"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteHostId("");
                setDeleteConfirm("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!deleteHost || deleteConfirm.trim() !== deleteHost.hostname}
              loading={busy === "delete-host"}
              loadingLabel="Deleting..."
              onClick={() =>
                void run(
                  "delete-host",
                  async () => {
                    if (!deleteHost) return { ok: false, error: "Choose an address." };
                    const result = await deleteProviderHostnameAction(
                      deleteHost.id,
                      deleteConfirm,
                    );
                    if (result.ok) {
                      setDeleteOpen(false);
                      setDeleteHostId("");
                      setDeleteConfirm("");
                    }
                    return result;
                  },
                  "Provider hostname deleted",
                )
              }
            >
              Delete hostname
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          This removes the hostname from the provider and stops serving it. The customer must add it again to reconnect.
        </p>
        <label htmlFor="delete-host" className="mt-4 block text-sm font-semibold text-text">
          Address
        </label>
        <select
          id="delete-host"
          value={deleteHostId}
          onChange={(event) => {
            setDeleteHostId(event.target.value);
            setDeleteConfirm("");
          }}
          className="mt-2 h-11 w-full rounded-card border border-border bg-surface px-3 text-[15px] text-text"
        >
          <option value="">Choose an address</option>
          {hostnames
            .filter((host) => host.providerId)
            .map((host) => (
              <option key={host.id} value={host.id}>{host.hostname}</option>
            ))}
        </select>
        <label htmlFor="delete-confirm" className="mt-4 block text-sm font-semibold text-text">
          Type {deleteHost?.hostname ?? "the address"} to confirm
        </label>
        <Input
          id="delete-confirm"
          value={deleteConfirm}
          onChange={(event) => setDeleteConfirm(event.target.value)}
          className="mt-2"
          autoComplete="off"
          spellCheck={false}
        />
      </Dialog>

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
