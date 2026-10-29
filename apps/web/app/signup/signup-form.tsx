"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { GoogleAuth } from "@/components/auth/google-auth";
import { PasswordInput } from "@/components/auth/password-input";
import { Turnstile } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type RegisterResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  field?: string;
  passwordErrors?: string[];
  next?: string;
};

const PASSWORD_HINTS: Record<string, string> = {
  TOO_SHORT: "Use at least 10 characters.",
  TOO_LONG: "Use 128 characters or fewer.",
  COMMON: "That password is too common. Choose something unique.",
  CONTAINS_PERSONAL: "Do not use your name or email address in the password.",
  REPEATED: "Avoid repeating the same character many times.",
  SEQUENTIAL: "Avoid sequences like 1234 or abcd.",
  BREACHED: "That password appeared in a data breach. Please choose another.",
};

const EXISTING_CODES = new Set(["AUTH_EMAIL_EXISTS", "AUTH_EMAIL_EXISTS_GOOGLE", "AUTH_EMAIL_EXISTS_UNVERIFIED"]);

export function SignupForm({
  enableGoogleAuth,
  next,
  email,
}: {
  enableGoogleAuth: boolean;
  next?: string;
  email?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<{ tone: "danger" | "info"; text: string; code?: string } | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = React.useState<string[]>([]);
  const [token, setToken] = React.useState<string | null>(null);
  const [marketing, setMarketing] = React.useState(false);
  const [terms, setTerms] = React.useState(false);

  const onToken = React.useCallback((value: string | null) => setToken(value), []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setBanner(null);
    setFieldErrors({});
    setPasswordErrors([]);

    const form = new FormData(event.currentTarget);
    const timezone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
      } catch {
        return "UTC";
      }
    })();

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          termsAccepted: terms,
          marketingOptIn: marketing,
          timezone,
          turnstileToken: token,
          next,
        }),
      });
      const data = (await response.json()) as RegisterResponse;

      if (response.ok && data.ok) {
        router.push(data.next ?? "/verify-email");
        return;
      }

      if (data.code === "AUTH_EMAIL_EXISTS_UNVERIFIED") {
        setBanner({ tone: "info", text: data.message ?? "We sent a new code.", code: data.code });
        router.push("/verify-email");
        return;
      }
      if (data.field === "email" && data.code) {
        setFieldErrors({ email: data.message ?? "That email cannot be used." });
      }
      if (data.field === "password") {
        setPasswordErrors(data.passwordErrors?.length ? data.passwordErrors : ["TOO_SHORT"]);
      }
      if (data.field === "terms") {
        setBanner({ tone: "danger", text: data.message ?? "Please accept the terms to continue." });
      }
      if (!data.field || data.field === "form") {
        setBanner({
          tone: "danger",
          text: data.message ?? "Something went wrong. Please try again.",
          code: data.code,
        });
      }
      setBusy(false);
    } catch {
      setBusy(false);
      setBanner({ tone: "danger", text: "Something went wrong. Please try again." });
    }
  }

  const existing = banner?.code && EXISTING_CODES.has(banner.code);

  return (
    <>
      {banner ? (
        <div
          role="alert"
          className={
            banner.tone === "danger"
              ? "mt-6 flex items-start gap-2.5 rounded-input border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-text"
              : "mt-6 flex items-start gap-2.5 rounded-input border border-border-strong bg-surface-muted px-3.5 py-3 text-sm text-text"
          }
        >
          {banner.tone === "danger" ? (
            <AlertCircle size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-success" />
          )}
          <span>
            {banner.text}
            {existing ? (
              <>
                {" "}
                <Link href="/login" className="font-semibold text-primary underline">
                  Log in
                </Link>
                {" or "}
                <Link href="/forgot-password" className="font-semibold text-primary underline">
                  reset your password
                </Link>
                .
              </>
            ) : null}
          </span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-name">Full name</Label>
          <Input id="signup-name" name="fullName" autoComplete="name" maxLength={80} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            name="email"
            autoComplete="email"
            defaultValue={email}
            readOnly={Boolean(email)}
            required
            error={fieldErrors.email}
          />
          {email ? (
            <p className="text-[13px] text-text-muted">This invitation is for this email address.</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <PasswordInput
            id="signup-password"
            name="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
            helper="At least 10 characters"
          />
          {passwordErrors.length > 0 ? (
            <ul role="alert" className="space-y-1 text-sm text-danger-text">
              {passwordErrors.map((code) => (
                <li key={code}>{PASSWORD_HINTS[code] ?? "Please choose a stronger password."}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <label className="flex items-start gap-2.5 text-sm text-text">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border-strong"
            required
          />
          <span>
            I accept the{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-primary underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-primary underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border-strong"
          />
          <span>Send me tips and product news. You can stop these at any time.</span>
        </label>

        <Turnstile onToken={onToken} />

        <Button type="submit" size="lg" className="w-full" loading={busy} loadingLabel="Creating your account...">
          Create my account
        </Button>
      </form>

      {enableGoogleAuth ? <GoogleAuth /> : null}
    </>
  );
}
