"use client";

import * as React from "react";
import { Link2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Copies the address of a section so it can be shared. */
export function CopySectionLink({ id, className }: { id: string; className?: string }) {
  const { toast } = useToast();

  async function copy() {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied.", "success");
    } catch {
      toast("We could not copy the link.", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy a link to this section"
      className={cn(
        "ml-2 inline-flex h-8 w-8 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:opacity-100",
        "min-[1024px]:absolute min-[1024px]:left-[-36px] min-[1024px]:top-1 min-[1024px]:ml-0 min-[1024px]:opacity-0 min-[1024px]:group-hover:opacity-100",
        className,
      )}
    >
      <Link2 size={18} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
