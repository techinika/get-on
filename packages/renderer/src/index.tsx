import * as React from "react";
import {
  compileStyles,
  richTextToPlain,
  themeTokens,
  type Block,
  type ContentNode,
  type PageContentV5,
  type RichNode,
  type Theme,
} from "@get-on/blocks";

export const RENDERER_CSS_VERSION = 5;

export const RENDERER_CSS = `.gs-root{container-type:inline-size;container-name:site;background:var(--s-bg);color:var(--s-text);font-family:var(--s-font-body);line-height:1.6;min-height:100%}.gs-container{width:100%;max-width:1120px;margin-inline:auto;padding-inline:24px}.gs-header{border-bottom:1px solid var(--s-border);background:var(--s-bg);padding-block:16px}.gs-header-inner{display:flex;align-items:center;justify-content:space-between;gap:16px}.gs-brand{font-family:var(--s-font-heading);font-weight:700;font-size:1.25rem;color:var(--s-text);text-decoration:none}.gs-nav{display:flex;flex-wrap:wrap;gap:16px;align-items:center}.gs-nav a{color:var(--s-text);text-decoration:none;font-weight:500}.gs-section{padding-block:var(--s-section-pad)}.gs-section--soft{background:var(--s-soft)}.gs-section h1,.gs-section h2,.gs-section h3{font-family:var(--s-font-heading);line-height:1.15;margin:0 0 12px}.gs-btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 22px;border-radius:var(--s-btn-radius);background:var(--s-primary);color:var(--s-on-primary);font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer}.gs-btn--secondary{background:transparent;color:var(--s-primary);border-color:var(--s-primary)}.gs-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.gs-card{background:var(--s-bg);border:1px solid var(--s-border);border-radius:var(--s-radius);padding:20px}.gs-footer{border-top:1px solid var(--s-border);background:var(--s-soft);padding-block:40px;font-size:.925rem}.gs-watermark{margin-top:16px;font-size:.8rem;opacity:.75}`;

export type RenderImage = {
  id?: string;
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type RenderNavItem = {
  label: string;
  href: string;
  pageId?: string;
};

export type RenderContext = {
  mode: "editor" | "publish";
  contactEnabled?: boolean;
  theme?: Theme;
  hours?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  socialLinks?: { network: string; url: string }[];
  getImage?: (imageId: string) => RenderImage | null;
  getPageHref?: (pageId: string) => string;
  getField?: (key: string) => string | null;
};

export function SiteRoot({
  theme,
  children,
}: {
  theme?: Theme | null;
  children: React.ReactNode;
}) {
  const tokens = themeTokens(theme);
  return (
    <div className="gs-root" style={tokens as React.CSSProperties}>
      {children}
    </div>
  );
}

export function SiteHeader({
  businessName,
  nav = [],
  logoUrl,
  tagline,
}: {
  businessName: string;
  nav?: RenderNavItem[];
  watermark?: boolean;
  theme?: Theme | null;
  logoUrl?: string | null;
  tagline?: string | null;
  businessType?: string | null;
  phone?: string | null;
}) {
  return (
    <header className="gs-header">
      <div className="gs-container gs-header-inner">
        <a href="/" className="gs-brand">
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} style={{ height: 32, width: "auto" }} />
          ) : (
            <span>{businessName}</span>
          )}
          {tagline ? (
            <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 400, opacity: 0.75 }}>
              {tagline}
            </span>
          ) : null}
        </a>
        <nav className="gs-nav" aria-label="Main navigation">
          {nav.map((item) => (
            <a key={`${item.href}-${item.label}`} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({
  businessName,
  phone,
  email,
  address,
  hours,
  nav = [],
  showWatermark,
  tagline,
  socialLinks = [],
  reportHref,
}: {
  businessName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  hours?: string | null;
  nav?: RenderNavItem[];
  showWatermark?: boolean;
  theme?: Theme | null;
  tagline?: string | null;
  socialLinks?: { network: string; url: string }[];
  reportHref?: string;
}) {
  return (
    <footer className="gs-footer">
      <div className="gs-container">
        <div className="gs-grid">
          <div>
            <p style={{ fontWeight: 700, margin: "0 0 6px" }}>{businessName}</p>
            {tagline ? <p style={{ margin: "0 0 8px", opacity: 0.8 }}>{tagline}</p> : null}
            {address ? <p style={{ margin: "0 0 4px" }}>{address}</p> : null}
            {hours ? <p style={{ margin: "0 0 4px" }}>{hours}</p> : null}
          </div>
          <div>
            {phone ? <p style={{ margin: "0 0 4px" }}>{phone}</p> : null}
            {email ? <p style={{ margin: "0 0 4px" }}>{email}</p> : null}
            {socialLinks.length > 0 ? (
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {socialLinks.map((link) => (
                  <a key={link.url} href={link.url} rel="noopener noreferrer">
                    {link.network}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          {nav.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {nav.map((item) => (
                <a key={`${item.href}-${item.label}`} href={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        {showWatermark ? (
          <p className="gs-watermark" data-gs-protect="1">
            Built with Get-On
          </p>
        ) : null}
        {reportHref ? (
          <p style={{ marginTop: 12, fontSize: "0.75rem", opacity: 0.7 }}>
            <a href={reportHref}>Report abuse</a>
          </p>
        ) : null}
      </div>
    </footer>
  );
}

function resolveLinkHref(link: unknown, ctx?: RenderContext): string {
  if (!link || typeof link !== "object") return "#";
  const rec = link as Record<string, unknown>;
  if (rec.type === "url" && typeof rec.url === "string") return rec.url;
  if (rec.type === "email" && typeof rec.email === "string") return `mailto:${rec.email}`;
  if (rec.type === "phone" && typeof rec.phone === "string") return `tel:${rec.phone}`;
  if (rec.type === "anchor" && typeof rec.anchor === "string") return `#${rec.anchor}`;
  if (rec.type === "page" && typeof rec.pageId === "string" && ctx?.getPageHref) {
    return ctx.getPageHref(rec.pageId);
  }
  return "#";
}

function SmartBlock({
  type,
  props,
  ctx,
  nodeId,
}: {
  type: string;
  props: Record<string, unknown>;
  ctx?: RenderContext;
  nodeId?: string;
}) {
  const heading = typeof props.heading === "string" ? props.heading : "";
  const subheading = typeof props.subheading === "string" ? props.subheading : "";
  const eyebrow = typeof props.eyebrow === "string" ? props.eyebrow : "";
  const text = typeof props.text === "string" ? props.text : "";
  const imageId = typeof props.imageId === "string" ? props.imageId : "";
  const img = imageId && ctx?.getImage ? ctx.getImage(imageId) : null;
  const items = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];

  return (
    <section
      className={`gs-section${type === "features" || type === "faq" ? " gs-section--soft" : ""}`}
      data-gs-node={nodeId}
      data-gs-block={type}
    >
      <div className="gs-container">
        {eyebrow ? (
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--s-primary)", marginBottom: 8 }}>
            {eyebrow}
          </p>
        ) : null}
        {heading ? (
          type === "hero" ? (
            <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>{heading}</h1>
          ) : (
            <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)" }}>{heading}</h2>
          )
        ) : null}
        {subheading ? (
          <p style={{ fontSize: "1.125rem", opacity: 0.85, maxWidth: "60ch" }}>{subheading}</p>
        ) : null}
        {text ? <p style={{ maxWidth: "65ch" }}>{text}</p> : null}
        {img ? (
          <img
            src={img.src}
            alt={img.alt ?? heading ?? ""}
            style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: "var(--s-radius)", marginTop: 20 }}
          />
        ) : null}
        {typeof props.buttonLabel === "string" && props.buttonLabel ? (
          <div style={{ marginTop: 20 }}>
            <a href={resolveLinkHref(props.buttonLink, ctx)} className="gs-btn">
              {props.buttonLabel}
            </a>
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="gs-grid" style={{ marginTop: 24 }}>
            {items.map((item, idx) => (
              <div key={idx} className="gs-card">
                {typeof item.title === "string" ? <h3>{item.title}</h3> : null}
                {typeof item.name === "string" ? <h3>{item.name}</h3> : null}
                {typeof item.price === "string" ? (
                  <p style={{ fontWeight: 700, color: "var(--s-primary)" }}>{item.price}</p>
                ) : null}
                {typeof item.text === "string" ? <p style={{ margin: 0 }}>{item.text}</p> : null}
                {typeof item.quote === "string" ? <p style={{ margin: 0 }}>{item.quote}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NodeView({
  node,
  ctx,
  classMap,
}: {
  node: ContentNode;
  ctx?: RenderContext;
  classMap: Map<string, string[]>;
}) {
  if (
    node.hidden === true ||
    (typeof node.hidden === "object" && node.hidden !== null && node.hidden.all === true)
  ) {
    return null;
  }
  const props = node.props ?? {};
  const extraClasses = [
    ...(node.classes ?? []),
    ...(classMap.get(node.id) ?? []),
  ].join(" ");
  const commonProps = {
    id: node.attrs?.id,
    className: extraClasses || undefined,
    "data-gs-node": node.id,
  };

  switch (node.type) {
    case "page":
      return (
        <div {...commonProps}>
          {(node.children ?? []).map((child) => (
            <NodeView key={child.id} node={child} ctx={ctx} classMap={classMap} />
          ))}
        </div>
      );
    case "section":
    case "container":
    case "columns":
    case "column":
    case "stack":
    case "grid":
      return (
        <div
          {...commonProps}
          className={[node.type === "section" ? "gs-section" : "", extraClasses]
            .filter(Boolean)
            .join(" ")}
        >
          {(node.children ?? []).map((child) => (
            <NodeView key={child.id} node={child} ctx={ctx} classMap={classMap} />
          ))}
        </div>
      );
    case "heading":
      return <h2 {...commonProps}>{String(props.text ?? "")}</h2>;
    case "text":
      return <p {...commonProps}>{String(props.text ?? "")}</p>;
    case "richtext":
      return <p {...commonProps}>{richTextToPlain(props.doc as RichNode | undefined)}</p>;
    case "button":
      return (
        <a
          {...commonProps}
          href={resolveLinkHref(props.link, ctx)}
          className={["gs-btn", extraClasses].filter(Boolean).join(" ")}
        >
          {String(props.label ?? "Button")}
        </a>
      );
    case "divider":
      return <hr {...commonProps} />;
    case "spacer":
      return <div {...commonProps} style={{ height: Number(props.height ?? 32) }} />;
    case "image": {
      const id = typeof props.imageId === "string" ? props.imageId : "";
      const img = id && ctx?.getImage ? ctx.getImage(id) : null;
      return img ? (
        <img {...commonProps} src={img.src} alt={String(props.alt ?? img.alt ?? "")} />
      ) : (
        <div {...commonProps} className={["gs-card", extraClasses].filter(Boolean).join(" ")}>
          Image placeholder
        </div>
      );
    }
    case "smart":
      return (
        <SmartBlock
          type={String(props.kind ?? "text")}
          props={props}
          ctx={ctx}
          nodeId={node.id}
        />
      );
    default:
      return <div {...commonProps} />;
  }
}

export function RenderPage({
  content,
  header,
  footer,
  ctx,
}: {
  content: { blocks: Block[] };
  header?: React.ReactNode;
  footer?: React.ReactNode;
  ctx?: RenderContext;
}) {
  return (
    <div className="gs-page">
      {header}
      <main>
        {(content.blocks ?? []).map((block) => (
          <SmartBlock
            key={block.id}
            type={block.type}
            props={block.props ?? {}}
            ctx={ctx}
            nodeId={block.id}
          />
        ))}
      </main>
      {footer}
    </div>
  );
}

export function RenderPageV5({
  content,
  header,
  footer,
  ctx,
}: {
  content: PageContentV5;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  overlay?: boolean;
  protect?: boolean;
  reportHref?: string;
  ctx?: RenderContext;
}) {
  const compiled = compileStyles(content.root, { customCss: content.css });
  return (
    <div className="gs-page">
      {header}
      <main>
        <NodeView node={content.root} ctx={ctx} classMap={compiled.classes} />
      </main>
      {footer}
    </div>
  );
}
