"use client";

import * as React from "react";

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
 * Cloudflare Turnstile. It only runs when a site key is set. The widget asks
 * for a token as soon as it renders and only shows a challenge when Cloudflare
 * needs the visitor to prove they are human.
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
  }, [siteKey, onToken]);

  if (!siteKey) return null;

  return <div ref={container} />;
}
