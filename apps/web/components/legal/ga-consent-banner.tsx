"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { notifyConsentChange, readConsent, subscribeConsent } from "@/lib/analytics/consent";

/**
 * Google Analytics consent banner shown on public marketing pages only.
 *
 * Behaviour:
 * - Appear on allowed routes only (checked by parent component)
 * - Does not steal focus on mount
 * - Escape does nothing (no hidden decision)
 * - First Tab stop reaches the banner
 * - Respects reduced motion (fade only)
 * - Mirrors state in __Host-gs_consent cookie and localStorage gs_consent_v1
 * - Global Privacy Control / Do Not Track => banner hidden, state "off"
 */
export function GaConsentBanner() {
  const decision = React.useSyncExternalStore(
    subscribeConsent,
    readConsent,
    () => null
  );

  // Apply the consent update to gtag if this visitor already accepted
  React.useEffect(() => {
    if (decision === "accepted" && window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
  }, [decision]);

  // Check for Global Privacy Control or Do Not Track
  const honorGpc =
    typeof navigator !== "undefined" &&
    Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
  const honorDnt = typeof navigator !== "undefined" && navigator.doNotTrack === "1";

  // No banner for GPC/DNT visitors, or once a choice has been stored
  if (honorGpc || honorDnt || decision !== null) {
    return null;
  }

  function setConsentCookie(value: "a1" | "a0") {
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const date = new Date(Date.now() + oneYearMs);
    const secure = `; expires=${date.toUTCString()}; Path=/; SameSite=Lax`;
    // __Host- cookies require a secure origin. Fall back to a regular cookie so
    // consent persists (and the banner closes) on localhost / HTTP too.
    document.cookie = `__Host-gs_consent=${value}${secure}${location.protocol === "https:" ? "; Secure" : ""}`;
    if (location.protocol !== "https:") {
      document.cookie = `gs_consent=${value}${secure}`;
    }
    localStorage.setItem("gs_consent_v1", value);
  }

  const onAccept = () => {
    try {
      setConsentCookie("a1");
      if (window.gtag) {
        window.gtag("consent", "update", {
          analytics_storage: "granted",
        });
      }
    } catch {
      // Cookie or gtag failure must not block the consent choice.
    } finally {
      notifyConsentChange();
    }
  };

  const onDecline = () => {
    try {
      setConsentCookie("a0");
      if (window.gtag) {
        window.gtag("consent", "update", {
          analytics_storage: "denied",
        });
      }
    } catch {
      // Cookie or gtag failure must not block the consent choice.
    } finally {
      notifyConsentChange();
    }
  };

  const onDismiss = () => {
    try {
      setConsentCookie("a0");
    } catch {
      // Dismissal must not break the page.
    } finally {
      notifyConsentChange();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="ga-consent-title"
      className="fixed inset-x-0 bottom-0 left-12 right-12 bottom-[12px] min-w-full z-80"
      style={{
        transition: "opacity 150ms ease-out",
      }}
    >
      <div
        className="max-w-full bg-surface border border-border rounded-xl p-6 md:bottom-24 md:left-24 md:w-[440px] shadow-xl"
        style={{
          animation: "reduced-motion-fade-in 150ms ease-out",
        }}
      >
        <h3 id="ga-consent-title" className="text-[16px] font-semibold text-text mb-3">
          Cookies on get-on.tech
        </h3>
        <button
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
            variant="secondary"
            size="md"
            onClick={onDecline}
            style={{ flex: "1" }}
          >
            No thanks
          </Button>
          <Button
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