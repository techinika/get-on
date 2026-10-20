"use client";

import { PasswordInput } from "@/components/auth/password-input";
import { PendingForm, SubmitButton } from "@/components/auth/pending-form";
import { Label } from "@/components/ui/input";

export function ResetPasswordForm() {
  return (
    <PendingForm action="/auth/reset-password" method="post" className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-password">Password</Label>
        <PasswordInput
          id="reset-password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          helper="At least 8 characters"
        />
      </div>
      <SubmitButton size="lg" className="w-full" loadingLabel="Saving...">
        Save password
      </SubmitButton>
    </PendingForm>
  );
}
