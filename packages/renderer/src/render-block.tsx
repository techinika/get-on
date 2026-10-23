import React from "react";
import { blockSchema, linkToHref, migrateContent, themeTokens, resolveThemeColors } from "@get-on/blocks";
import { Icon } from "./icons";
import { ContactFormBlock, ContactCtaBlock, QuickContactBlock, type FormMode } from "./contact";

export type RenderImage = {
  src: string;
  srcSet?: string;
  width?: number;
  height?: number;
  alt?: string;
};

export type RenderContext = {
  getPageHref?: (pageId: string) => string;
  getImage?: (imageId: string) => RenderImage | null;
  mode?: FormMode;
  contactEnabled?: boolean;
  signToken?: (formId: string) => string;
  pagePath?: string;
  theme?: any;
};

type ParsedBlock = ReturnType<typeof blockSchema.parse>;

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function bestText(hex: string): string {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16)/255, g = parseInt(h.slice(2,4),16)/255, b = parseInt(h.slice(4,6),16)/255;
  const f = (c:number)=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  const lum = 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
  return lum > 0.179 ? '#111111' : '#ffffff';
}

function sectionStyle(sec: any, ctx: RenderContext): React.CSSProperties {
  if (!sec) return {};
  const bg = sec.bg ?? {};
  const image = bg.imageId && ctx.getImage ? ctx.getImage(bg.imageId) : null;
  const overlay = bg.overlayStrength ?? 50;
  let background = '';
  let color: string | undefined;
  if (bg.type === 'soft') {
    background = 'var(--s-soft)';
  } else if (bg.type === 'brand') {
    background = 'var(--s-primary)';
    color = 'var(--s-on-primary)';
  } else if (bg.type === 'accent') {
    background = 'var(--s-accent)';
    color = bestText(bg.color2 ?? '#F5A524');
  } else if (bg.type === 'color') {
    background = bg.color || '#ffffff';
    color = bg.textOn === 'light' ? '#ffffff' : bg.textOn === 'dark' ? '#111111' : bestText(background);
  } else if (bg.type === 'gradient') {
    const c1 = bg.color || '#0B6B4F';
    const c2 = bg.color2 || '#F5A524';
    const angle = bg.angle ?? 135;
    background = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
    color = bg.textOn === 'light' ? '#ffffff' : bg.textOn === 'dark' ? '#111111' : bestText(mix(c1,c2));
  } else if (bg.type === 'image') {
    const ov = bg.overlay === 'dark' ? `rgba(17,17,17,${overlay/100})` : bg.overlay === 'light' ? `rgba(255,255,255,${overlay/100})` : bg.overlay === 'brand' ? `color-mix(in srgb, var(--s-primary) ${overlay}%, transparent)` : 'transparent';
    background = image?.src ? `linear-gradient(${ov}, ${ov}), url(${image.src})` : ov;
    color = bg.textOn === 'light' ? '#ffffff' : bg.textOn === 'dark' ? '#111111' : bg.overlay === 'dark' || bg.overlay === 'brand' ? '#ffffff' : undefined;
    return { backgroundImage: background, backgroundSize: 'cover', backgroundPosition: 'center', color };
  }
  const style: React.CSSProperties = { background };
  if (color) style.color = color;
  return style;
}

function mix(a:string,b:string){ const ah=a.replace('#',''),bh=b.replace('#',''); const ar=parseInt(ah.slice(0,2),16),ag=parseInt(ah.slice(2,4),16),ab=parseInt(ah.slice(4,6),16); const br=parseInt(bh.slice(0,2),16),bg=parseInt(bh.slice(2,4),16),bb=parseInt(bh.slice(4,6),16); const mr=Math.round((ar+br)/2).toString(16).padStart(2,'0'),mg=Math.round((ag+bg)/2).toString(16).padStart(2,'0'),mb=Math.round((ab+bb)/2).toString(16).padStart(2,'0'); return `#${mr}${mg}${mb}`; }

function sectionClass(sec: any): string {
  if (!sec) return 'gs-section';
  const parts = ['gs-section'];
  if (sec.spaceTop === 'small') parts.push('gs-pt-sm'); else if (sec.spaceTop === 'large') parts.push('gs-pt-lg'); else if (sec.spaceTop === 'xlarge') parts.push('gs-pt-xl');
  if (sec.spaceBottom === 'small') parts.push('gs-pb-sm'); else if (sec.spaceBottom === 'large') parts.push('gs-pb-lg'); else if (sec.spaceBottom === 'xlarge') parts.push('gs-pb-xl');
  if (sec.width === 'narrow') parts.push('gs-w-narrow'); else if (sec.width === 'wide') parts.push('gs-w-wide'); else if (sec.width === 'full') parts.push('gs-w-full');
  if (Array.isArray(sec.hideOn)) {
    if (sec.hideOn.includes('phone')) parts.push('gs-hide-phone');
    if (sec.hideOn.includes('tablet')) parts.push('gs-hide-tablet');
    if (sec.hideOn.includes('computer')) parts.push('gs-hide-computer');
  }
  return parts.join(' ');
}

function innerClass(sec: any, align?: string): string {
  const parts = ['gs-inner'];
  if (align === 'center') parts.push('gs-align-center');
  if (sec?.width === 'full') parts.push('gs-inner-full');
  return parts.join(' ');
}

function Gallery({ items, columns, ctx }: { items: any[]; columns: number; ctx: RenderContext }) {
  const images = items
    .map((item) => {
      const id = typeof item === 'string' ? item : item?.imageId;
      const image = id && ctx.getImage ? ctx.getImage(id) : null;
      return image ? { image, caption: typeof item === 'object' ? item.caption : '' } : null;
    })
    .filter(Boolean) as any[];
  if (images.length === 0) return null;
  const cols = Math.min(Math.max(columns, 2), 4);
  return (
    <div className={`gs-gallery gs-grid-${cols}`}>
      {images.map((entry, index) => (
        <figure key={index} className="gs-gallery-item">
          <img className="gs-img" src={entry.image.src} srcSet={entry.image.srcSet} sizes="(min-width:900px) 30vw,(min-width:640px) 45vw,100vw" width={entry.image.width} height={entry.image.height} alt={entry.image.alt ?? entry.caption ?? ''} loading="lazy" decoding="async" />
          {entry.caption ? <figcaption className="gs-caption">{entry.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

function normalize(block: unknown): unknown {
  if (!block || typeof block !== 'object') return block;
  const b = block as any;
  if (b.type === 'contact-cta') {
    const migrated = migrateContent([b]);
    return migrated.blocks[0] ?? b;
  }
  if (b.type === 'gallery' && Array.isArray(b.props?.imageIds)) {
    const migrated = migrateContent([b]);
    return migrated.blocks[0] ?? b;
  }
  if (b.type === 'contact-form' && b.props?.hours && !b.props?.hoursNote) {
    return { ...b, props: { ...b.props, hoursNote: b.props.hours } };
  }
  return b;
}

function getBlockId(block: unknown): string | undefined {
  return block && typeof block === 'object' && typeof (block as any).id === 'string' ? (block as any).id : undefined;
}

export function RenderBlock({ block, ctx = {} }: { block: unknown; ctx?: RenderContext }) {
  const raw = normalize(block);
  const parsed = blockSchema.safeParse(raw);
  if (!parsed.success) return null;
  const b = parsed.data as ParsedBlock;
  const rawId = getBlockId(raw);
  const sec = (b as any).sec ?? {};
  const sClass = sectionClass(sec);
  const sStyle = sectionStyle(sec, ctx);

  switch (b.type) {
    case 'shared':
      return null;

    case 'spacer': {
      const height = b.props.height === 'small' ? 24 : b.props.height === 'large' ? 96 : 48;
      return <div className={sClass} style={sStyle}><div className={innerClass(sec)}><div className="gs-spacer" style={{ height }} aria-hidden="true" /></div></div>;
    }
    case 'divider': {
      const style = b.props.style === 'dots' ? 'dots' : b.props.style === 'short' ? 'short' : 'line';
      return <div className={sClass} style={sStyle}><div className={innerClass(sec)}><div className={`gs-divider gs-divider-${style}`} role="separator" /></div></div>;
    }

    case 'hero': {
      const buttonHref = linkToHref(b.props.buttonLink, { getPageHref: ctx.getPageHref });
      const button2Href = linkToHref(b.props.button2Link, { getPageHref: ctx.getPageHref });
      const image = b.props.imageId && ctx.getImage ? ctx.getImage(b.props.imageId) : null;
      const layout = b.props.layout ?? 'text-only';
      const align = (b.props as any).align ?? 'left';
      return (
        <section className={`${sClass} gs-hero gs-hero-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={`${innerClass(sec, align)} gs-hero-inner`}>
            <div className={`gs-hero-text ${align === 'center' ? 'gs-align-center' : ''}`}>
              {b.props.eyebrow ? <p className="gs-eyebrow">{b.props.eyebrow}</p> : null}
              <h1 className="gs-hero-title">{b.props.heading}</h1>
              {b.props.subheading ? <p className="gs-hero-sub">{b.props.subheading}</p> : null}
              {(buttonHref && b.props.buttonLabel) || (button2Href && b.props.button2Label) ? (
                <div className="gs-btn-row">
                  {buttonHref && b.props.buttonLabel ? <a className="gs-btn gs-btn-solid" href={buttonHref}>{b.props.buttonLabel}</a> : null}
                  {button2Href && b.props.button2Label ? <a className="gs-btn gs-btn-outline" href={button2Href}>{b.props.button2Label}</a> : null}
                </div>
              ) : null}
              {Array.isArray(b.props.highlights) && b.props.highlights.length ? (
                <ul className="gs-highlights">{b.props.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
              ) : null}
            </div>
            {image && layout !== 'text-only' ? (
              <div className="gs-hero-media"><img className="gs-img" src={image.src} srcSet={image.srcSet} sizes="(min-width:900px)45vw,100vw" width={image.width} height={image.height} alt={image.alt ?? ''} loading="lazy" decoding="async" /></div>
            ) : null}
          </div>
        </section>
      );
    }

    case 'heading': {
      const Tag = b.props.level === 'h1' ? 'h1' : b.props.level === 'h3' ? 'h3' : 'h2';
      const align = (b.props as any).align ?? 'left';
      return (
        <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, align)}>
            {b.props.eyebrow ? <p className="gs-eyebrow">{b.props.eyebrow}</p> : null}
            <Tag className={Tag === 'h1' ? 'gs-h1' : Tag === 'h3' ? 'gs-h3' : 'gs-h2'}>{b.props.text}</Tag>
          </div>
        </section>
      );
    }

    case 'text': {
      const align = (b.props as any).align ?? 'left';
      const body = textOf(b.props.content);
      const cls = b.props.size === 'large' ? 'gs-p gs-p-large' : 'gs-p';
      return (
        <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={`${innerClass(sec, align)} gs-text-cols-${b.props.columns ?? 1}`}>
            <p className={cls}>{body}</p>
          </div>
        </section>
      );
    }

    case 'image': {
      const image = b.props.imageId && ctx.getImage ? ctx.getImage(b.props.imageId) : null;
      if (!image) return null;
      const align = (b.props as any).align ?? 'left';
      const linkHref = linkToHref(b.props.link, { getPageHref: ctx.getPageHref });
      const size = b.props.size ?? 'medium';
      const inner = <figure className={`gs-figure gs-figure-${size} ${b.props.rounded ? 'gs-figure-rounded' : ''}`}><img className="gs-img" src={image.src} srcSet={image.srcSet} sizes="(min-width:900px)720px,100vw" width={image.width} height={image.height} alt={b.props.alt || image.alt || ''} loading="lazy" decoding="async" />{b.props.caption ? <figcaption className="gs-caption">{b.props.caption}</figcaption> : null}</figure>;
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, align)}>{linkHref ? <a href={linkHref}>{inner}</a> : inner}</div></section>;
    }

    case 'image-text': {
      const image = b.props.imageId && ctx.getImage ? ctx.getImage(b.props.imageId) : null;
      const align = (b.props as any).align ?? 'left';
      const buttonHref = linkToHref(b.props.buttonLink, { getPageHref: ctx.getPageHref });
      const button2Href = linkToHref(b.props.button2Link, { getPageHref: ctx.getPageHref });
      const pos = b.props.imagePosition === 'left' ? 'gs-it-left' : 'gs-it-right';
      const ratio = b.props.ratio ?? '4:3';
      return (
        <section className={`${sClass} gs-image-text ${pos}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, align)}>
            <div className={`gs-it-media gs-it-${ratio.replace(':','-')}`}>
              {image ? <img className="gs-img" src={image.src} srcSet={image.srcSet} sizes="(min-width:900px)45vw,100vw" width={image.width} height={image.height} alt={image.alt ?? ''} loading="lazy" decoding="async" /> : null}
            </div>
            <div className="gs-it-text">
              {b.props.badge ? <span className="gs-badge">{b.props.badge}</span> : null}
              {b.props.eyebrow ? <p className="gs-eyebrow">{b.props.eyebrow}</p> : null}
              <h2 className="gs-h2">{b.props.heading}</h2>
              {b.props.text ? <p className="gs-p">{textOf(b.props.text)}</p> : null}
              <div className="gs-btn-row">
                {buttonHref && b.props.buttonLabel ? <a className="gs-btn gs-btn-solid" href={buttonHref}>{b.props.buttonLabel}</a> : null}
                {button2Href && b.props.button2Label ? <a className="gs-btn gs-btn-outline" href={button2Href}>{b.props.button2Label}</a> : null}
              </div>
            </div>
          </div>
        </section>
      );
    }

    case 'gallery':
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<Gallery items={b.props.items ?? []} columns={b.props.columns ?? 3} ctx={ctx} /></div></section>;

    case 'features': {
      return (
        <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <div className={`gs-features gs-grid-${b.props.columns === 2 ? 2 : b.props.columns === 4 ? 4 : 3}`}>
              {(b.props.items ?? []).map((item: any, index: number) => {
                const href = linkToHref(item.link, { getPageHref: ctx.getPageHref });
                const card = <div className="gs-feature"><span className="gs-feature-icon"><Icon name={item.icon ?? 'star'} size={24} /></span><h3 className="gs-feature-title">{item.title}</h3><p className="gs-feature-text">{item.text}</p></div>;
                return href ? <a key={index} href={href} className="gs-card-link">{card}</a> : <div key={index}>{card}</div>;
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'services': {
      return (
        <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <div className="gs-services">
              {(b.props.items ?? []).map((item: any, index: number) => {
                const href = linkToHref(item.link, { getPageHref: ctx.getPageHref });
                const row = <div className="gs-service"><div><h3 className="gs-service-title">{item.title}</h3>{item.description ? <p className="gs-service-text">{item.description}</p> : null}</div><div className="gs-service-price">{item.price}</div></div>;
                return href ? <a key={index} href={href} className="gs-card-link">{row}</a> : <div key={index}>{row}</div>;
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'faq': {
      return (
        <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            <div className="gs-faq">
              {(b.props.items ?? []).map((item: any, index: number) => (
                <details className="gs-faq-item" key={index} open={b.props.openFirst && index === 0 ? true : undefined}>
                  <summary className="gs-faq-question">{item.question}</summary>
                  <p className="gs-faq-answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'cta': {
      const p = linkToHref(b.props.primaryLink, { getPageHref: ctx.getPageHref });
      const sLink = linkToHref(b.props.secondaryLink, { getPageHref: ctx.getPageHref });
      return (
        <section className={`${sClass} gs-cta gs-cta-${b.props.layout ?? 'strip'}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, b.props.align ?? 'center')}>
            {b.props.eyebrow ? <p className="gs-eyebrow">{b.props.eyebrow}</p> : null}
            <h2 className="gs-h2">{b.props.heading}</h2>
            {b.props.text ? <p className="gs-p">{b.props.text}</p> : null}
            <div className="gs-btn-row">
              {p && b.props.primaryLabel ? <a className="gs-btn gs-btn-solid" href={p}>{b.props.primaryLabel}</a> : null}
              {sLink && b.props.secondaryLabel ? <a className="gs-btn gs-btn-outline" href={sLink}>{b.props.secondaryLabel}</a> : null}
            </div>
          </div>
        </section>
      );
    }

    case 'button': {
      const href = linkToHref(b.props.link, { getPageHref: ctx.getPageHref });
      if (!href || !b.props.label) return null;
      const cls = b.props.style === 'outline' ? 'gs-btn gs-btn-outline' : b.props.style === 'soft' ? 'gs-btn gs-btn-soft' : 'gs-btn gs-btn-solid';
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={`${innerClass(sec, (b.props as any).align ?? 'left')} gs-btn-wrap`}><a className={`${cls} ${b.props.fullWidth ? 'gs-btn-full' : ''}`} href={href}>{b.props.label}</a></div></section>;
    }

    case 'quick-contact':
      if (ctx.contactEnabled === false) return null;
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}><QuickContactBlock props={b.props as any} /></div></section>;
    case 'contact-details': {
      const mapHref = b.props.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.props.address)}` : null;
      const items: any[] = [];
      if (b.props.phone) items.push({ icon: 'phone', text: b.props.phone, href: `tel:${b.props.phone.replace(/[^+\d]/g,'')}` });
      if (b.props.email) items.push({ icon: 'mail', text: b.props.email, href: `mailto:${b.props.email}` });
      if (b.props.address) items.push({ icon: 'map-pin', text: b.props.address });
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<ul className="gs-contact">{items.map((it, i) => <li className="gs-contact-item" key={i}><Icon name={it.icon} size={20} />{it.href ? <a href={it.href}>{it.text}</a> : <span>{it.text}</span>}</li>)}</ul>{b.props.showMapLink && mapHref ? <div className="gs-btn-wrap"><a className="gs-btn gs-btn-outline" href={mapHref} rel="noopener noreferrer" target="_blank">Find us on the map</a></div> : null}</div></section>;
    }
    case 'social-links': {
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}><ul className="gs-social">{(b.props.items ?? []).filter((x:any)=>x.url).map((item:any,i:number)=><li key={i}><a className="gs-social-link" href={item.url} rel="noopener noreferrer" target="_blank">{item.network}</a></li>)}</ul></div></section>;
    }
    case 'contact-form': {
      if (ctx.contactEnabled === false) return null;
      const blockId = rawId;
      const formId = blockId && /^[A-Za-z0-9_-]{6,32}$/.test(blockId) ? blockId : undefined;
      const mode: FormMode = ctx.mode ?? 'editor';
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}><ContactFormBlock props={b.props as Record<string, any>} ctx={ctx} mode={mode} formId={formId} token={mode === 'live' && formId && ctx.signToken ? ctx.signToken(formId) : undefined} pagePath={ctx.pagePath} /></div></section>;
    }
    case 'opening-hours':
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<div className="gs-hours">[Hours]</div></div></section>;
    case 'map':
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<div className="gs-map">[Map]</div></div></section>;
    case 'video':
    case 'before-after':
    case 'products':
    case 'menu':
    case 'pricing':
    case 'projects':
    case 'testimonials':
    case 'team':
    case 'stats':
    case 'logos':
    case 'steps':
    case 'quote':
    case 'link-list':
    case 'downloads':
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}><div className="gs-placeholder">{b.type}</div></div></section>;

    default:
      return null;
  }
}
