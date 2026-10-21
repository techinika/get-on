"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirmation dialog used for deletes and destructive actions (spec §5.11). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
            loading={loading}
            loadingLabel="Working..."
            type="button"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? (
        <p className="text-base leading-6 text-text-muted">{description}</p>
      ) : null}
    </Dialog>
  );
}
