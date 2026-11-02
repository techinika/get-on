"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { isAnalyticsRoute } from "@/lib/analytics/routes";
import { readConsent, subscribeConsent } from "@/lib/analytics/consent";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

type Gtag = (...args: unknown[]) => void;

/**
 * AnalyticsLoader - loads Google Analytics only on allowed routes after consent.
 *
 * Behaviour:
 * - Only runs on allowed routes (isAnalyticsRoute check)
 * - Defines window.gtag/dataLayer before the Google script loads
 * - Loads the Google script only once the visitor accepts analytics
 * - Sends one sanitized page view after consent
 * - Never sends private data (emails, tokens, personal identifiers) to Google
 */
export function AnalyticsLoader() {
  const consent = useSyncExternalStore(
    subscribeConsent,
    readConsent,
    () => null
  );
  const prepared = useRef(false);
  const sentPageView = useRef(false);

  useEffect(() => {
    if (!MEASUREMENT_ID || !isAnalyticsRoute(window.location.pathname)) return;
    if (prepared.current) return;

    const gtag: Gtag = (...args) => {
      window.dataLayer.push(args);
    };
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag ?? gtag;
    window.gtag("js", new Date());
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500,
    });
    prepared.current = true;
  }, []);

  useEffect(() => {
    if (!MEASUREMENT_ID || !isAnalyticsRoute(window.location.pathname)) return;
    if (consent !== "accepted") return;

    loadAnalyticsScript(MEASUREMENT_ID);

    window.gtag?.("consent", "update", { analytics_storage: "granted" });

    if (sentPageView.current) return;
    sentPageView.current = true;

    const sanitized = sanitizePageLocation(window.location.href);
    window.gtag?.("config", MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_flags: "SameSite=Lax;Secure",
      cookie_expires: 34128000,
      page_location: sanitized.page_location,
      page_referrer: sanitized.page_referrer,
    });
    window.gtag?.("event", "page_view", {
      page_location: sanitized.page_location,
      page_referrer: sanitized.page_referrer,
      page_title: document.title,
    });
  }, [consent]);

  return null;
}

function loadAnalyticsScript(measurementId: string) {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-get-on-ga="${measurementId}"]`,
  );
  if (existing) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.crossOrigin = "anonymous";
  script.dataset.getOnGa = measurementId;
  script.onerror = () => {
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to load Google Analytics script");
    }
  };
  document.head.appendChild(script);
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
