"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { readConsent, subscribeConsent, writeConsent } from "@/lib/analytics/consent";

/**
 * Google Analytics consent banner shown on public marketing pages only.
 *
 * Behaviour:
 * - Appear on allowed routes only (checked by parent component)
 * - Does not steal focus on mount
 * - Escape does nothing (no hidden decision)
 * - First Tab stop reaches the banner
 * - Respects reduced motion (fade only)
 * - Mirrors state in __Host-gs_consent / gs_consent cookie, localStorage, and in-memory fallback
 * - Global Privacy Control / Do Not Track => banner hidden, state "off"
 */
export function GaConsentBanner() {
  const decision = React.useSyncExternalStore(
    subscribeConsent,
    readConsent,
    () => null,
  );

  React.useEffect(() => {
    if (decision === "accepted" && window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
  }, [decision]);

  const honorGpc =
    typeof navigator !== "undefined" &&
    Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
  const honorDnt = typeof navigator !== "undefined" && navigator.doNotTrack === "1";

  if (honorGpc || honorDnt || decision !== null) {
    return null;
  }

  const onAccept = () => {
    try {
      writeConsent("accepted");
      if (window.gtag) {
        window.gtag("consent", "update", {
          analytics_storage: "granted",
        });
      }
    } catch {
      // gtag failure must not block closing the banner.
    }
  };

  const onDecline = () => {
    try {
      writeConsent("declined");
      if (window.gtag) {
        window.gtag("consent", "update", {
          analytics_storage: "denied",
        });
      }
    } catch {
      // gtag failure must not block closing the banner.
    }
  };

  const onDismiss = () => {
    writeConsent("declined");
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="ga-consent-title"
      className="fixed bottom-4 left-4 right-4 md:right-auto md:bottom-6 md:left-6 z-50 md:w-[440px]"
      style={{
        transition: "opacity 150ms ease-out",
      }}
    >
      <div
        className="relative w-full bg-surface border border-border rounded-xl p-6 shadow-xl"
        style={{
          animation: "reduced-motion-fade-in 150ms ease-out",
        }}
      >
        <h3 id="ga-consent-title" className="text-[16px] font-semibold text-text mb-3 pr-8">
          Cookies on get-on.tech
        </h3>
        <button
          type="button"
          aria-label="Close cookie notice"
          onClick={onDismiss}
          className="absolute top-3 right-3 rounded-sm p-1.5 hover:bg-surface-muted transition-colors"
        >
          <span className="sr-only">Close</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-muted"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
        <p className="text-[14px] leading-relaxed text-text-muted mb-6">
          We use Google Analytics to count visits and see which pages people read.
          It sets cookies. We do not use it for advertising.
        </p>
        <div className="flex justify-between items-center gap-3 mb-6">
          <a
            href="/cookies"
            className="text-[14px] font-semibold text-primary underline underline-offset-[3px]"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cookie policy
          </a>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onDecline}
            style={{ flex: "1" }}
          >
            No thanks
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onAccept}
            style={{ flex: "1" }}
          >
            Accept analytics
          </Button>
        </div>
      </div>
    </div>
  );
}