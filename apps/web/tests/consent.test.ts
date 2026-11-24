// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  readConsent,
  resetMemoryConsentForTest,
  subscribeConsent,
  writeConsent,
} from "@/lib/analytics/consent";

afterEach(() => {
  resetMemoryConsentForTest();
  document.cookie = "__Host-gs_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/";
  document.cookie = "gs_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/";
  try {
    window.localStorage.clear();
  } catch {
    // Ignore
  }
});

describe("analytics consent store", () => {
  it("falls back to regular gs_consent cookie when __Host-gs_consent is empty", () => {
    document.cookie = "gs_consent=a1; Path=/";
    expect(readConsent()).toBe("accepted");
    document.cookie = "gs_consent=a0; Path=/";
    expect(readConsent()).toBe("declined");
  });

  it("closes and notifies listeners even if cookies and localStorage throw", () => {
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    const lsDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: () => {
        throw new Error("cookie blocked");
      },
    });
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => ({
        getItem() {
          throw new Error("storage blocked");
        },
        setItem() {
          throw new Error("storage blocked");
        },
      }),
    });

    let notifications = 0;
    const unsub = subscribeConsent(() => {
      notifications += 1;
    });

    try {
      expect(readConsent()).toBeNull();
      writeConsent("declined");
      expect(readConsent()).toBe("declined");
      expect(notifications).toBe(1);

      writeConsent("accepted");
      expect(readConsent()).toBe("accepted");
      expect(notifications).toBe(2);
    } finally {
      unsub();
      if (cookieDescriptor) Object.defineProperty(document, "cookie", cookieDescriptor);
      if (lsDescriptor) Object.defineProperty(window, "localStorage", lsDescriptor);
    }
  });
});
