import React from "react";
import type { Theme } from "@get-on/blocks";
import { themeTokens } from "@get-on/blocks";

export { RenderPage } from "./src/render-page";
export { RenderPageV5, RenderNodeV5, ProtectedBadge } from "./src/render-v5";
export type { RenderV5Context } from "./src/render-v5";
export { RenderBlock } from "./src/render-block";
export type { RenderContext, RenderImage } from "./src/render-block";
export { SiteHeader, SiteFooter } from "./src/site-chrome";
export type {
  SiteHeaderProps,
  SiteFooterProps,
  SiteNavItem,
} from "./src/site-chrome";
export { Icon } from "./src/icons";
export { themeTokens } from "@get-on/blocks";
export { RENDERER_CSS, RENDERER_CSS_VERSION } from "./src/css-manifest";

export function SiteRoot({
  theme,
  children,
}: {
  theme: Theme;
  children?: React.ReactNode;
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
