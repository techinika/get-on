"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  approveApprovalAction,
  cancelApprovalAction,
  executeApprovalAction,
  rejectApprovalAction,
  requestChangesAction,
  retryApprovalAction,
  type ApprovalActionResult,
} from "../actions";

type Mode = "approve" | "reject" | "changes";

const COPY: Record<
  Mode,
  { title: string; body: string; label: string; submit: string; variant: "primary" | "danger" | "danger-outline" }
> = {
  approve: {
    title: "Approve this request?",
    body: "The action runs as soon as it is fully approved. Add a short note for the audit trail.",
    label: "Decision note",
    submit: "Approve",
    variant: "primary",
  },
  reject: {
    title: "Reject this request?",
    body: "The request closes and nothing changes. Add a short note so the requester knows why.",
    label: "Reason",
    submit: "Reject",
    variant: "danger",
  },
  changes: {
    title: "Ask for changes?",
    body: "This closes the request. The requester must send a new one with the change.",
    label: "What needs to change?",
    submit: "Request changes",
    variant: "danger-outline",
  },
};

export function ApprovalActions({
  requestId,
  canDecide,
  canCancel,
  canExecute,
  canRetry,
  awaitingSecond,
  requesterOnly,
}: {
  requestId: string;
  canDecide: boolean;
  canCancel: boolean;
  canExecute: boolean;
  canRetry: boolean;
  awaitingSecond: boolean;
  requesterOnly: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");

  async function run(
    key: string,
    work: () => Promise<ApprovalActionResult>,
    message: string,
  ) {
    setBusy(key);
    setError(null);
    const result = await work();
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(result.message ?? message);
    setMode(null);
    setReason("");
    router.refresh();
  }

  const copy = mode ? COPY[mode] : null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canDecide ? (
          <>
            <Button
              type="button"
              loading={busy === "approve"}
              loadingLabel="Approving..."
              onClick={() => {
                setMode("approve");
                setReason("");
                setError(null);
              }}
            >
              {awaitingSecond ? "Give second approval" : "Approve"}
            </Button>
            <Button
              type="button"
              variant="danger-outline"
              onClick={() => {
                setMode("reject");
                setReason("");
                setError(null);
              }}
            >
              Reject
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMode("changes");
                setReason("");
                setError(null);
              }}
            >
              Request changes
            </Button>
          </>
        ) : null}

        {canExecute ? (
          <Button
            type="button"
            loading={busy === "execute"}
            loadingLabel="Running..."
            onClick={() =>
              void run(
                "execute",
                () => executeApprovalAction(requestId),
                "Done.",
              )
            }
          >
            Run now
          </Button>
        ) : null}

        {canRetry ? (
          <Button
            type="button"
            loading={busy === "retry"}
            loadingLabel="Trying again..."
            onClick={() =>
              void run(
                "retry",
                () => retryApprovalAction(requestId),
                "Tried again.",
              )
            }
          >
            Try again
          </Button>
        ) : null}

        {canCancel ? (
          <Button
            type="button"
            variant="secondary"
            loading={busy === "cancel"}
            loadingLabel="Cancelling..."
            onClick={() =>
              void run(
                "cancel",
                () => cancelApprovalAction(requestId),
                "Request cancelled.",
              )
            }
          >
            Cancel request
          </Button>
        ) : null}
      </div>

      {requesterOnly ? (
        <p className="mt-3 text-sm text-text-muted">
          You requested this. Another Super admin must decide.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-danger-text" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        title={copy?.title ?? ""}
        width="form"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={copy?.variant ?? "primary"}
              disabled={reason.trim().length < 10}
              loading={busy === mode}
              loadingLabel="Saving..."
              onClick={() => {
                if (!mode) return;
                const cleaned = reason.trim();
                if (mode === "approve") {
                  void run(
                    "approve",
                    () => approveApprovalAction(requestId, cleaned),
                    "Approved and done.",
                  );
                } else if (mode === "reject") {
                  void run(
                    "reject",
                    () => rejectApprovalAction(requestId, cleaned),
                    "Request rejected.",
                  );
                } else {
                  void run(
                    "changes",
                    () => requestChangesAction(requestId, cleaned),
                    "Changes requested.",
                  );
                }
              }}
            >
              {copy?.submit ?? "Save"}
            </Button>
          </>
        }
      >
        <p className="text-[15px] leading-6 text-text-muted">{copy?.body}</p>
        <label htmlFor="approval-reason" className="mt-4 block text-sm font-semibold text-text">
          {copy?.label}
        </label>
        <Textarea
          id="approval-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 min-h-[110px]"
          minLength={10}
          maxLength={500}
          autoFocus
        />
        <p className="mt-1 text-[13px] text-text-muted">
          {reason.trim().length}/500 · at least 10 characters
        </p>
      </Dialog>
    </div>
  );
}
