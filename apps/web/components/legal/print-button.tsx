"use client";

import { Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Prints the legal page. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "print:hidden",
      )}
    >
      <Printer size={16} strokeWidth={1.75} aria-hidden />
      Print this page
    </button>
  );
}
