import React from "react";
import type { Theme } from "@get-on/blocks";
import { themeTokens } from "@get-on/blocks";

export { RenderPage } from "./render-page";
export { RenderPageV5, RenderNodeV5, ProtectedBadge } from "./render-v5";
export type { RenderV5Context } from "./render-v5";
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
  const design = theme.design ?? {};
  return (
    <div
      className="gs-root"
      data-color-mode="light"
      data-rhythm={design.rhythm ?? "even"}
      data-image-style={design.imageStyle ?? "rounded"}
      data-eyebrow={design.eyebrowStyle ?? "chip"}
      data-links={design.linkStyle ?? "underline"}
      data-rules={design.rules ?? "none"}
      style={{ colorScheme: "light", ...style }}
    >
      {children}
    </div>
  );
}
