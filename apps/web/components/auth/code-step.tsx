"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/auth/otp-input";

export type CodeStepProps = {
  title: string;
  description: string;
  maskedEmail: string;
  verifyUrl: string;
  resendUrl?: string;
  next: string;
  helpText?: React.ReactNode;
  footer?: React.ReactNode;
};

type VerifyResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  next?: string;
  remaining?: number | null;
};

const COOLDOWN = 60;

export function CodeStep({ title, description, maskedEmail, verifyUrl, resendUrl = "/api/auth/otp/resend", next, helpText, footer }: CodeStepProps) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(COOLDOWN);
  const [resent, setResent] = React.useState(false);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = React.useCallback(
    async (value: string) => {
      if (busy || value.length !== 6) return;
      setBusy(true);
      setInvalid(false);
      setStatus(null);
      try {
        const response = await fetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value }),
        });
        const data = (await response.json()) as VerifyResponse;
        if (!response.ok || data.ok === false) {
          setInvalid(true);
          if (data.code === "OTP_INVALID" && typeof data.remaining === "number") {
            setStatus(`${data.message ?? "That code is not right."} You have ${data.remaining} tries left.`);
          } else {
            setStatus(data.message ?? "That code is not right.");
          }
          setCode("");
          setBusy(false);
          return;
        }
        setStatus("Code accepted.");
        router.replace(data.next && data.next.startsWith("/") ? data.next : next);
        router.refresh();
      } catch {
        setBusy(false);
        setStatus("We could not check the code. Please try again.");
      }
    },
    [busy, next, router, verifyUrl],
  );

  const resend = async () => {
    if (cooldown > 0) return;
    setStatus(null);
    try {
      const response = await fetch(resendUrl, { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (response.ok && data.ok) {
        setResent(true);
        setCooldown(COOLDOWN);
        setTimeout(() => setResent(false), 3000);
      } else {
        setStatus(data.message ?? "We could not send a new code. Please try again.");
      }
    } catch {
      setStatus("We could not send a new code. Please try again.");
    }
  };

  return (
    <div className="mt-6">
      <h1 className="text-[28px] font-semibold leading-tight text-text">{title}</h1>
      <p className="mt-2 text-base text-text-muted">
        {description.replace("{email}", maskedEmail)}
      </p>

      <div className="mt-6">
        <OtpInput value={code} onChange={setCode} onComplete={submit} disabled={busy} invalid={invalid} label="Sign-in code" />
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-text-muted">
        {status ?? (resent ? "Code sent." : "Enter the code from your email.")}
      </p>

      <Button
        size="lg"
        className="mt-4 w-full"
        loading={busy}
        loadingLabel="Checking..."
        onClick={() => submit(code)}
        disabled={code.length !== 6}
      >
        Continue
      </Button>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="text-sm font-semibold text-primary disabled:text-text-muted"
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
        </button>
        <span aria-live="polite" className="sr-only">
          {cooldown > 0 ? `You can ask for a new code in ${cooldown} seconds.` : "You can ask for a new code now."}
        </span>
      </div>

      {helpText ? <div className="mt-6 text-sm text-text-muted">{helpText}</div> : null}
      {footer ? <div className="mt-4 text-sm text-text-muted">{footer}</div> : null}
    </div>
  );
}
