"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
  const { toast } = useToast();
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

  const onAccept = () => {
    // Set __Host-gs_consent cookie (12 months, Secure, SameSite=Lax)
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const date = new Date(Date.now() + oneYearMs);
    document.cookie = `__Host-gs_consent=a1; Path=/; expires=${date.toUTCString()}; Secure; SameSite=Lax`;
    localStorage.setItem("gs_consent_v1", "a1");
    // Update gtag consent
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
    notifyConsentChange();
    toast("Analytics enabled");
  };

  const onDecline = () => {
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const date = new Date(Date.now() + oneYearMs);
    document.cookie = `__Host-gs_consent=a0; Path=/; expires=${date.toUTCString()}; Secure; SameSite=Lax`;
    localStorage.setItem("gs_consent_v1", "a0");
    // Update gtag consent
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
      });
      // Remove _ga and _ga_* cookies
      document.cookie =
        "_ga=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax";
      document.cookie =
        "_ga_*=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax";
    }
    notifyConsentChange();
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