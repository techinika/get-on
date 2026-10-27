import React from "react";
import { linkToHref, type LinkTarget, type Theme } from "@get-on/blocks";

export type SiteNavItem = {
  label: string;
  href: string;
};

export type SiteHeaderProps = {
  businessName: string;
  logoUrl?: string | null;
  nav?: SiteNavItem[];
  /** Shown when the website is free and built with Get-On. */
  watermark?: boolean;
  theme?: Theme;
  tagline?: string | null;
  businessType?: string | null;
  phone?: string | null;
  ctaHref?: string | null;
};

function wordmarkStyle(theme?: Theme): React.CSSProperties {
  const wordmark = theme?.design?.wordmark;
  if (!wordmark) return {};
  return {
    fontFamily: wordmark.font === "body" ? "var(--s-font-body)" : "var(--s-font-heading)",
    fontWeight: wordmark.weight ?? 700,
    textTransform: wordmark.case === "upper" ? "uppercase" : wordmark.case === "small" ? "lowercase" : "none",
    letterSpacing: `${wordmark.tracking ?? -0.02}em`,
    fontSize: `${wordmark.size ?? 24}px`,
  };
}

function headerCta(theme: Theme | undefined, ctaHref: string | null | undefined, phone: string | null | undefined) {
  const cta = theme?.header?.cta;
  if (!cta || cta.enabled === false) return null;
  const href = cta.link ? linkToHref(cta.link) : ctaHref ?? (phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : null);
  if (!href) return null;
  const label = cta.label || (phone ? phone : "Get in touch");
  return { href, label, style: cta.style ?? "solid" };
}

export function SiteHeader({
  businessName,
  logoUrl,
  nav = [],
  watermark = true,
  theme,
  tagline,
  businessType,
  phone,
  ctaHref,
}: SiteHeaderProps) {
  const style = theme?.header?.style ?? "classic";
  const sticky = theme?.header?.sticky === true && style !== "overlay";
  const border = theme?.header?.border !== false;
  const background = theme?.header?.background ?? "plain";
  const cta = headerCta(theme, ctaHref, phone);
  const announcement = theme?.header?.announcement;
  const showAnnouncement = announcement?.enabled === true && Boolean(announcement.text?.trim());
  const sub = theme?.design?.wordmark?.sub === "type" && businessType ? businessType : tagline;
  const classes = [
    "gs-header",
    `gs-header-${style}`,
    sticky ? "gs-header-sticky" : "",
    border ? "" : "gs-header-no-border",
    `gs-header-bg-${background}`,
  ].filter(Boolean).join(" ");

  const brand = (
    <a className="gs-brand" href="/" aria-label={businessName}>
      {logoUrl ? (
        <img className="gs-logo" src={logoUrl} alt="" width={40} height={40} />
      ) : null}
      <span className="gs-wordmark" style={wordmarkStyle(theme)}>
        <span className="gs-wordmark-name">{businessName}</span>
        {sub && theme?.design?.wordmark?.sub === "type" ? (
          <span className="gs-wordmark-sub">{sub}</span>
        ) : null}
      </span>
    </a>
  );

  const navLinks = nav.length > 0 ? (
    <nav className="gs-nav" aria-label="Main menu">
      {nav.map((item) => (
        <a className="gs-nav-link" href={item.href} key={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  ) : null;

  const ctaLink = cta ? (
    <a className={`gs-btn gs-btn-${cta.style} gs-header-cta`} href={cta.href}>
      {cta.label}
    </a>
  ) : null;

  if (style === "minimal") {
    return (
      <header className={classes}>
        {showAnnouncement ? <Announcement announcement={announcement} /> : null}
        <div className="gs-header-inner gs-header-inner-minimal">
          {brand}
          <details className="gs-menu-panel">
            <summary className="gs-menu-button">Menu</summary>
            <div className="gs-menu-full">
              <details className="gs-menu-close-wrap">
                <summary className="gs-menu-close" aria-label="Close menu">Close</summary>
              </details>
              <nav className="gs-menu-full-nav" aria-label="Main menu">
                {nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
              </nav>
              {ctaLink}
            </div>
          </details>
        </div>
        {watermark ? <p className="gs-watermark">Built with Get-On</p> : null}
      </header>
    );
  }

  if (style === "centered") {
    return (
      <header className={classes}>
        {showAnnouncement ? <Announcement announcement={announcement} /> : null}
        <div className="gs-header-centered">
          <div className="gs-header-centered-top">{brand}</div>
          <div className="gs-header-centered-menu">
            {navLinks}
            {ctaLink}
          </div>
        </div>
        {watermark ? <p className="gs-watermark">Built with Get-On</p> : null}
      </header>
    );
  }

  if (style === "split") {
    return (
      <header className={classes}>
        {showAnnouncement ? <Announcement announcement={announcement} /> : null}
        <div className="gs-header-inner gs-header-inner-split">
          <div className="gs-header-split-left">{navLinks}</div>
          {brand}
          <div className="gs-header-split-right">
            {theme?.header?.extraLinks?.map((link, index) => {
              const href = linkToHref(link.link);
              return href ? <a className="gs-nav-link" href={href} key={index}>{link.label}</a> : null;
            })}
            {ctaLink}
          </div>
        </div>
        {watermark ? <p className="gs-watermark">Built with Get-On</p> : null}
      </header>
    );
  }

  return (
    <header className={classes}>
      {showAnnouncement ? <Announcement announcement={announcement} /> : null}
      <div className="gs-header-inner">
        {brand}
        {navLinks}
        {ctaLink}
      </div>
      {watermark ? <p className="gs-watermark">Built with Get-On</p> : null}
    </header>
  );
}

function Announcement({ announcement }: { announcement: NonNullable<Theme["header"]>["announcement"] }) {
  if (!announcement?.text) return null;
  const href = announcement.link ? linkToHref(announcement.link as LinkTarget) : null;
  const content = href ? <a href={href}>{announcement.text}</a> : announcement.text;
  return (
    <div className={`gs-announcement gs-announcement-${announcement.bg ?? "brand"}`} style={announcement.bg === "custom" && announcement.color ? { background: announcement.color } : undefined}>
      {content}
    </div>
  );
}

export type SiteFooterProps = {
  businessName: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string | null;
  nav?: SiteNavItem[];
  showWatermark?: boolean;
  theme?: Theme;
  tagline?: string | null;
  socialLinks?: { network: string; url: string }[];
};

export function SiteFooter({
  businessName,
  phone,
  email,
  address,
  hours,
  nav = [],
  showWatermark = true,
  theme,
  tagline,
  socialLinks = [],
}: SiteFooterProps) {
  const layout = theme?.footer?.layout ?? "simple";
  const about = theme?.footer?.about || tagline || "";
  const columns = theme?.footer?.columns ?? [];
  const background = theme?.footer?.background ?? "soft";
  const classes = `gs-footer gs-footer-${layout} gs-footer-bg-${background}`;
  const contact = (
    <div className="gs-footer-col gs-footer-contact">
      {theme?.footer?.showContact !== false ? (
        <>
          {address ? <p className="gs-footer-text">{address}</p> : null}
          {phone ? <p className="gs-footer-text"><a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a></p> : null}
          {email ? <p className="gs-footer-text"><a href={`mailto:${email}`}>{email}</a></p> : null}
          {theme?.footer?.showHours !== false && hours ? <p className="gs-footer-text">{hours}</p> : null}
        </>
      ) : null}
    </div>
  );

  const social = theme?.footer?.showSocial !== false && socialLinks.length > 0 ? (
    <ul className="gs-social gs-footer-social">
      {socialLinks.map((link, index) => (
        <li key={index}><a className="gs-social-link" href={link.url} rel="noopener noreferrer" target="_blank">{link.network}</a></li>
      ))}
    </ul>
  ) : null;

  if (layout === "bigbrand") {
    return (
      <footer className={classes}>
        <div className="gs-footer-big-top">
          <div className="gs-footer-col">
            <p className="gs-footer-name">{businessName}</p>
            {about ? <p className="gs-footer-text">{about}</p> : null}
            {contact}
            {social}
          </div>
          {columns.map((column, index) => (
            <div className="gs-footer-col" key={index}>
              <p className="gs-footer-heading">{column.title}</p>
              {column.links.map((link, linkIndex) => {
                const href = linkToHref(link.link);
                return href ? <a className="gs-footer-link" href={href} key={linkIndex}>{link.label}</a> : null;
              })}
            </div>
          ))}
        </div>
        <div className="gs-footer-giant" aria-hidden="true">{businessName}</div>
        <div className="gs-footer-legal">
          {theme?.footer?.copyright || `© ${new Date().getFullYear()} ${businessName}`}
          {showWatermark ? <> · Made with <a href="https://get-on.tech">Get-On</a></> : null}
        </div>
      </footer>
    );
  }

  if (layout === "centered") {
    return (
      <footer className={classes}>
        <div className="gs-footer-centered">
          <p className="gs-footer-name">{businessName}</p>
          {about ? <p className="gs-footer-text">{about}</p> : null}
          {contact}
          {nav.length > 0 ? <nav className="gs-footer-nav" aria-label="Footer menu">{nav.map((item) => <a className="gs-footer-link" href={item.href} key={item.href}>{item.label}</a>)}</nav> : null}
          {social}
          <p className="gs-footer-made">{theme?.footer?.copyright || `© ${new Date().getFullYear()} ${businessName}`}{showWatermark ? <> · Made with <a href="https://get-on.tech">Get-On</a></> : null}</p>
        </div>
      </footer>
    );
  }

  if (layout === "columns") {
    return (
      <footer className={classes}>
        <div className="gs-footer-columns">
          <div className="gs-footer-col">
            <p className="gs-footer-name">{businessName}</p>
            {about ? <p className="gs-footer-text">{about}</p> : null}
            {contact}
          </div>
          <nav className="gs-footer-col" aria-label="Footer menu">
            {nav.map((item) => <a className="gs-footer-link" href={item.href} key={item.href}>{item.label}</a>)}
          </nav>
          {columns.map((column, index) => (
            <div className="gs-footer-col" key={index}>
              <p className="gs-footer-heading">{column.title}</p>
              {column.links.map((link, linkIndex) => {
                const href = linkToHref(link.link);
                return href ? <a className="gs-footer-link" href={href} key={linkIndex}>{link.label}</a> : null;
              })}
            </div>
          ))}
        </div>
        {social}
        <p className="gs-footer-made">{theme?.footer?.copyright || `© ${new Date().getFullYear()} ${businessName}`}{showWatermark ? <> · Made with <a href="https://get-on.tech">Get-On</a></> : null}</p>
      </footer>
    );
  }

  return (
    <footer className={classes}>
      <div className="gs-footer-inner">
        <div className="gs-footer-col">
          <p className="gs-footer-name">{businessName}</p>
          {about ? <p className="gs-footer-text">{about}</p> : null}
          {contact}
        </div>
        {nav.length > 0 ? (
          <nav className="gs-footer-col" aria-label="Footer menu">
            {nav.map((item) => <a className="gs-footer-link" href={item.href} key={item.href}>{item.label}</a>)}
          </nav>
        ) : null}
        {social}
      </div>
      <p className="gs-footer-made">{theme?.footer?.copyright || `© ${new Date().getFullYear()} ${businessName}`}{showWatermark ? <> · Made with <a href="https://get-on.tech">Get-On</a></> : null}</p>
    </footer>
  );
}
