"use client";

import { Button } from "@/components/ui/button";

/**
 * Opens the help panel. The panel lives in the app shell, so the button
 * sends a small event that the shell listens for.
 */
export function OpenHelpButton({
  variant = "ghost",
  size = "sm",
  className,
  children = "Open help",
}: {
  variant?: "ghost" | "secondary" | "primary";
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Button
      variant={variant}
      size={size}
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event("get-on:help"))}
    >
      {children}
    </Button>
  );
}
