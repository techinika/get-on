"use client";

import * as React from "react";
import { Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** "Your web address" card (spec §6.5). */
export function AddressCard({ address }: { address: string }) {
  const { toast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      toast("Address copied.", "success");
    } catch {
      toast("We could not copy that. Please copy it by hand.", "error");
    }
  }

  return (
    <div className="app-card p-4">
      <p className="text-label-caps">Your web address</p>
      <p className="mt-2 break-all text-[15px] font-semibold text-primary">{address}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 items-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
        >
          <Copy size={16} strokeWidth={1.75} aria-hidden />
          Copy
        </button>
        <span
          title="Your website is not live yet"
          aria-disabled="true"
          className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-sm font-semibold text-text opacity-50"
        >
          <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
          Open
        </span>
      </div>
    </div>
  );
}
