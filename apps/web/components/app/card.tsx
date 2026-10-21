import * as React from "react";
import { cn } from "@/lib/utils";

/** Dashboard card: surface background, 1px border, 16px radius, no shadow (spec §4). */
export function AppCard({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn("app-card", interactive && "app-card-interactive", className)}
      {...props}
    />
  );
}
