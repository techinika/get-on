"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Enrollment = {
  factorId: string;
  secret: string;
  svg: string;
};

export function MfaSetupForm() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Get-On staff",
      });
      if (cancelled) return;
      if (enrollError || !data) {
        setError("We could not start setup. Refresh the page and try again.");
        return;
      }
      setEnrollment({
        factorId: data.id,
        secret: data.totp.secret,
        svg: data.totp.qr_code,
      });
    }
    start();
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollment.factorId,
    });
    if (challengeError || !challenge) {
      setError("We could not check the code. Try again.");
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That code did not work. Check the time on your phone and try the new code.");
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  if (error && !enrollment) {
    return <p className="mt-6 text-sm text-danger-text">{error}</p>;
  }

  if (!enrollment) {
    return <p className="mt-6 text-sm text-text-muted">Preparing your code…</p>;
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={verify}>
      <div
        className="w-48 rounded-xl border border-border bg-surface p-3"
        dangerouslySetInnerHTML={{ __html: enrollment.svg }}
      />
      <div>
        <label htmlFor="mfa-code" className="text-sm font-medium text-text">Six-digit code</label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123 456"
          maxLength={7}
        />
      </div>
      <p className="text-xs text-text-muted">
        Can&apos;t scan? Add this secret by hand: <code>{enrollment.secret}</code>
      </p>
      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
      <Button type="submit" disabled={busy || code.replace(/\s/g, "").length < 6}>
        {busy ? "Checking…" : "Turn on two-step sign-in"}
      </Button>
    </form>
  );
}
