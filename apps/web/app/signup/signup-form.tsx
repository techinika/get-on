"use client";

import { GoogleAuth } from "@/components/auth/google-auth";
import { PasswordInput } from "@/components/auth/password-input";
import { PendingForm, SubmitButton } from "@/components/auth/pending-form";
import { Input, Label } from "@/components/ui/input";

export function SignupForm({
  enableGoogleAuth,
  next,
  email,
}: {
  enableGoogleAuth: boolean;
  next?: string;
  email?: string;
}) {
  return (
    <>
      <PendingForm action="/auth/sign-up" method="post" className="mt-6 flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-name">Full name</Label>
          <Input id="signup-name" name="fullName" autoComplete="name" required />
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
            minLength={8}
            required
            helper="At least 8 characters"
          />
        </div>
        <SubmitButton size="lg" className="w-full" loadingLabel="Creating your account...">
          Create my account
        </SubmitButton>
      </PendingForm>
      <p className="mt-3 text-center text-[13px] leading-[1.5] text-text-muted">
        By creating an account you agree to our{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline underline-offset-[3px]"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline underline-offset-[3px]"
        >
          Privacy Policy
        </a>
        .
      </p>
      {enableGoogleAuth ? <GoogleAuth /> : null}
    </>
  );
}
