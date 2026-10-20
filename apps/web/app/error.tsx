"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Error is logged by Next; nothing extra to do here.
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft">
        <TriangleAlert size={56} strokeWidth={1.75} aria-hidden className="text-accent-text" />
      </span>
      <h1 className="text-h1 mt-6">Something went wrong</h1>
      <p className="mt-2 max-w-[420px] text-base text-text-muted">
        Please try again. If it keeps happening, come back a little later.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
          Try again
        </button>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
          Back to my websites
        </Link>
      </div>
    </main>
  );
}
