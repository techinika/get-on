"use client";

import * as React from "react";
import Link from "next/link";
import { LifeBuoy, Mail, MessageCircle, X } from "lucide-react";
import env from "@/lib/env";
import type { PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const SUPPORT_TARGETS: Record<PlanId, string> = {
  free: "3 to 5 working days",
  basic: "2 working days",
  pro: "1 working day",
  enterprise: "4 working hours",
};

const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PRIORITY_LABELS: Record<PlanId, string> = {
  free: "Standard",
  basic: "Standard",
  pro: "Priority",
  enterprise: "Highest",
};

export type HelpPanelProps = {
  open: boolean;
  onClose: () => void;
  planId: PlanId;
  teamName: string;
  /** Element to return focus to on close. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function HelpPanel({ open, onClose, planId, teamName, returnFocusRef }: HelpPanelProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = (returnFocusRef?.current ?? document.activeElement) as HTMLElement | null;
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
        (n) => n.offsetParent !== null,
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
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  function prefilledMessage(): string {
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    return `Hi Get-On team,\n\nTeam: ${teamName}\nPlan: ${PLAN_LABELS[planId]}\nPage: ${path}\n\n`;
  }

  const mailHref = `mailto:${env.supportEmail}?subject=${encodeURIComponent("Get-On help")}&body=${encodeURIComponent(prefilledMessage())}`;
  const whatsappHref = env.supportWhatsapp
    ? `https://wa.me/${env.supportWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(prefilledMessage())}`
    : undefined;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Need help?"
        tabIndex={-1}
        className={cn(
          "animate-panel-in absolute inset-y-0 right-0 flex w-[min(400px,100vw)] flex-col bg-surface outline-none",
          "border-l border-border shadow-raised",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <h2 className="font-body text-lg font-bold">Need help?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="flex h-11 w-11 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-h3">Talk to us</h3>
          <p className="mt-2 text-[15px] text-text-muted">
            We usually reply within {SUPPORT_TARGETS[planId]}.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <a
              href={mailHref}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-input bg-primary px-7 font-body font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              <Mail size={20} strokeWidth={1.75} aria-hidden />
              Email us
            </a>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface px-7 font-body font-semibold text-text transition-colors hover:bg-surface-muted"
              >
                <MessageCircle size={20} strokeWidth={1.75} aria-hidden className="text-[#1FA855]" />
                WhatsApp us
              </a>
            ) : null}
          </div>
          <div className="mt-6 rounded-info bg-surface-muted p-4 text-sm text-text">
            Your plan: {PLAN_LABELS[planId]}. Support priority: {PRIORITY_LABELS[planId]}.
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[15px] font-semibold text-text">Want a walkthrough?</p>
            <p className="mt-1 text-sm text-text-muted">
              Book a short demo and we will show you how to get your site live.
            </p>
            <Link
              href="/request-demo"
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface px-5 font-body text-base font-semibold text-text transition-colors hover:bg-surface-muted"
            >
              Request a demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Floating help trigger used in the top bar. */
export function HelpButton({
  onClick,
  className,
  buttonRef,
}: {
  onClick: () => void;
  className?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={onClick}
      aria-label="Help"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-input px-3 font-body text-base font-semibold text-text transition-colors hover:bg-surface-muted",
        className,
      )}
    >
      <LifeBuoy size={20} strokeWidth={1.75} aria-hidden />
      <span className="hidden xs:inline">Help</span>
    </button>
  );
}
