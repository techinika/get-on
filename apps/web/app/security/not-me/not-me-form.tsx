"use client";

import { PendingForm, SubmitButton } from "@/components/auth/pending-form";

export function NotMeForm({ token }: { token: string }) {
  return (
    <PendingForm action="/api/auth/not-me" method="post" className="mt-6">
      <input type="hidden" name="token" value={token} />
      <SubmitButton size="lg" className="w-full" loadingLabel="Securing...">
        Secure my account
      </SubmitButton>
    </PendingForm>
  );
}
