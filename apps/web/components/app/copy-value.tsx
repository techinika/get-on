"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function CopyValue({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast("Copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Copy failed");
    }
  }

  return (
    <span className={className ? `inline-flex min-w-0 items-center gap-1 ${className}` : "inline-flex min-w-0 items-center gap-1"}>
      <code className="break-all font-mono text-[13px] text-text">{value}</code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={label ? `Copy ${label}` : "Copy value"}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      </button>
    </span>
  );
}
