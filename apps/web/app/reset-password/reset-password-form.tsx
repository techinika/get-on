"use client";

import { PasswordInput } from "@/components/auth/password-input";
import { PendingForm, SubmitButton } from "@/components/auth/pending-form";
import { Label } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <PendingForm action="/api/auth/password/reset" method="post" className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">New password</Label>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          required
          helper="At least 10 characters"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Type it again</Label>
        <PasswordInput
          id="confirm-password"
          name="confirm"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <SubmitButton size="lg" className="w-full" loadingLabel="Saving...">
        Save new password
      </SubmitButton>
    </PendingForm>
  );
}
