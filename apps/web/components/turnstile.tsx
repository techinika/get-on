"use client";

import * as React from "react";
import { isTurnstileEnabled } from "@/lib/security/turnstile-flag";

type TurnstileWidget = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "interaction-only";
      execution: "render";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

const SCRIPT_ID = "cf-turnstile-script";

/**
 * Cloudflare Turnstile. It stays hidden until `NEXT_PUBLIC_TURNSTILE_ENABLED`
 * is true and a site key is set.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const enabled = isTurnstileEnabled();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!enabled || !siteKey) return;

    function render() {
      if (!container.current || !window.turnstile) return;
      window.turnstile.render(container.current, {
        sitekey: siteKey as string,
        appearance: "interaction-only",
        execution: "render",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    }

    if (window.turnstile) {
      render();
      return;
    }

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
      return () => {
        script.remove();
      };
    }
    return;
  }, [enabled, siteKey, onToken]);

  if (!enabled || !siteKey) return null;

  return <div ref={container} />;
}
