import * as React from "react";
import { cn } from "@/lib/utils";

export type AppPageWidth = "wide" | "default" | "narrow" | "form";

/**
 * Page container for every dashboard screen (spec §5.11).
 * Widths: wide 1120, default 960, narrow 720, form 560.
 */
export function AppPage({
  width = "default",
  className,
  children,
}: {
  width?: AppPageWidth;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("app-page", `app-page--${width}`, className)}>{children}</div>
  );
}
