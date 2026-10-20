"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleHelp, X } from "lucide-react";
import env from "@/lib/env";
import { Button } from "@/components/ui/button";

type HelpPanelProps = {
  teamName: string;
  planName: string;
  currentPage: string;
};

export function HelpPanel({ teamName, planName, currentPage }: HelpPanelProps) {
  const [open, setOpen] = useState(false);

  const message = encodeURIComponent(
    `Hi Get-On, I need help. Team: ${teamName}. Plan: ${planName}. Page: ${currentPage}.`,
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="help-panel"
      >
        <CircleHelp className="mr-2 h-4 w-4" /> Help
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <aside
        id="help-panel"
        className={`fixed z-50 bg-[var(--color-surface)] border-[var(--color-border)] transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        } inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-96 md:border-l`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-lg font-semibold">Need help?</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close help panel"
            className="rounded-lg p-2 hover:bg-[var(--color-muted)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <Link
            className="block rounded-xl border border-[var(--color-border)] p-4 text-sm hover:bg-[var(--color-muted)]"
            href={`mailto:${env.supportEmail}?subject=Get-On support&body=${message}`}
          >
            Email us
          </Link>
          {env.supportWhatsapp ? (
            <Link
              className="block rounded-xl border border-[var(--color-border)] p-4 text-sm hover:bg-[var(--color-muted)]"
              href={`https://wa.me/${env.supportWhatsapp}?text=${message}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp us
            </Link>
          ) : null}
        </div>
      </aside>
    </>
  );
}
