"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeTotpCode } from "@/lib/auth/mfa";
import { completeMfaSignIn } from "@/lib/auth/mfa-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function findTotpFactor() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return null;
  return data.totp.find((factor) => factor.status === "verified") ?? null;
}

export function MfaChallengeForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    if (finishing.current) return;
    finishing.current = true;
    const supabase = createClient();
    supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(async ({ data }) => {
        if (data?.currentLevel !== "aal2") return;
        const done = await completeMfaSignIn(next);
        if (done.ok) {
          router.replace(done.next?.startsWith("/") ? done.next : next);
          router.refresh();
        }
      })
      .catch(() => {
        // The form still works if this check fails.
      });
  }, [next, router]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const factor = await findTotpFactor();
    if (!factor) {
      setError("We could not find your authenticator. Sign in again to retry.");
      setBusy(false);
      return;
    }

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (challengeError || !challenge) {
      setError("We could not check the code. Try again.");
      setBusy(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: normalizeTotpCode(code),
    });
    if (verifyError) {
      setError("That code did not work. Check the time on your phone and try the new code.");
      setBusy(false);
      return;
    }

    const done = await completeMfaSignIn(next);
    if (!done.ok) {
      setError("Your code was accepted, but we could not finish signing you in. Enter a new code.");
      setBusy(false);
      return;
    }

    router.replace(done.next?.startsWith("/") ? done.next : next);
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={verify}>
      <div>
        <label htmlFor="mfa-code" className="text-sm font-medium text-text">
          Six-digit code
        </label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
          placeholder="123456"
          maxLength={6}
          autoFocus
        />
      </div>
      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
      <Button type="submit" disabled={busy || normalizeTotpCode(code).length < 6}>
        {busy ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
