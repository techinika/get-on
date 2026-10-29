"use client";

import * as React from "react";

type TurnstileWidget = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "execute";
      execution: "execute";
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
 * Cloudflare Turnstile, in invisible mode. It only runs when a site key is
 * set. The token is handed back to the form and checked on the server.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!siteKey) return;

    function render() {
      if (!container.current || !window.turnstile) return;
      window.turnstile.render(container.current, {
        sitekey: siteKey as string,
        appearance: "execute",
        execution: "execute",
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
  }, [siteKey, onToken]);

  if (!siteKey) return null;

  return <div ref={container} aria-hidden className="hidden" />;
}
