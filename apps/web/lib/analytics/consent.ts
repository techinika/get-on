export type ConsentDecision = "accepted" | "declined" | null;

const CONSENT_EVENT = "gs-consent-change";

function readCookie(name: string): string {
  const match = document.cookie.match(
    new RegExp("(^|;)\\s*" + name + "=\\s*([^;]+)")
  );
  return match ? match[2] : "";
}

export function readConsent(): ConsentDecision {
  if (typeof document === "undefined") return null;

  // __Host-gs_consent is rejected on non-HTTPS origins (e.g. localhost), so
  // also read a regular gs_consent cookie as a fallback. localStorage always
  // works and is the source of truth on insecure origins.
  const cookieValue = readCookie("__Host-gs_consent") ?? readCookie("gs_consent");
  let lsValue: string | null = null;
  try {
    lsValue = localStorage.getItem("gs_consent_v1");
  } catch {
    // localStorage can be unavailable in private browsing
  }

  if (cookieValue === "a1" || lsValue === "a1") return "accepted";
  if (cookieValue === "a0" || lsValue === "a0") return "declined";
  return null;
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
