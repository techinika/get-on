"use client";

import { GoogleAuth } from "@/components/auth/google-auth";
import { PasswordInput } from "@/components/auth/password-input";
import { PendingForm, SubmitButton } from "@/components/auth/pending-form";
import { Input, Label } from "@/components/ui/input";

export function SignupForm({ enableGoogleAuth }: { enableGoogleAuth: boolean }) {
  return (
    <>
      <PendingForm action="/auth/sign-up" method="post" className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-name">Full name</Label>
          <Input id="signup-name" name="fullName" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input id="signup-email" type="email" name="email" autoComplete="email" required />
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
      {enableGoogleAuth ? <GoogleAuth /> : null}
    </>
  );
}
