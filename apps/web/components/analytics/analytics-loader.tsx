"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isAnalyticsRoute } from "@/lib/analytics/routes";
import { readConsent, subscribeConsent } from "@/lib/analytics/consent";

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
  const consent = useSyncExternalStore(
    subscribeConsent,
    readConsent,
    () => null
  );

  // No prior decision: define dataLayer and gtag with all denied, then load
  // the Google script (it makes no requests until consent is granted).
  useEffect(() => {
    if (consent !== null) return;

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
    script.onerror = () => {
      // Console warning in development
      if (process.env.NODE_ENV === "development") {
        console.warn("Failed to load Google Analytics script");
      }
    };
    document.head.appendChild(script);
  }, [consent]);

  // After consent is given, send a page view if on an allowed route
  useEffect(() => {
    if (consent !== "accepted") return;

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
  }, [consent]);

  // Apply the consent update to gtag
  useEffect(() => {
    if (consent !== "accepted") return;

    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
  }, [consent]);

  return null; // UI is rendered by the parent page that includes GaConsentBanner
}

/**
 * Sanitize page location for Google Analytics.
 * Removes personal data, keeps only allowed UTM parameters,
 * drops values containing @ or 7+ consecutive digits.
 */
function sanitizePageLocation(rawUrl: string): {
  page_location: string;
  page_referrer: string;
} {
  const parsedUrl = new URL(rawUrl);
  const origin = parsedUrl.origin;
  const pathname = parsedUrl.pathname;

  // Keep only allowed UTM parameters, and drop values containing @ or 7+ digits
  const allowedUtm = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]);

  function allowedUtmParams(params: URLSearchParams): string[] {
    const kept: string[] = [];
    for (const [key, value] of params.entries()) {
      if (
        allowedUtm.has(key) &&
        !value.includes("@") &&
        !/\b\d{7,}\b/.test(value)
      ) {
        kept.push(`${key}=${value}`);
      }
    }
    return kept;
  }

  const referrer = document.referrer;
  let pageReferrer = origin; // default to origin

  if (referrer && referrer !== origin) {
    const refUrl = new URL(referrer);
    pageReferrer = origin + refUrl.pathname;
    const keptUtm = allowedUtmParams(refUrl.searchParams);
    if (keptUtm.length > 0) {
      pageReferrer += "?" + keptUtm.join("&");
    }
  }

  // Strip existing query params from page_location, add only allowed UTMs
  const existingUtm = allowedUtmParams(parsedUrl.searchParams);
  const pageLocation =
    origin + pathname + (existingUtm.length > 0 ? "?" + existingUtm.join("&") : "");

  return {
    page_location: pageLocation.substring(0, 2000), // cap length
    page_referrer: pageReferrer.substring(0, 2000),
  };
}