"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeTotpCode, totpQrSource } from "@/lib/auth/mfa";
import { completeMfaSignIn } from "@/lib/auth/mfa-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Enrollment = {
  factorId: string;
  secret: string;
  svg: string;
};

type PrepareResult =
  | { ok: true; enrollment: Enrollment }
  | { ok: false; message: string };

let pendingEnrollment: Promise<PrepareResult> | null = null;

async function prepareEnrollment(friendlyName: string): Promise<PrepareResult> {
  const supabase = createClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || !factors) {
    return {
      ok: false,
      message: "We could not check your sign-in settings. Refresh and try again.",
    };
  }

  const totp = factors.all.filter((factor) => factor.factor_type === "totp");
  if (totp.some((factor) => factor.status === "verified")) {
    return {
      ok: false,
      message: "This account already has an authenticator. Refresh to enter a code.",
    };
  }

  for (const factor of totp) {
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (removeError) {
      return {
        ok: false,
        message: "We could not clear an unfinished setup. Refresh the page and try again.",
      };
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error || !data) {
    return {
      ok: false,
      message:
        "We could not start setup. Refresh the page and try again. If it keeps failing, sign out and back in.",
    };
  }

  return {
    ok: true,
    enrollment: {
      factorId: data.id,
      secret: data.totp.secret,
      svg: data.totp.qr_code,
    },
  };
}

async function finishSignIn(next: string): Promise<{ ok: boolean; next?: string }> {
  return completeMfaSignIn(next);
}

export function MfaSetupForm({ next }: { next: string }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    pendingEnrollment ??= prepareEnrollment("Get-On account").finally(() => {
      pendingEnrollment = null;
    });
    pendingEnrollment.then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setEnrollment(result.enrollment);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function restart() {
    const current = enrollment;
    setEnrollment(null);
    setCode("");
    setError(null);
    if (current) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: current.factorId });
    }
    setAttempt((value) => value + 1);
  }

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
      code: normalizeTotpCode(code),
    });
    if (verifyError) {
      setError("That code did not work. Check the time on your phone and try the new code.");
      setBusy(false);
      return;
    }
    const done = await finishSignIn(next);
    if (!done.ok) {
      setError("Your code was accepted, but we could not finish signing you in. Enter a new code.");
      setBusy(false);
      return;
    }
    router.replace(done.next?.startsWith("/") ? done.next : next);
    router.refresh();
  }

  if (error && !enrollment) {
    return (
      <div className="mt-6 space-y-3">
        <p className="text-sm text-danger-text">{error}</p>
        <Button type="button" variant="secondary" onClick={restart}>
          Try setup again
        </Button>
      </div>
    );
  }

  if (!enrollment) {
    return <p className="mt-6 text-sm text-text-muted">Preparing your code…</p>;
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={verify}>
      <div className="mx-auto aspect-square w-full max-w-56 overflow-hidden rounded-xl border border-border bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={totpQrSource(enrollment.svg)}
          alt="QR code for your authenticator app"
          className="block h-full w-full"
        />
      </div>
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
        />
      </div>
      <p className="break-all text-xs text-text-muted">
        Can&apos;t scan? Add this secret by hand:{" "}
        <code className="font-mono">{enrollment.secret}</code>
      </p>
      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || normalizeTotpCode(code).length < 6}>
          {busy ? "Checking…" : "Turn on two-step sign-in"}
        </Button>
        <Button type="button" variant="ghost" onClick={restart} disabled={busy}>
          Show a new code
        </Button>
      </div>
    </form>
  );
}
