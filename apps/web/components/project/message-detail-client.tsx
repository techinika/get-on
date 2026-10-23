"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { MessageDetailView, type MessageItem } from "@/components/project/messages-content";
import {
  deleteMessages,
  updateMessages,
} from "@/app/dashboard/(shell)/projects/[projectId]/plugins/actions";

export function MessageDetailClient({
  projectId,
  projectName,
  initialMessage,
  pageLabel,
  previous,
  next,
}: {
  projectId: string;
  projectName: string;
  initialMessage: MessageItem;
  pageLabel: string;
  previous: MessageItem | null;
  next: MessageItem | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [message, setMessage] = React.useState(initialMessage);
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);

  React.useEffect(() => {
    if (initialMessage.status !== "new") return;
    const timer = window.setTimeout(async () => {
      setMessage((current) => ({ ...current, status: "read" }));
      const result = await updateMessages(projectId, [initialMessage.id], { status: "read" });
      if (!result.ok) toast(friendlyError(result.error), "error");
      router.refresh();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [initialMessage.id, initialMessage.status, projectId, router, toast]);

  async function patch(values: { status?: MessageItem["status"]; replied?: boolean }) {
    setBusy(true);
    const result = await updateMessages(projectId, [message.id], values);
    setBusy(false);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    setMessage((current) => ({ ...current, ...values }));
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await deleteMessages(projectId, [message.id]);
    setBusy(false);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    setConfirm(false);
    toast("Message deleted.", "success");
    router.push(`/dashboard/projects/${projectId}/messages`);
  }

  return (
    <>
      <MessageDetailView
        projectId={projectId}
        projectName={projectName}
        message={message}
        pageLabel={pageLabel}
        busy={busy}
        onPatch={(values) => void patch(values)}
        onDelete={() => setConfirm(true)}
        backHref={`/dashboard/projects/${projectId}/messages`}
        previous={previous}
        next={next}
      />
      <ConfirmDialog
        open={confirm}
        onClose={() => (busy ? undefined : setConfirm(false))}
        title="Delete this message?"
        description="It cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
