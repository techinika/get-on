import * as React from "react";
import {
  compileStyles,
  richTextToPlain,
  sanitizeHtml,
  themeTokens,
  type Block,
  type ContentNode,
  type PageContentV5,
  type RichNode,
  type Theme,
} from "@get-on/blocks";

export const RENDERER_CSS_VERSION = 7;

export const RENDERER_CSS = `.gs-root{container-type:inline-size;container-name:site;background:var(--s-bg);color:var(--s-text);font-family:var(--s-font-body);line-height:1.6;min-height:100%}.gs-root *,.gs-root *::before,.gs-root *::after{box-sizing:border-box}.gs-container{width:100%;max-width:1120px;margin-inline:auto;padding-inline:24px}.gs-header{border-bottom:1px solid var(--s-border);background:var(--s-bg);padding-block:16px;position:sticky;top:0;z-index:20}.gs-header-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.gs-header[data-gs-header="centered"] .gs-header-inner{flex-direction:column;justify-content:center;text-align:center}.gs-header[data-gs-header="overlay"]{background:color-mix(in srgb,var(--s-bg) 82%,transparent);backdrop-filter:blur(10px);border-bottom-color:color-mix(in srgb,var(--s-border) 60%,transparent)}.gs-header[data-gs-header="minimal"]{border-bottom:1px solid color-mix(in srgb,var(--s-border) 55%,transparent);padding-block:12px}.gs-header[data-gs-header="minimal"] .gs-nav a{font-size:.82rem;text-transform:uppercase;letter-spacing:.08em}.gs-header[data-gs-header="split"] .gs-nav{margin-left:auto;background:var(--s-soft);padding:6px 14px;border-radius:var(--s-btn-radius)}.gs-brand{font-family:var(--s-font-heading);font-weight:700;font-size:1.25rem;color:var(--s-text);text-decoration:none;display:inline-flex;flex-direction:column;gap:2px}.gs-nav{display:flex;flex-wrap:wrap;gap:16px;align-items:center}.gs-nav a{color:var(--s-text);text-decoration:none;font-weight:500}.gs-nav a:hover{color:var(--s-primary)}.gs-nav-toggle{display:none;background:transparent;border:1px solid var(--s-border);color:var(--s-text);border-radius:var(--s-radius);padding:6px 12px;font:inherit;font-weight:600;cursor:pointer}.gs-section{padding-block:var(--s-section-pad)}.gs-section--soft{background:var(--s-soft)}.gs-root[data-gs-rhythm="even"] .gs-section{background:var(--s-bg)}.gs-root[data-gs-rhythm="even"] .gs-section--soft{background:var(--s-soft)}.gs-root[data-gs-rhythm="alternate"] .gs-section:nth-of-type(even){background:var(--s-soft)}.gs-root[data-gs-rhythm="tinted"] .gs-section:nth-of-type(odd){background:color-mix(in srgb,var(--s-soft) 62%,var(--s-bg))}.gs-root[data-gs-rhythm="tinted"] .gs-section--soft{background:var(--s-soft)}.gs-root[data-gs-rhythm="bold"] .gs-section[data-gs-block="cta"],.gs-root[data-gs-rhythm="bold"] .gs-section[data-gs-block="stats"]{background:var(--s-primary);color:var(--s-on-primary)}.gs-root[data-gs-rhythm="bold"] .gs-section[data-gs-block="cta"] h2,.gs-root[data-gs-rhythm="bold"] .gs-section[data-gs-block="stats"] h2,.gs-root[data-gs-rhythm="bold"] .gs-section[data-gs-block="stats"] .gs-stat-val{color:var(--s-on-primary)}.gs-root[data-gs-rhythm="bold"] .gs-section[data-gs-block="cta"] .gs-btn{background:var(--s-bg);color:var(--s-primary)}.gs-root[data-gs-rhythm="bold"] .gs-section[data-gs-block="stats"] .gs-card{background:color-mix(in srgb,var(--s-bg) 12%,transparent);border-color:color-mix(in srgb,var(--s-on-primary) 24%,transparent)}.gs-section h1,.gs-section h2,.gs-section h3,.gs-section h4{font-family:var(--s-font-heading);line-height:1.15;margin:0 0 12px}.gs-hero-grid{display:grid;gap:32px;grid-template-columns:1.1fr .9fr;align-items:center}.gs-hero-media img{display:block;width:100%;max-height:440px;object-fit:cover;border-radius:var(--s-radius)}.gs-section[data-gs-layout="centered"] .gs-hero-copy{text-align:center;margin-inline:auto;max-width:680px}.gs-section[data-gs-layout="centered"] .gs-hero-actions{justify-content:center}.gs-section[data-gs-layout="minimal"]{padding-block:calc(var(--s-section-pad) * 1.15);border-bottom:1px solid var(--s-border)}.gs-section[data-gs-layout="minimal"] h1{font-size:clamp(2.25rem,5vw,3.75rem);letter-spacing:-0.02em;max-width:16ch}.gs-section[data-gs-layout="editorial"] .gs-hero-grid{grid-template-columns:1.25fr .75fr;align-items:end}.gs-section[data-gs-layout="editorial"] h1{font-size:clamp(2.4rem,4.8vw,3.8rem);letter-spacing:-0.025em}.gs-section[data-gs-layout="arch"] .gs-hero-media img{border-radius:999px 999px var(--s-radius) var(--s-radius);max-height:460px;object-fit:cover}.gs-section[data-gs-layout="offset-frame"] .gs-hero-media{padding:12px;background:var(--s-soft);border-radius:var(--s-radius);box-shadow:14px 14px 0 var(--s-accent)}.gs-section[data-gs-layout="product-shot"] .gs-hero-media{padding:14px;background:var(--s-bg);border:1px solid var(--s-border);border-radius:calc(var(--s-radius) * 1.5);box-shadow:0 24px 48px -18px rgba(15,23,42,.18)}.gs-section[data-gs-layout="fullbleed"]{position:relative;overflow:hidden;background:var(--s-primary);color:var(--s-on-primary)}.gs-section[data-gs-layout="fullbleed"] .gs-badge{color:var(--s-accent)}.gs-section[data-gs-layout="fullbleed"] .gs-btn{background:var(--s-bg);color:var(--s-primary)}.gs-section[data-gs-layout="card-over-image"] .gs-hero-grid{position:relative;display:block}.gs-section[data-gs-layout="card-over-image"] .gs-hero-media img{max-height:460px}.gs-section[data-gs-layout="card-over-image"] .gs-hero-copy{position:relative;z-index:2;max-width:560px;background:var(--s-bg);padding:28px;border-radius:var(--s-radius);border:1px solid var(--s-border);margin-top:-120px;box-shadow:0 18px 40px -16px rgba(0,0,0,.16)}.gs-section[data-gs-layout="diagonal"]{background:linear-gradient(168deg,var(--s-soft) 58%,var(--s-bg) 58.3%)}.gs-btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 22px;border-radius:var(--s-btn-radius);background:var(--s-primary);color:var(--s-on-primary);font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer;font-family:inherit;font-size:1rem}.gs-btn:disabled{opacity:.6;cursor:not-allowed}.gs-btn--secondary{background:transparent;color:var(--s-primary);border-color:var(--s-primary)}.gs-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.gs-grid[data-gs-layout="bento"]>:first-child{grid-column:span 2;background:var(--s-soft)}.gs-grid[data-gs-layout="mosaic"]{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.gs-grid[data-gs-layout="mosaic"]>:first-child img{height:240px}.gs-grid[data-gs-layout="alternating"],.gs-grid[data-gs-layout="menu-list"],.gs-grid[data-gs-layout="stacked"]{grid-template-columns:1fr}.gs-grid[data-gs-layout="menu-list"] .gs-card{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;border:0;border-bottom:1px dashed var(--s-border);border-radius:0;padding:14px 4px;background:transparent}.gs-grid[data-gs-layout="compact"]{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.gs-columns{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.gs-card{background:var(--s-bg);border:1px solid var(--s-border);border-radius:var(--s-radius);padding:20px}.gs-badge{display:inline-block;font-size:.82rem;font-weight:700;color:var(--s-primary);margin-bottom:8px;letter-spacing:.02em}.gs-stat-val{font-family:var(--s-font-heading);font-size:2rem;font-weight:700;color:var(--s-primary);margin:0 0 4px}.gs-form{display:grid;gap:14px;max-width:560px;margin-top:20px}.gs-field{display:grid;gap:6px;text-align:left}.gs-field label{font-size:.9rem;font-weight:600;color:var(--s-text)}.gs-input,.gs-textarea{width:100%;padding:10px 12px;border:1px solid var(--s-border);border-radius:var(--s-radius);background:var(--s-bg);color:var(--s-text);font:inherit}.gs-textarea{min-height:120px;resize:vertical}.gs-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.gs-form-status{margin:4px 0 0;font-size:.92rem;font-weight:500;min-height:1.25em;color:var(--s-primary)}.gs-form-status[data-state="error"]{color:var(--s-text)}.gs-accordion{display:grid;gap:10px;margin-top:20px}.gs-accordion-item{background:var(--s-bg);border:1px solid var(--s-border);border-radius:var(--s-radius);overflow:hidden}.gs-accordion-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:transparent;border:0;color:var(--s-text);font:inherit;font-weight:600;text-align:left;cursor:pointer}.gs-accordion-panel{padding:0 18px 16px;color:var(--s-muted)}.gs-footer{border-top:1px solid var(--s-border);background:var(--s-soft);padding-block:40px;font-size:.925rem}.gs-watermark{margin-top:16px;font-size:.8rem;opacity:.75}@container site (max-width:740px){.gs-hero-grid{grid-template-columns:1fr}.gs-grid[data-gs-layout="bento"]>:first-child{grid-column:span 1}.gs-section[data-gs-layout="card-over-image"] .gs-hero-copy{margin-top:16px}}@container site (max-width:639px){.gs-nav-toggle{display:inline-flex}.gs-nav{display:none;width:100%;flex-direction:column;align-items:flex-start;padding-top:12px;border-top:1px solid var(--s-border)}.gs-nav[data-open="true"]{display:flex}}`;

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
  const rhythm = theme?.design?.rhythm ?? "even";
  return (
    <div className="gs-root" data-gs-rhythm={rhythm} style={tokens as React.CSSProperties}>
      {children}
    </div>
  );
}

export function SiteHeader({
  businessName,
  nav = [],
  logoUrl,
  tagline,
  theme,
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
  const headerStyle = theme?.header?.style ?? "classic";
  return (
    <header className="gs-header" data-gs-header={headerStyle}>
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
        {nav.length > 0 ? (
          <>
            <button
              type="button"
              className="gs-nav-toggle"
              aria-expanded={false}
              aria-label="Toggle navigation"
            >
              Menu
            </button>
            <nav className="gs-nav" aria-label="Main navigation" data-open="false">
              {nav.map((item) => (
                <a key={`${item.href}-${item.label}`} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
          </>
        ) : null}
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
  if (typeof link === "string" && link.trim()) return link.trim();
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

function renderVideoEmbedUrl(raw: string): { kind: "iframe" | "video"; url: string } | null {
  const url = raw.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) {
        return { kind: "iframe", url: `https://www.youtube-nocookie.com/embed/${id}` };
      }
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) {
        return { kind: "iframe", url: `https://www.youtube-nocookie.com/embed/${id}` };
      }
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
      if (/^\d{4,16}$/.test(id)) {
        return { kind: "iframe", url: `https://player.vimeo.com/video/${id}` };
      }
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(parsed.pathname)) {
      return { kind: "video", url: parsed.toString() };
    }
  } catch {
    return null;
  }
  return null;
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
  const eyebrow = typeof props.eyebrow === "string" ? props.eyebrow : "";
  const heading = typeof props.heading === "string" ? props.heading : "";
  const subheading = typeof props.subheading === "string" ? props.subheading : "";
  const text = typeof props.text === "string" ? props.text : "";
  const imageId = typeof props.imageId === "string" ? props.imageId : "";
  const layout = typeof props.layout === "string" ? props.layout : "";
  const img = imageId && ctx?.getImage ? ctx.getImage(imageId) : null;
  const items = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];

  if (type === "contact-form") {
    const showName = props.showName !== false;
    const showPhone = Boolean(props.showPhone);
    const phoneRequired = Boolean(props.phoneRequired) && showPhone;
    const submitLabel =
      typeof props.submitLabel === "string" && props.submitLabel.trim()
        ? props.submitLabel.trim()
        : typeof props.buttonLabel === "string" && props.buttonLabel.trim()
          ? props.buttonLabel.trim()
          : "Send message";

    return (
      <section className="gs-section gs-section--soft" data-gs-node={nodeId} data-gs-block={type}>
        <div className="gs-container">
          {eyebrow ? <p className="gs-badge">{eyebrow}</p> : null}
          {heading ? <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)" }}>{heading}</h2> : null}
          {subheading ? <p style={{ fontSize: "1.125rem", opacity: 0.85, maxWidth: "60ch" }}>{subheading}</p> : null}
          {text ? <p style={{ maxWidth: "65ch" }}>{text}</p> : null}
          {ctx?.contactEnabled === false && ctx.mode === "editor" ? (
            <p className="gs-card" style={{ maxWidth: 560, marginTop: 16 }}>
              Enable the Contact forms plugin to start receiving visitor messages from this form.
            </p>
          ) : null}
          <form
            className="gs-form"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {showName ? (
              <div className="gs-field">
                <label>Name</label>
                <input className="gs-input" type="text" name="name" placeholder="Your name" required />
              </div>
            ) : null}
            <div className="gs-field">
              <label>Email</label>
              <input className="gs-input" type="email" name="email" placeholder="you@example.com" required />
            </div>
            {showPhone ? (
              <div className="gs-field">
                <label>Phone</label>
                <input
                  className="gs-input"
                  type="tel"
                  name="phone"
                  placeholder="+1 555 000 0000"
                  required={phoneRequired}
                />
              </div>
            ) : null}
            <div className="gs-field">
              <label>Message</label>
              <textarea className="gs-textarea" name="message" placeholder="How can we help?" required />
            </div>
            <div>
              <button type="submit" className="gs-btn">
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </section>
    );
  }

  const actions =
    (typeof props.buttonLabel === "string" && props.buttonLabel) ||
    (typeof props.button2Label === "string" && props.button2Label) ? (
      <div className="gs-hero-actions" style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {typeof props.buttonLabel === "string" && props.buttonLabel ? (
          <a href={resolveLinkHref(props.buttonLink, ctx)} className="gs-btn">
            {props.buttonLabel}
          </a>
        ) : null}
        {typeof props.button2Label === "string" && props.button2Label ? (
          <a href={resolveLinkHref(props.button2Link, ctx)} className="gs-btn gs-btn--secondary">
            {props.button2Label}
          </a>
        ) : null}
      </div>
    ) : null;

  const isSplitHero =
    type === "hero" &&
    Boolean(img) &&
    layout !== "centered" &&
    layout !== "minimal" &&
    layout !== "fullbleed";

  return (
    <section
      className={`gs-section${type === "features" || type === "faq" || type === "testimonials" ? " gs-section--soft" : ""}`}
      data-gs-node={nodeId}
      data-gs-block={type}
      data-gs-layout={layout || undefined}
    >
      <div className="gs-container">
        {isSplitHero && img ? (
          <div className="gs-hero-grid">
            {layout === "card-over-image" ? (
              <>
                <div className="gs-hero-media">
                  <img src={img.src} alt={img.alt ?? heading ?? ""} />
                </div>
                <div className="gs-hero-copy">
                  {eyebrow ? <p className="gs-badge">{eyebrow}</p> : null}
                  {heading ? <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>{heading}</h1> : null}
                  {subheading ? <p style={{ fontSize: "1.125rem", opacity: 0.85, maxWidth: "60ch" }}>{subheading}</p> : null}
                  {text ? <p style={{ maxWidth: "65ch" }}>{text}</p> : null}
                  {actions}
                </div>
              </>
            ) : (
              <>
                <div className="gs-hero-copy">
                  {eyebrow ? <p className="gs-badge">{eyebrow}</p> : null}
                  {heading ? <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}>{heading}</h1> : null}
                  {subheading ? <p style={{ fontSize: "1.125rem", opacity: 0.85, maxWidth: "60ch" }}>{subheading}</p> : null}
                  {text ? <p style={{ maxWidth: "65ch" }}>{text}</p> : null}
                  {actions}
                </div>
                <div className="gs-hero-media">
                  <img src={img.src} alt={img.alt ?? heading ?? ""} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={type === "hero" ? "gs-hero-copy" : undefined}>
            {eyebrow ? <p className="gs-badge">{eyebrow}</p> : null}
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
            {actions}
          </div>
        )}
        {type === "faq" && items.length > 0 ? (
          <div className="gs-accordion">
            {items.map((item, idx) => {
              const title = String(item.question ?? item.title ?? item.name ?? `Question ${idx + 1}`);
              const answer = String(item.answer ?? item.text ?? "");
              return (
                <div key={idx} className="gs-accordion-item">
                  <button
                    type="button"
                    className="gs-accordion-trigger"
                    data-gs-accordion-trigger=""
                    aria-expanded={idx === 0}
                  >
                    <span>{title}</span>
                  </button>
                  <div className="gs-accordion-panel" data-gs-accordion-panel="" hidden={idx !== 0}>
                    <p style={{ margin: 0 }}>{answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : items.length > 0 ? (
          <div className="gs-grid" data-gs-layout={layout || undefined} style={{ marginTop: 24 }}>
            {items.map((item, idx) => {
              const itemImgId =
                typeof item.imageId === "string"
                  ? item.imageId
                  : typeof item.photoId === "string"
                    ? item.photoId
                    : "";
              const itemImg = itemImgId && ctx?.getImage ? ctx.getImage(itemImgId) : null;
              return (
                <div key={idx} className="gs-card">
                  {itemImg ? (
                    <img
                      src={itemImg.src}
                      alt={String(item.alt ?? item.name ?? item.title ?? "")}
                      style={{
                        width: "100%",
                        height: 180,
                        objectFit: "cover",
                        borderRadius: "var(--s-radius)",
                        marginBottom: 12,
                      }}
                    />
                  ) : null}
                  {typeof item.value === "string" ? <p className="gs-stat-val">{item.value}</p> : null}
                  {typeof item.title === "string" ? <h3>{item.title}</h3> : null}
                  {typeof item.name === "string" ? <h3>{item.name}</h3> : null}
                  {typeof item.role === "string" ? (
                    <p style={{ fontSize: "0.875rem", opacity: 0.75, marginTop: 0 }}>{item.role}</p>
                  ) : null}
                  {typeof item.price === "string" ? (
                    <p style={{ fontWeight: 700, color: "var(--s-primary)" }}>{item.price}</p>
                  ) : null}
                  {typeof item.time === "string" ? (
                    <p style={{ fontWeight: 600, opacity: 0.8 }}>{item.time}</p>
                  ) : null}
                  {typeof item.text === "string" ? <p style={{ margin: 0 }}>{item.text}</p> : null}
                  {typeof item.description === "string" ? (
                    <p style={{ margin: 0 }}>{item.description}</p>
                  ) : null}
                  {typeof item.quote === "string" ? <p style={{ margin: 0 }}>{item.quote}</p> : null}
                  {typeof item.author === "string" ? (
                    <p style={{ margin: "10px 0 0", fontWeight: 600, fontSize: "0.9rem" }}>{item.author}</p>
                  ) : null}
                </div>
              );
            })}
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
    case "grid": {
      const baseClass =
        node.type === "section"
          ? "gs-section"
          : node.type === "container"
            ? "gs-container"
            : node.type === "columns"
              ? "gs-columns"
              : node.type === "grid"
                ? "gs-grid"
                : "";
      return (
        <div
          {...commonProps}
          className={[baseClass, extraClasses].filter(Boolean).join(" ") || undefined}
        >
          {(node.children ?? []).map((child) => (
            <NodeView key={child.id} node={child} ctx={ctx} classMap={classMap} />
          ))}
        </div>
      );
    }
    case "heading": {
      const rawLevel = Number(props.level ?? 2);
      const level = Number.isFinite(rawLevel) ? Math.max(1, Math.min(6, Math.round(rawLevel))) : 2;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return <Tag {...commonProps}>{String(props.text ?? "")}</Tag>;
    }
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
    case "list": {
      const items = Array.isArray(props.items) ? props.items.map((x) => String(x)) : [];
      const Tag = props.ordered ? "ol" : "ul";
      return (
        <Tag {...commonProps}>
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </Tag>
      );
    }
    case "accordion":
      return (
        <div {...commonProps} className={["gs-accordion", extraClasses].filter(Boolean).join(" ")}>
          {(node.children ?? []).map((child) => (
            <NodeView key={child.id} node={child} ctx={ctx} classMap={classMap} />
          ))}
        </div>
      );
    case "accordion-item":
      return (
        <div {...commonProps} className={["gs-accordion-item", extraClasses].filter(Boolean).join(" ")}>
          <button type="button" className="gs-accordion-trigger" data-gs-accordion-trigger="" aria-expanded="false">
            <span>{String(props.title ?? "Item")}</span>
          </button>
          <div className="gs-accordion-panel" data-gs-accordion-panel="" hidden>
            <p style={{ margin: 0 }}>{String(props.text ?? "")}</p>
            {(node.children ?? []).map((child) => (
              <NodeView key={child.id} node={child} ctx={ctx} classMap={classMap} />
            ))}
          </div>
        </div>
      );
    case "video": {
      const embed = typeof props.url === "string" ? renderVideoEmbedUrl(props.url) : null;
      if (!embed) return <div {...commonProps} className={["gs-card", extraClasses].filter(Boolean).join(" ")}>Video</div>;
      if (embed.kind === "video") {
        return <video {...commonProps} src={embed.url} controls style={{ width: "100%", borderRadius: "var(--s-radius)" }} />;
      }
      return (
        <iframe
          {...commonProps}
          src={embed.url}
          title={String(props.title ?? "Embedded video")}
          allowFullScreen
          style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: "var(--s-radius)" }}
        />
      );
    }
    case "html": {
      const sanitized = sanitizeHtml(String(props.html ?? ""));
      return <div {...commonProps} dangerouslySetInnerHTML={{ __html: sanitized.html }} />;
    }
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
