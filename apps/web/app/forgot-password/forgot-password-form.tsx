"use client";

import * as React from "react";
import { PendingForm, SubmitButton } from "@/components/auth/pending-form";
import { Turnstile } from "@/components/turnstile";
import { Input, Label } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [token, setToken] = React.useState<string | null>(null);
  const onToken = React.useCallback((value: string | null) => setToken(value), []);

  return (
    <PendingForm action="/api/auth/password/forgot" method="post" className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input id="forgot-email" type="email" name="email" autoComplete="email" required />
      </div>
      <Turnstile onToken={onToken} />
      <input type="hidden" name="cf-turnstile-response" value={token ?? ""} readOnly />
      <SubmitButton size="lg" className="w-full" loadingLabel="Sending...">
        Send reset link
      </SubmitButton>
    </PendingForm>
  );
}
