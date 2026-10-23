import React from "react";

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
};

export function SiteHeader({
  businessName,
  logoUrl,
  nav = [],
  watermark = true,
}: SiteHeaderProps) {
  return (
    <header className="gs-header">
      <div className="gs-header-inner">
        <a className="gs-brand" href="/">
          {logoUrl ? (
            <img
              className="gs-logo"
              src={logoUrl}
              alt=""
              width={40}
              height={40}
            />
          ) : (
            <span className="gs-logo gs-logo-letter" aria-hidden="true">
              {businessName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="gs-brand-name">{businessName}</span>
        </a>
        {nav.length > 0 ? (
          <nav className="gs-nav" aria-label="Main menu">
            {nav.map((item) => (
              <a className="gs-nav-link" href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
      {watermark ? <p className="gs-watermark">Built with Get-On</p> : null}
    </header>
  );
}

export type SiteFooterProps = {
  businessName: string;
  phone?: string;
  email?: string;
  address?: string;
  nav?: SiteNavItem[];
  showWatermark?: boolean;
};

export function SiteFooter({
  businessName,
  phone,
  email,
  address,
  nav = [],
  showWatermark = true,
}: SiteFooterProps) {
  return (
    <footer className="gs-footer">
      <div className="gs-footer-inner">
        <div className="gs-footer-col">
          <p className="gs-footer-name">{businessName}</p>
          {address ? <p className="gs-footer-text">{address}</p> : null}
          {phone ? (
            <p className="gs-footer-text">
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>
            </p>
          ) : null}
          {email ? (
            <p className="gs-footer-text">
              <a href={`mailto:${email}`}>{email}</a>
            </p>
          ) : null}
        </div>
        {nav.length > 0 ? (
          <nav className="gs-footer-col" aria-label="Footer menu">
            {nav.map((item) => (
              <a className="gs-footer-link" href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
      {showWatermark ? (
        <p className="gs-footer-made">
          Made with <a href="https://get-on.tech">Get-On</a>
        </p>
      ) : null}
    </footer>
  );
}
