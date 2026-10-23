"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";

/** Floating button that appears once the reader has scrolled down the page. */
export function BackToTop() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 600);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text shadow-card transition-colors hover:bg-surface-muted print:hidden"
    >
      <ArrowUp size={20} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
