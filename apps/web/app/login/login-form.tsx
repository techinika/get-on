"use client";

import * as React from "react";
import Link from "next/link";
import { GoogleAuth } from "@/components/auth/google-auth";
import { PasswordInput } from "@/components/auth/password-input";
import { PendingForm, SubmitButton } from "@/components/auth/pending-form";
import { Turnstile } from "@/components/turnstile";
import { Input, Label } from "@/components/ui/input";

export function LoginForm({
  enableGoogleAuth,
  next,
  email,
  showTurnstile,
}: {
  enableGoogleAuth: boolean;
  next?: string;
  email?: string;
  showTurnstile?: boolean;
}) {
  const [token, setToken] = React.useState<string | null>(null);
  const onToken = React.useCallback((value: string | null) => setToken(value), []);

  return (
    <>
      <PendingForm action="/api/auth/login" method="post" className="mt-6 flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" name="email" autoComplete="email" defaultValue={email} required />
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-primary">
            Forgot password?
          </Link>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password">Password</Label>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            required
          />
        </div>
        {showTurnstile ? (
          <>
            <Turnstile onToken={onToken} />
            <input type="hidden" name="cf-turnstile-response" value={token ?? ""} readOnly />
          </>
        ) : null}
        <SubmitButton size="lg" className="w-full" loadingLabel="Logging in...">
          Log in
        </SubmitButton>
      </PendingForm>
      {enableGoogleAuth ? <GoogleAuth /> : null}
    </>
  );
}
