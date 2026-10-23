"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppPage } from "@/components/app/app-page";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppPage width="narrow">
      <div className="app-card mx-auto flex max-w-[520px] flex-col items-center p-8 text-center">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger-text"
        >
          <AlertCircle size={24} strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-h3 text-text">Something went wrong</h1>
        <p className="mt-2 text-base text-text-muted">
          We could not load this page. Please try again.
        </p>
        {error.digest ? (
          <p className="mt-1 text-xs text-text-muted">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="md" onClick={() => reset()}>
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text transition-colors hover:bg-surface-muted"
          >
            <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
            Back to my websites
          </Link>
        </div>
      </div>
    </AppPage>
  );
}
