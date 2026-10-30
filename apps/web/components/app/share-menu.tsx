"use client";

import * as React from "react";
import { Copy, QrCode, Mail, MessageCircle } from "lucide-react";

export function ShareMenu({
  url,
}: {
  url: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);

  function copyLink() {
    navigator.clipboard?.writeText(url);
  }

  return (
    <div className="relative inline-block">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-sm font-medium text-text hover:bg-row-hover focus:outline-none focus:ring-2 focus:ring-primary"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Share
        <span aria-hidden className="text-xs">↓</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-info border border-border bg-surface p-1.5 shadow-raised"
        >
          <button
            role="menuitem"
            onClick={() => { copyLink(); setOpen(false); }}
            className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-sm text-text hover:bg-row-hover"
          >
            <Copy size={16} strokeWidth={1.75} aria-hidden />
            Copy link
          </button>
          <a
            role="menuitem"
            href={`https://wa.me/?text=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener"
            className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-sm text-text hover:bg-row-hover"
          >
            <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
            WhatsApp
          </a>
          <a
            role="menuitem"
            href={`mailto:?body=${encodeURIComponent(url)}`}
            className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-sm text-text hover:bg-row-hover"
          >
            <Mail size={16} strokeWidth={1.75} aria-hidden />
            Email
          </a>
          <a
            role="menuitem"
            href="#"
            className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-sm text-text hover:bg-row-hover"
          >
            <QrCode size={16} strokeWidth={1.75} aria-hidden />
            QR code
          </a>
          <div className="mx-1 my-0.5 h-px bg-border" />
          <a
            role="menuitem"
            href={url}
            className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-sm text-text-muted hover:bg-row-hover"
          >
            Plain address
          </a>
        </div>
      )}
    </div>
  );
}
