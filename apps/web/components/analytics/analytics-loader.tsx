"use client";

import { useEffect, useState } from "react";
import { isAnalyticsRoute } from "@/lib/analytics/routes";

/**
 * AnalyticsLoader - loads Google Analytics only on allowed routes after consent.
 *
 * Behaviour:
 * - Only renders on allowed routes (isAnalyticsRoute check)
 * - On mount, reads consent state from __Host-gs_consent cookie / localStorage
 * - If no consent: defines dataLayer and gtag with all signals denied,
 *   loads Google script only after visitor accepts
 * - On accept: updates gtag consent, sends page view with sanitized location
 * - On decline: sets analytics_storage=denied, clears _ga/_ga_* cookies
 * - Never sends private data (emails, tokens, personal identifiers) to Google
 */
export function AnalyticsLoader() {
  const [consentGiven, setConsentGiven] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // On mount, read consent state
  useEffect(() => {
    setHasMounted(true);

    // Check __Host-gs_consent cookie
    function readCookie(name: string): string {
      if (typeof document === "undefined") return "";
      const match = document.cookie.match(
        new RegExp("(^|;)\\s*" + name + "=\\s*([^;]+)")
      );
      return match ? match[2] : "";
    }

    const cookieValue = readCookie("__Host-gs_consent");
    const lsValue = typeof localStorage !== "undefined" ? localStorage.getItem("gs_consent_v1") : null;

    if (cookieValue === "a1" || lsValue === "a1") {
      setConsentGiven(true);
    } else if (cookieValue === "a0" || lsValue === "a0") {
      setConsentGiven(false);
    } else {
      // No prior consent: define dataLayer and gtag with all denied,
      // then load Google script (will wait for consent)
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: unknown[]) {
        window.dataLayer.push(args);
      }
      gtag("js", new Date());
      gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
        wait_for_update: 500,
      });

      // Load Google Tag script (only on allowed routes)
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        // Script loaded, but no requests made until consent
      };
      script.onerror = () => {
        // Console warning in development
        if (process.env.NODE_ENV === "development") {
          console.warn("Failed to load Google Analytics script");
        }
      };
      document.head.appendChild(script);
    }
  }, []);

  // After consent is given or denied, send page view if on allowed route
  useEffect(() => {
    if (!hasMounted || !consentGiven) return;

    // Only send on allowed routes
    if (!isAnalyticsRoute(window.location.pathname)) return;

    // Sanitize page location
    const sanitized = sanitizePageLocation(window.location.href);

    // Send page view
    if (window.gtag) {
      window.gtag("config", process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_flags: "SameSite=Lax;Secure",
        cookie_expires: 34128000,
        page_location: sanitized.page_location,
        page_referrer: sanitized.page_referrer,
      });
    }
  }, [consentGiven, hasMounted]);

  // Handle consent banner interaction
  useEffect(() => {
    if (consentGiven) {
      // Apply consent update to gtag
      if (window.gtag) {
        window.gtag("consent", "update", {
          analytics_storage: "granted",
        });
      }
    }
  }, [consentGiven]);

  return null; // UI is rendered by the parent page that includes GaConsentBanner
}

/**
 * Sanitize page location for Google Analytics.
 * Removes personal data, keeps only allowed UTM parameters,
 * drops values containing @ or 7+ consecutive digits.
 */
function sanitizePageLocation(url: string): {
  page_location: string;
  page_referrer: string;
} {
  const origin = new URL(url).origin;
  const pathname = new URL(url).pathname;

  // Start with origin + pathname
  let pageLocation = origin + pathname;

  // Parse and keep only allowed UTM parameters
  const allowedUtm = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]);

  const url = new URL(url, "http://localhost");
  const referrer = document.referrer;
  let pageReferrer = origin; // default to origin

  if (referrer && referrer !== origin) {
    const refUrl = new URL(referrer);
    pageReferrer = origin + refUrl.pathname;
    // Keep only allowed UTM params from referrer
    const keptUtm: string[] = [];
    for (const [key, value] of url.searchParams.entries()) {
      if (allowedUtm.has(key)) {
        // Drop values containing @ or 7+ consecutive digits
        if (!value.includes("@") && !/\b\d{7,}\b/.test(value)) {
          keptUtm.push(`${key}=${value}`);
        }
      }
    }
    if (keptUtm.length > 0) {
      pageReferrer += "?" + keptUtm.join("&");
    }
  }

  // Strip existing query params from page_location, add only allowed UTMs
  const pageUrl = new URL(url.href);
  const existingUtm: string[] = [];
  for (const [key, value] of pageUrl.searchParams.entries()) {
    if (allowedUtm.has(key)) {
      if (!value.includes("@") && !/\b\d{7,}\b/.test(value)) {
        existingUtm.push(`${key}=${value}`);
      }
    }
  }
  pageLocation = origin + pathname + (existingUtm.length > 0 ? "?" + existingUtm.join("&") : "");

  return {
    page_location: pageLocation.substring(0, 2000), // cap length
    page_referrer: pageReferrer.substring(0, 2000),
  };
}