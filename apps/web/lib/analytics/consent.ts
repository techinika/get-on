export type ConsentDecision = "accepted" | "declined" | null;

const CONSENT_EVENT = "gs-consent-change";

let memoryDecision: ConsentDecision = null;

function readCookie(name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp(`(?:^|;)\\s*${escaped}=\\s*([^;]+)`),
  );
  return match ? match[1] : "";
}

export function readConsent(): ConsentDecision {
  if (typeof document === "undefined") return null;

  const cookieValue = readCookie("__Host-gs_consent") || readCookie("gs_consent");
  let lsValue: string | null = null;
  try {
    lsValue = window.localStorage.getItem("gs_consent_v1");
  } catch {
    // localStorage can be unavailable in private browsing or sandboxed iframes
  }

  if (cookieValue === "a1" || lsValue === "a1") return "accepted";
  if (cookieValue === "a0" || lsValue === "a0") return "declined";
  return memoryDecision;
}

export function writeConsent(decision: Exclude<ConsentDecision, null>): void {
  memoryDecision = decision;
  const value = decision === "accepted" ? "a1" : "a0";

  if (typeof document !== "undefined") {
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + oneYearMs).toUTCString();
    const isHttps = typeof location !== "undefined" && location.protocol === "https:";
    let isFramed = false;
    try {
      isFramed = typeof window !== "undefined" && window.self !== window.top;
    } catch {
      isFramed = true;
    }

    const base = `; expires=${expires}; Path=/; SameSite=Lax`;
    try {
      if (isHttps) {
        document.cookie = `__Host-gs_consent=${value}${base}; Secure`;
        document.cookie = `gs_consent=${value}; expires=${expires}; Path=/; SameSite=${isFramed ? "None" : "Lax"}; Secure`;
      } else {
        document.cookie = `gs_consent=${value}${base}`;
      }
    } catch {
      // Blocked cookies fall back to localStorage / memoryDecision
    }

    try {
      window.localStorage.setItem("gs_consent_v1", value);
    } catch {
      // Blocked storage falls back to memoryDecision
    }

    notifyConsentChange();
  }
}

export function resetMemoryConsentForTest(): void {
  memoryDecision = null;
}

export function subscribeConsent(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CONSENT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CONSENT_EVENT, callback);
  };
}

export function notifyConsentChange() {
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
