"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { PageRow } from "@/components/project/types";

export type DeletePageDialogProps = {
  open: boolean;
  page: PageRow | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeletePageDialog({ open, page, onClose, onConfirm }: DeletePageDialogProps) {
  if (!open || !page) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Delete ${page.title}?`}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Delete page
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-soft"
        >
          <TriangleAlert size={24} strokeWidth={1.75} className="text-danger" />
        </span>
        <p className="text-base text-text-muted">This page will be removed from your website.</p>
      </div>
    </Dialog>
  );
}
