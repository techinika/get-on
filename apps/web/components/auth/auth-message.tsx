"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function AuthMessage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  if (error) {
    return (
      <div
        role="alert"
        className="mt-6 flex items-start gap-2.5 rounded-input border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-text"
      >
        <AlertCircle size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-danger" />
        <span>{error}</span>
      </div>
    );
  }

  if (message) {
    return (
      <div
        role="status"
        className="mt-6 flex items-start gap-2.5 rounded-input border border-success bg-success-soft px-3.5 py-3 text-sm text-success-text"
      >
        <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-success" />
        <span>{message}</span>
      </div>
    );
  }

  return null;
}
