"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { friendlyError } from "@/lib/errors";
import { PageNameFields, pathFromTitle } from "@/components/project/page-name-fields";
import type { PageRow } from "@/components/project/types";

export type AddPageDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  subdomain: string;
  onCreated: (page: PageRow) => void;
};

export function AddPageDialog(props: AddPageDialogProps) {
  if (!props.open) return null;
  return <AddPageForm {...props} />;
}

function AddPageForm({ onClose, projectId, subdomain, onCreated }: AddPageDialogProps) {
  const [title, setTitle] = React.useState("");
  const [pathEdited, setPathEdited] = React.useState<string | null>(null);
  const [editingPath, setEditingPath] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const path = pathEdited ?? pathFromTitle(title);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    if (pathEdited && pathEdited.length < 2) {
      setError("Please use letters, numbers and dashes.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pathEdited ? { title: trimmed, path: pathEdited } : { title: trimmed }),
      });
      const body = (await res.json().catch(() => null)) as { page?: PageRow; error?: string } | null;
      if (!res.ok || !body?.page) {
        setError(friendlyError(body?.error));
        return;
      }
      onCreated(body.page);
      onClose();
    } catch {
      setError(friendlyError(undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a page"
      width="form"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="add-page-form"
            loading={busy}
            loadingLabel="Adding..."
            disabled={!title.trim()}
          >
            Add page
          </Button>
        </>
      }
    >
      <form id="add-page-form" onSubmit={submit} className="space-y-4">
        <PageNameFields
          idPrefix="add-page"
          subdomain={subdomain}
          title={title}
          onTitleChange={setTitle}
          path={path}
          editingPath={editingPath}
          onEditPath={() => setEditingPath(true)}
          onPathChange={setPathEdited}
          pathError={error ?? undefined}
        />
      </form>
    </Dialog>
  );
}
