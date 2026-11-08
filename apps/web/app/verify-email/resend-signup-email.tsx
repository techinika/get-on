"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function ResendSignupEmail() {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/auth/signup/resend", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (response.ok && data.ok) {
        setStatus("Email sent. Check your inbox.");
        setCooldown(60);
      } else {
        setStatus(data.message ?? "We could not send the email. Please try again.");
      }
    } catch {
      setStatus("We could not send the email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <Button
        type="button"
        variant="secondary"
        onClick={resend}
        disabled={busy || cooldown > 0}
        loading={busy}
        loadingLabel="Sending..."
      >
        {cooldown > 0 ? `Send again in ${cooldown}s` : "Send the email again"}
      </Button>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-text-muted">
        {status ?? "The link works once and expires after a short time."}
      </p>
    </div>
  );
}
