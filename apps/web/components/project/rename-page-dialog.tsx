"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { friendlyError } from "@/lib/errors";
import { PageNameFields } from "@/components/project/page-name-fields";
import type { PageRow } from "@/components/project/types";

export type RenamePageDialogProps = {
  open: boolean;
  page: PageRow | null;
  subdomain: string;
  onClose: () => void;
  /** Optimistic update; resolves with a friendly message on failure, null on success. */
  onRename: (page: PageRow, title: string, path?: string) => Promise<string | null>;
};

export function RenamePageDialog({ open, page, ...rest }: RenamePageDialogProps) {
  if (!open || !page) return null;
  return <RenamePageForm key={page.id} page={page} {...rest} />;
}

function RenamePageForm({
  page,
  subdomain,
  onClose,
  onRename,
}: Omit<RenamePageDialogProps, "open" | "page"> & { page: PageRow }) {
  const [title, setTitle] = React.useState(page.title);
  const [pathEdited, setPathEdited] = React.useState<string | null>(null);
  const [editingPath, setEditingPath] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const path = pathEdited ?? page.path;

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
      const result = await onRename(page, trimmed, pathEdited ?? undefined);
      if (result) {
        setError(result);
        return;
      }
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
      title="Rename page"
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
            form="rename-page-form"
            loading={busy}
            loadingLabel="Saving..."
            disabled={!title.trim()}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="rename-page-form" onSubmit={submit} className="space-y-4">
        <PageNameFields
          idPrefix="rename-page"
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
