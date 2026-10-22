import React from "react";
import type { Theme } from "@get-on/blocks";
import { themeTokens } from "@get-on/blocks";

export { RenderPage } from "./render-page";
export { themeTokens } from "@get-on/blocks";

export function SiteRoot({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  const tokens = themeTokens(theme);
  const style: React.CSSProperties = tokens as React.CSSProperties;
  return (
    <div
      className="gs-root"
      data-color-mode="light"
      style={{ colorScheme: "light", ...style }}
    >
      {children}
    </div>
  );
}
