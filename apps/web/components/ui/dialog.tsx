"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Optional element rendered above the title (e.g. a danger icon circle). */
  icon?: React.ReactNode;
  /** 480 for forms, 440 for confirmations (spec §1.4). */
  width?: "default" | "form";
  className?: string;
};

export function Dialog({ open, onClose, title, children, footer, icon, width = "default", className }: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (nodes.length === 0) return;
      const firstNode = nodes[0]!;
      const lastNode = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "animate-panel-in relative w-full rounded-t-dialog bg-surface p-7 shadow-raised outline-none",
          "sm:w-[min(440px,calc(100vw-32px))] sm:rounded-dialog",
          width === "form" && "sm:w-[min(480px,calc(100vw-32px))]",
          className,
        )}
      >
        {icon ? <div className="mb-4">{icon}</div> : null}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-h3 pt-1">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-muted"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
