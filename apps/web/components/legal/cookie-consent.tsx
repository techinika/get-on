"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Cookie consent banner. There is nothing to ask for yet, because Get-On only
 * uses essential cookies, so this stays switched off.
 *
 * Turn it on with NEXT_PUBLIC_COOKIE_CONSENT=true when analytics or any
 * other non-essential cookie is added. See docs/legal.md.
 */
export function CookieConsent() {
  const enabled = process.env.NEXT_PUBLIC_COOKIE_CONSENT === "true";
  const [dismissed, setDismissed] = React.useState(false);

  if (!enabled || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface p-4 shadow-raised"
    >
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 min-[768px]:flex-row min-[768px]:items-center min-[768px]:justify-between">
        <p className="max-w-[70ch] text-[15px] leading-6 text-text">
          We use cookies to keep the site working. We do not use advertising cookies. Read our{" "}
          <a href="/cookies" className="font-semibold text-primary underline underline-offset-[3px]">
            Cookie Policy
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="md" onClick={() => setDismissed(true)}>
            Essential only
          </Button>
          <Button variant="primary" size="md" onClick={() => setDismissed(true)}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
