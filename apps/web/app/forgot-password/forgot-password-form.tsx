"use client";

import { PendingForm, SubmitButton } from "@/components/auth/pending-form";
import { Input, Label } from "@/components/ui/input";

export function ForgotPasswordForm() {
  return (
    <PendingForm action="/auth/forgot-password" method="post" className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input id="forgot-email" type="email" name="email" autoComplete="email" required />
      </div>
      <SubmitButton size="lg" className="w-full" loadingLabel="Sending...">
        Send reset link
      </SubmitButton>
    </PendingForm>
  );
}
