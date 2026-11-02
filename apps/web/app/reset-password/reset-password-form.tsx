"use client";

import { PasswordInput } from "@/components/auth/password-input";
import { PendingForm, SubmitButton } from "@/components/auth/pending-form";
import { Label } from "@/components/ui/input";
import { PASSWORD_ERROR_MESSAGES } from "@/lib/security/messages";

export function ResetPasswordForm({ token, passwordErrors = [] }: { token: string; passwordErrors?: string[] }) {
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
          helper="At least 10 characters, with uppercase, lowercase, a number and a symbol"
        />
      </div>
      {passwordErrors.length > 0 ? (
        <ul role="alert" className="space-y-1 text-sm text-danger-text">
          {passwordErrors.map((code) => (
            <li key={code}>
              {PASSWORD_ERROR_MESSAGES[code as keyof typeof PASSWORD_ERROR_MESSAGES] ??
                "Please choose a stronger password."}
            </li>
          ))}
        </ul>
      ) : null}
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
