"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Thin progress bar shown at the very top of the viewport while a navigation
 * is pending (spec §7.3). It appears after 120 ms, trickles to 80 % and fades
 * out over 150 ms once the new route is rendered.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const previousPath = React.useRef(pathname);

  const stop = React.useCallback(function stop() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (trickleRef.current) {
      clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
  }, []);

  const finish = React.useCallback(function finish() {
    stop();
    setProgress(100);
    const hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 150);
    return hide;
  }, [stop]);

  React.useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      finish();
    }
  }, [pathname, finish]);

  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = (event.target as HTMLElement | null)?.closest?.("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      if (target.getAttribute("target") === "_blank") return;
      if (target.getAttribute("data-no-progress") !== null) return;

      stop();
      timerRef.current = setTimeout(() => {
        setVisible(true);
        setProgress(12);
        trickleRef.current = setInterval(() => {
          setProgress((value) => (value < 80 ? value + Math.max(2, (80 - value) * 0.12) : 80));
        }, 120);
      }, 120);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      stop();
    };
  }, [stop]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 150ms ease-out" }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${progress}%`,
          boxShadow: "0 0 8px var(--primary)",
          transition: "width 200ms ease-out",
        }}
      />
    </div>
  );
}
