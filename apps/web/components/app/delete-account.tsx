"use client";

import { Button } from "@/components/ui/button";

/** Delete account section (spec §6.4). Contacting support is the only route. */
export function DeleteAccount() {
  return (
    <div className="max-w-[520px]">
      <p className="text-[15px] text-text-muted">
        To delete your account and everything in it, contact us. We will help you export your data
        first.
      </p>
      <Button
        variant="secondary"
        size="md"
        className="mt-4"
        type="button"
        onClick={() => window.dispatchEvent(new Event("get-on:help"))}
      >
        Contact support
      </Button>
    </div>
  );
}
