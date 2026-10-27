import React from "react";
import { blockSchema, linkToHref, migrateContent } from "@get-on/blocks";
import { Icon } from "./icons";
import { ContactFormBlock, QuickContactBlock, type FormMode } from "./contact";

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
  hours?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  socialLinks?: { network: string; url: string }[];
};

type ParsedBlock = ReturnType<typeof blockSchema.parse>;

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text ?? "");
      return "";
    }).join("");
  }
  if (content && typeof content === "object" && "content" in content) return textOf((content as { content?: unknown }).content);
  return "";
}

function bestText(hex: string): string {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16)/255, g = parseInt(h.slice(2,4),16)/255, b = parseInt(h.slice(4,6),16)/255;
  const f = (c:number)=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  const lum = 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
  return lum > 0.179 ? '#111111' : '#ffffff';
}

function mix(a:string,b:string){ const ah=a.replace('#',''),bh=b.replace('#',''); const ar=parseInt(ah.slice(0,2),16),ag=parseInt(ah.slice(2,4),16),ab=parseInt(ah.slice(4,6),16); const br=parseInt(bh.slice(0,2),16),bg=parseInt(bh.slice(2,4),16),bb=parseInt(bh.slice(4,6),16); const mr=Math.round((ar+br)/2).toString(16).padStart(2,'0'),mg=Math.round((ag+bg)/2).toString(16).padStart(2,'0'),mb=Math.round((ab+bb)/2).toString(16).padStart(2,'0'); return `#${mr}${mg}${mb}`; }

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
    color = 'var(--s-on-accent)';
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

function sectionClass(sec: any): string {
  if (!sec) return 'gs-section';
  const parts = ['gs-section'];
  if (sec.spaceTop === 'small') parts.push('gs-pt-sm'); else if (sec.spaceTop === 'large') parts.push('gs-pt-lg'); else if (sec.spaceTop === 'xlarge') parts.push('gs-pt-xl'); else if (sec.spaceTop === 'none') parts.push('gs-pt-none');
  if (sec.spaceBottom === 'small') parts.push('gs-pb-sm'); else if (sec.spaceBottom === 'large') parts.push('gs-pb-lg'); else if (sec.spaceBottom === 'xlarge') parts.push('gs-pb-xl'); else if (sec.spaceBottom === 'none') parts.push('gs-pb-none');
  if (sec.width === 'narrow') parts.push('gs-w-narrow'); else if (sec.width === 'wide') parts.push('gs-w-wide'); else if (sec.width === 'full') parts.push('gs-w-full');
  if (Array.isArray(sec.hideOn)) {
    if (sec.hideOn.includes('phone')) parts.push('gs-hide-phone');
    if (sec.hideOn.includes('tablet')) parts.push('gs-hide-tablet');
    if (sec.hideOn.includes('computer')) parts.push('gs-hide-computer');
  }
  const shape = sec.shape ?? {};
  if (shape.top && shape.top !== 'none') parts.push(`gs-shape-top-${shape.top}`);
  if (shape.bottom && shape.bottom !== 'none') parts.push(`gs-shape-bottom-${shape.bottom}`);
  if (sec.pattern && sec.pattern !== 'none') parts.push(`gs-pattern-${sec.pattern}`);
  if (sec.rule && sec.rule !== 'none') parts.push(`gs-rule-${sec.rule}`);
  return parts.join(' ');
}

function innerClass(sec: any, align?: string): string {
  const parts = ['gs-inner'];
  if (align === 'center') parts.push('gs-align-center');
  if (sec?.width === 'full') parts.push('gs-inner-full');
  return parts.join(' ');
}

function normalize(block: unknown): unknown {
  if (!block || typeof block !== 'object') return block;
  const b = block as any;
  const needsMigration =
    b.type === 'contact-cta' ||
    !b.sec ||
    (b.type === 'gallery' && Array.isArray(b.props?.imageIds)) ||
    (b.type === 'hero' && ['text-only', 'image-right', 'image-left', 'image-background'].includes(String(b.props?.layout))) ||
    (b.type === 'contact-form' && b.props?.hours && !b.props?.hoursNote);
  if (needsMigration) {
    const migrated = migrateContent([b]);
    return migrated.blocks[0] ?? b;
  }
  return b;
}

function getBlockId(block: unknown): string | undefined {
  return block && typeof block === 'object' && typeof (block as any).id === 'string' ? (block as any).id : undefined;
}

function Image({ image, className = 'gs-img', sizes = '(min-width:900px) 45vw,100vw', alt }: { image: RenderImage; className?: string; sizes?: string; alt?: string }) {
  return <img className={className} src={image.src} srcSet={image.srcSet} sizes={sizes} width={image.width} height={image.height} alt={alt ?? image.alt ?? ''} loading="lazy" decoding="async" />;
}

function Gallery({ items, columns, layout, ctx }: { items: any[]; columns: number; layout?: string; ctx: RenderContext }) {
  const images = items.map((item) => {
    const id = typeof item === 'string' ? item : item?.imageId;
    const image = id && ctx.getImage ? ctx.getImage(id) : null;
    return image ? { image, caption: typeof item === 'object' ? item.caption : '' } : null;
  }).filter(Boolean) as any[];
  if (images.length === 0) return null;
  const cols = Math.min(Math.max(columns, 2), 4);
  const cls = layout === 'mosaic' ? 'gs-gallery gs-gallery-mosaic' : layout === 'filmstrip' ? 'gs-gallery gs-gallery-filmstrip' : `gs-gallery gs-grid-${cols}`;
  return (
    <div className={cls}>
      {images.map((entry, index) => (
        <figure key={index} className="gs-gallery-item">
          <Image image={entry.image} sizes="(min-width:900px) 30vw,(min-width:640px) 45vw,100vw" alt={entry.caption || entry.image.alt} />
          {entry.caption ? <figcaption className="gs-caption">{entry.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

function Arrow() {
  return <svg className="gs-arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
  const includeIf = (b as any).includeIf ?? (b.props as any)?.includeIf;
  if (includeIf) {
    const value = {
      phone: ctx.phone,
      email: ctx.email,
      address: ctx.address,
      hours: ctx.hours,
      social: ctx.socialLinks?.length,
      logo: false,
      description: true,
      tagline: true,
      city: true,
      areaServed: true,
    }[includeIf as string];
    if (!value) return null;
  }

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
      return <Hero block={b} sec={sec} sClass={sClass} sStyle={sStyle} rawId={rawId} ctx={ctx} />;
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
      const inner = <figure className={`gs-figure gs-figure-${size} ${b.props.rounded ? 'gs-figure-rounded' : ''}`}><Image image={image} sizes="(min-width:900px)720px,100vw" alt={b.props.alt || image.alt} />{b.props.caption ? <figcaption className="gs-caption">{b.props.caption}</figcaption> : null}</figure>;
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, align)}>{linkHref ? <a href={linkHref}>{inner}</a> : inner}</div></section>;
    }

    case 'image-text': {
      const image = b.props.imageId && ctx.getImage ? ctx.getImage(b.props.imageId) : null;
      const align = (b.props as any).align ?? 'left';
      const buttonHref = linkToHref(b.props.buttonLink, { getPageHref: ctx.getPageHref });
      const button2Href = linkToHref(b.props.button2Link, { getPageHref: ctx.getPageHref });
      const pos = b.props.imagePosition === 'left' ? 'gs-it-left' : 'gs-it-right';
      const ratio = b.props.ratio ?? '4:3';
      const layout = b.props.layout ?? 'standard';
      return (
        <section className={`${sClass} gs-image-text ${pos} gs-it-layout-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, align)}>
            <div className={`gs-it-media gs-it-${ratio.replace(':','-')} gs-img-style-${b.props.imageStyle ?? 'rounded'}`}>
              {image ? <Image image={image} sizes="(min-width:900px)45vw,100vw" /> : null}
            </div>
            <div className="gs-it-text gs-card-surface">
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
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<Gallery items={b.props.items ?? []} columns={b.props.columns ?? 3} layout={b.props.layout} ctx={ctx} /></div></section>;

    case 'features': {
      const layout = b.props.layout ?? 'cards';
      const items = b.props.items ?? [];
      return (
        <section className={`${sClass} gs-features-section gs-features-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <div className={`gs-features gs-features-${layout} gs-grid-${b.props.columns === 2 ? 2 : b.props.columns === 4 ? 4 : 3}`}>
              {items.map((item: any, index: number) => {
                const href = linkToHref(item.link, { getPageHref: ctx.getPageHref });
                const card = (
                  <div className={`gs-feature gs-feature-${layout}`}>
                    {layout === 'rows' ? <span className="gs-feature-number">{String(index + 1).padStart(2, '0')}</span> : <span className="gs-feature-icon"><Icon name={item.icon ?? 'star'} size={24} /></span>}
                    <div>
                      <h3 className="gs-feature-title">{item.title}</h3>
                      <p className="gs-feature-text">{item.text}</p>
                    </div>
                  </div>
                );
                return href ? <a key={index} href={href} className="gs-card-link">{card}</a> : <div key={index}>{card}</div>;
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'services': {
      const layout = b.props.layout ?? 'list';
      return (
        <section className={`${sClass} gs-services-section gs-services-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <div className={`gs-services gs-services-${layout}`}>
              {(b.props.items ?? []).map((item: any, index: number) => {
                const href = linkToHref(item.link, { getPageHref: ctx.getPageHref });
                const image = item.imageId && ctx.getImage ? ctx.getImage(item.imageId) : null;
                const row = (
                  <div className="gs-service">
                    {layout === 'cards-image' ? <div className="gs-service-image">{image ? <Image image={image} sizes="(min-width:900px)30vw,100vw" /> : null}{item.price ? <span className="gs-price-pill">{item.price}</span> : null}</div> : null}
                    {layout === 'columns-rules' ? <span className="gs-service-index">{String(index + 1).padStart(2, '0')}</span> : <span className="gs-service-icon"><Icon name={item.icon ?? 'star'} size={20} /></span>}
                    <div className="gs-service-body"><h3 className="gs-service-title">{item.title}</h3>{item.description ? <p className="gs-service-text">{item.description}</p> : null}{item.linkLabel ? <span className="gs-service-link">{item.linkLabel}<Arrow /></span> : null}</div>
                    {layout !== 'cards-image' && item.price ? <div className="gs-service-price">{item.price}</div> : null}
                  </div>
                );
                return href ? <a key={index} href={href} className="gs-card-link">{row}</a> : <div key={index}>{row}</div>;
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'products': {
      const layout = b.props.layout ?? 'grid';
      return (
        <section className={`${sClass} gs-products-section gs-products-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <div className={`gs-products gs-products-${layout} gs-grid-${b.props.columns === 2 ? 2 : b.props.columns === 4 ? 4 : 3}`}>
              {(b.props.items ?? []).map((item: any, index: number) => {
                const image = item.imageId && ctx.getImage ? ctx.getImage(item.imageId) : null;
                const href = linkToHref(item.link, { getPageHref: ctx.getPageHref });
                const card = (
                  <div className="gs-product">
                    <div className={`gs-product-image gs-ratio-${(b.props.ratio ?? '1:1').replace(':','-')}`}>{image ? <Image image={image} sizes="(min-width:900px)25vw,50vw" /> : null}{item.badge ? <span className="gs-badge gs-product-badge">{item.badge}</span> : null}</div>
                    <div className="gs-product-body"><h3 className="gs-product-title">{item.title}</h3>{item.description ? <p className="gs-product-text">{item.description}</p> : null}<div className="gs-product-price">{item.oldPrice ? <s>{item.oldPrice}</s> : null}{item.price}</div></div>
                  </div>
                );
                return href ? <a key={index} href={href} className="gs-card-link">{card}</a> : <div key={index}>{card}</div>;
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'menu': {
      const board = b.props.layout === 'board';
      return (
        <section className={`${sClass} gs-menu-section ${board ? 'gs-menu-board' : ''}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.note ? <p className="gs-p">{b.props.note}</p> : null}
            <div className={`gs-menu ${b.props.layout === 'two-columns' || board ? 'gs-menu-two' : ''}`}>
              {(b.props.sections ?? []).map((section: any, sectionIndex: number) => (
                <div className="gs-menu-group" key={sectionIndex}>
                  <h3 className="gs-menu-title">{section.title}</h3>
                  {section.note ? <p className="gs-menu-note">{section.note}</p> : null}
                  <ul className="gs-menu-list">
                    {(section.items ?? []).map((item: any, itemIndex: number) => (
                      <li className="gs-menu-item" key={itemIndex}><span className="gs-menu-name">{item.name}{item.description ? <span className="gs-menu-desc">{item.description}</span> : null}</span><span className={`gs-menu-price ${b.props.leaders ? 'gs-menu-leaders' : ''}`}>{item.price}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case 'pricing': {
      return (
        <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'center')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <div className="gs-pricing">
              {(b.props.plans ?? []).map((plan: any, index: number) => {
                const href = linkToHref(plan.buttonLink, { getPageHref: ctx.getPageHref });
                return (
                  <div className={`gs-plan ${plan.highlighted ? 'gs-plan-highlighted' : ''}`} key={index}>
                    {plan.highlighted ? <span className="gs-plan-flag">{b.props.highlightLabel}</span> : null}
                    <h3 className="gs-plan-name">{plan.name}</h3>
                    <p className="gs-plan-price">{plan.price}<span>{plan.period}</span></p>
                    {plan.description ? <p className="gs-plan-text">{plan.description}</p> : null}
                    <ul className="gs-plan-features">{(plan.features ?? []).map((feature: string, featureIndex: number) => <li key={featureIndex}>{feature}</li>)}</ul>
                    {href && plan.buttonLabel ? <a className="gs-btn gs-btn-solid" href={href}>{plan.buttonLabel}</a> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'projects': {
      const layout = b.props.layout ?? 'grid';
      return (
        <section className={`${sClass} gs-projects-section gs-projects-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <div className={`gs-projects gs-projects-${layout} gs-grid-${b.props.columns === 2 ? 2 : 3}`}>
              {(b.props.items ?? []).map((item: any, index: number) => {
                const image = item.imageId && ctx.getImage ? ctx.getImage(item.imageId) : null;
                const href = linkToHref(item.link, { getPageHref: ctx.getPageHref });
                const card = (
                  <div className="gs-project">
                    {layout !== 'list' && image ? <div className="gs-project-image"><Image image={image} sizes="(min-width:900px)30vw,100vw" /></div> : null}
                    <div className="gs-project-body">{item.category ? <p className="gs-eyebrow">{item.category}</p> : null}<h3 className="gs-project-title">{item.title}</h3>{item.description ? <p className="gs-project-text">{item.description}</p> : null}{item.result ? <p className="gs-project-result">{item.result}</p> : null}</div>
                    {layout === 'list' && image ? <div className="gs-project-thumb"><Image image={image} sizes="120px" /></div> : null}
                    <Arrow />
                  </div>
                );
                return href ? <a key={index} href={href} className="gs-card-link">{card}</a> : <div key={index}>{card}</div>;
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'testimonials': {
      const layout = b.props.layout ?? 'cards';
      return (
        <section className={`${sClass} gs-testimonials-section gs-testimonials-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            <div className={`gs-testimonials gs-testimonials-${layout}`}>
              {(b.props.items ?? []).map((item: any, index: number) => {
                const photo = item.photoId && ctx.getImage ? ctx.getImage(item.photoId) : null;
                return (
                  <figure className="gs-testimonial" key={index}>
                    <blockquote className="gs-testimonial-quote">{item.quote}</blockquote>
                    <figcaption className="gs-testimonial-person">
                      {photo ? <Image image={photo} className="gs-avatar" sizes="48px" /> : null}
                      <span><span className="gs-testimonial-name">{item.name}</span>{item.role ? <span className="gs-testimonial-role">{item.role}</span> : null}</span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'team': {
      return (
        <section className={`${sClass} gs-team-section gs-team-${b.props.layout ?? 'grid'}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <div className={`gs-team gs-team-${b.props.layout ?? 'grid'} gs-grid-${b.props.columns === 2 ? 2 : b.props.columns === 4 ? 4 : 3}`}>
              {(b.props.items ?? []).map((item: any, index: number) => {
                const photo = item.photoId && ctx.getImage ? ctx.getImage(item.photoId) : null;
                return (
                  <div className="gs-person" key={index}>
                    <div className={`gs-person-photo gs-person-${b.props.photoStyle ?? 'square'}`}>{photo ? <Image image={photo} sizes="(min-width:900px)25vw,50vw" /> : null}</div>
                    <h3 className="gs-person-name">{item.name}</h3>
                    {item.role ? <p className="gs-person-role">{item.role}</p> : null}
                    {item.bio ? <p className="gs-person-bio">{item.bio}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    case 'stats': {
      const layout = b.props.layout ?? 'row';
      return (
        <section className={`${sClass} gs-stats-section gs-stats-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            <div className={`gs-stats gs-stats-${layout}`}>
              {(b.props.items ?? []).map((item: any, index: number) => <div className="gs-stat" key={index}><span className="gs-stat-value">{item.value}</span><span className="gs-stat-label">{item.label}</span></div>)}
            </div>
          </div>
        </section>
      );
    }

    case 'logos': {
      return (
        <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'center')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            <ul className={`gs-logos ${b.props.grayscale ? 'gs-logos-grey' : ''}`}>
              {(b.props.items ?? []).map((item: any, index: number) => {
                const image = item.imageId && ctx.getImage ? ctx.getImage(item.imageId) : null;
                return <li key={index}>{image ? <Image image={image} className="gs-logo-image" sizes="160px" alt={item.name} /> : <span>{item.name}</span>}</li>;
              })}
            </ul>
          </div>
        </section>
      );
    }

    case 'steps': {
      const layout = b.props.layout ?? 'horizontal';
      return (
        <section className={`${sClass} gs-steps-section gs-steps-${layout}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            {b.props.intro ? <p className="gs-p">{b.props.intro}</p> : null}
            <ol className={`gs-steps gs-steps-${layout}`}>
              {(b.props.items ?? []).map((item: any, index: number) => (
                <li className="gs-step" key={index}><span className="gs-step-number">{String(index + 1).padStart(2, '0')}</span><div><h3 className="gs-step-title">{item.title}</h3><p className="gs-step-text">{item.text}</p></div></li>
              ))}
            </ol>
          </div>
        </section>
      );
    }

    case 'faq': {
      return (
        <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, (b.props as any).align ?? 'left')}>
            {b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}
            <div className={`gs-faq gs-faq-cols-${b.props.columns ?? 1}`}>
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
            <div className="gs-cta-copy">
              {b.props.eyebrow ? <p className="gs-eyebrow">{b.props.eyebrow}</p> : null}
              <h2 className="gs-h2">{b.props.heading}</h2>
              {b.props.text ? <p className="gs-p">{b.props.text}</p> : null}
            </div>
            <div className="gs-btn-row">
              {p && b.props.primaryLabel ? <a className="gs-btn gs-btn-solid" href={p}>{b.props.primaryLabel}</a> : null}
              {sLink && b.props.secondaryLabel ? <a className="gs-btn gs-btn-outline" href={sLink}>{b.props.secondaryLabel}</a> : null}
            </div>
          </div>
        </section>
      );
    }

    case 'quote': {
      const align = (b.props as any).align ?? 'left';
      const big = b.props.style === 'big';
      return (
        <section className={`${sClass} gs-quote ${big ? 'gs-quote-big' : 'gs-quote-plain'}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}>
          <div className={innerClass(sec, align)}>
            <blockquote className="gs-quote-text">
              <p>{b.props.text}</p>
              {b.props.author ? <footer className="gs-quote-author"><cite>{b.props.author}</cite>{b.props.role ? <span> · {b.props.role}</span> : null}</footer> : null}
            </blockquote>
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
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}><QuickContactBlock props={{ phone: ctx.phone ?? undefined, email: ctx.email ?? undefined, ...(b.props as any) }} /></div></section>;

    case 'contact-details': {
      const address = b.props.address || ctx.address || '';
      const mapHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
      const items: any[] = [];
      if (b.props.phone) items.push({ icon: 'phone', text: b.props.phone, href: `tel:${b.props.phone.replace(/[^+\d]/g,'')}` });
      if (b.props.email) items.push({ icon: 'mail', text: b.props.email, href: `mailto:${b.props.email}` });
      if (address) items.push({ icon: 'map-pin', text: address });
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<ul className="gs-contact">{items.map((it, i) => <li className="gs-contact-item" key={i}><Icon name={it.icon} size={20} />{it.href ? <a href={it.href}>{it.text}</a> : <span>{it.text}</span>}</li>)}</ul>{b.props.showMapLink && mapHref ? <div className="gs-btn-wrap"><a className="gs-btn gs-btn-outline" href={mapHref} rel="noopener noreferrer" target="_blank">Find us on the map</a></div> : null}</div></section>;
    }
    case 'social-links': {
      const items = b.props.source === 'site' ? (ctx.socialLinks ?? []) : (b.props.items ?? []);
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}><ul className="gs-social">{items.filter((x:any)=>x.url).map((item:any,i:number)=><li key={i}><a className="gs-social-link" href={item.url} rel="noopener noreferrer" target="_blank">{item.network}</a></li>)}</ul></div></section>;
    }
    case 'contact-form': {
      if (ctx.contactEnabled === false) return null;
      const blockId = rawId;
      const formId = blockId && /^[A-Za-z0-9_-]{6,32}$/.test(blockId) ? blockId : undefined;
      const mode: FormMode = ctx.mode ?? 'editor';
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}><ContactFormBlock props={b.props as Record<string, any>} ctx={ctx} mode={mode} formId={formId} token={mode === 'live' && formId && ctx.signToken ? ctx.signToken(formId) : undefined} pagePath={ctx.pagePath} /></div></section>;
    }
    case 'opening-hours': {
      const hours = b.props.source === 'site' ? ctx.hours : b.props.customHours;
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<div className="gs-hours">{typeof hours === 'string' ? hours : formatHours(hours)}</div>{b.props.note ? <p className="gs-hours-note">{b.props.note}</p> : null}</div></section>;
    }
    case 'map': {
      const address = b.props.address || ctx.address || '';
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<div className="gs-map"><span className="gs-map-pin"><Icon name="map-pin" size={22} /></span><div><p className="gs-map-address">{address || "Add your address in website settings."}</p>{b.props.notes ? <p className="gs-map-notes">{b.props.notes}</p> : null}</div>{address ? <a className="gs-btn gs-btn-outline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} rel="noopener noreferrer" target="_blank">Open map</a> : null}</div></div></section>;
    }
    case 'link-list': {
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<div className={`gs-link-list gs-link-list-${b.props.style ?? 'solid'}`}>{(b.props.items ?? []).map((item: any, index: number) => { const href = linkToHref(item.link, { getPageHref: ctx.getPageHref }); const content = <><Icon name={item.icon ?? 'star'} size={20} /><span><span className="gs-link-title">{item.label}</span>{item.description ? <span className="gs-link-desc">{item.description}</span> : null}</span><Arrow /></>; return href ? <a className="gs-link-row" href={href} key={index}>{content}</a> : <div className="gs-link-row" key={index}>{content}</div>; })}</div></div></section>;
    }
    case 'downloads': {
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<div className="gs-downloads">{(b.props.items ?? []).map((item: any, index: number) => <div className="gs-download" key={index}><Icon name="download" size={20} /><div><h3 className="gs-download-title">{item.title}</h3>{item.description ? <p className="gs-download-text">{item.description}</p> : null}</div></div>)}</div></div></section>;
    }
    case 'video': {
      const href = safeVideoUrl(b.props.url);
      if (!href) return null;
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.title ? <h2 className="gs-h2">{b.props.title}</h2> : null}<div className="gs-video"><a href={href} rel="noopener noreferrer" target="_blank">{b.props.caption || b.props.title || 'Watch the video'}<Arrow /></a></div></div></section>;
    }
    case 'before-after': {
      return <section className={sClass} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, (b.props as any).align ?? 'left')}>{b.props.heading ? <h2 className="gs-h2">{b.props.heading}</h2> : null}<div className="gs-before-after">{(b.props.items ?? []).map((item: any, index: number) => { const before = item.beforeId && ctx.getImage ? ctx.getImage(item.beforeId) : null; const after = item.afterId && ctx.getImage ? ctx.getImage(item.afterId) : null; return <figure className="gs-ba-pair" key={index}><div className="gs-ba-images">{before ? <Image image={before} sizes="50vw" alt={`Before: ${item.caption ?? ''}`} /> : null}{after ? <Image image={after} sizes="50vw" alt={`After: ${item.caption ?? ''}`} /> : null}</div>{item.caption ? <figcaption className="gs-caption">{item.caption}</figcaption> : null}</figure>; })}</div></div></section>;
    }

    default:
      return null;
  }
}

function Hero({ block: b, sec, sClass, sStyle, rawId, ctx }: { block: any; sec: any; sClass: string; sStyle: React.CSSProperties; rawId?: string; ctx: RenderContext }) {
  const p = b.props;
  const buttonHref = linkToHref(p.buttonLink, { getPageHref: ctx.getPageHref });
  const button2Href = linkToHref(p.button2Link, { getPageHref: ctx.getPageHref });
  const image = p.imageId && ctx.getImage ? ctx.getImage(p.imageId) : null;
  const layout = p.layout ?? 'split';
  const align = p.align ?? 'left';
  const side = p.imageSide ?? 'right';
  const textWidth = p.textWidth ?? 'normal';
  const heroStyle: React.CSSProperties = { ...sStyle };
  if ((layout === 'fullbleed' || layout === 'card-over-image') && image) {
    const dark = layout === 'fullbleed' ? 0.5 : 0.15;
    heroStyle.backgroundImage = `linear-gradient(rgba(0,0,0,${dark}), rgba(0,0,0,${dark})), url(${image.src})`;
    heroStyle.backgroundSize = 'cover';
    heroStyle.backgroundPosition = 'center';
  }
  const text = (
    <div className={`gs-hero-text gs-hero-text-${textWidth} ${align === 'center' ? 'gs-align-center' : ''}`}>
      {layout === 'minimal' ? <span className="gs-accent-bar" aria-hidden="true" /> : null}
      {p.eyebrow ? <p className="gs-eyebrow">{p.eyebrow}</p> : null}
      <h1 className="gs-hero-title">{p.heading}</h1>
      {p.subheading ? <p className="gs-hero-sub">{p.subheading}</p> : null}
      {(buttonHref && p.buttonLabel) || (button2Href && p.button2Label) ? (
        <div className="gs-btn-row">
          {buttonHref && p.buttonLabel ? <a className="gs-btn gs-btn-solid" href={buttonHref}>{p.buttonLabel}</a> : null}
          {button2Href && p.button2Label ? <a className="gs-btn gs-btn-outline" href={button2Href}>{p.button2Label}</a> : null}
        </div>
      ) : null}
      {Array.isArray(p.highlights) && p.highlights.length ? <ul className="gs-highlights">{p.highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul> : null}
    </div>
  );
  const media = image ? <div className={`gs-hero-media gs-img-style-${p.frame === 'arch' ? 'arch' : 'rounded'} gs-ratio-${(p.imageRatio ?? 'auto').replace(':','-')}`}><Image image={image} sizes="(min-width:900px)48vw,100vw" /></div> : <div className="gs-hero-art" aria-hidden="true" />;

  if (layout === 'centered') {
    return <section className={`${sClass} gs-hero gs-hero-centered`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={`${innerClass(sec, 'center')} gs-hero-inner`}>{text}{media}</div></section>;
  }
  if (layout === 'fullbleed') {
    return <section className={`${sClass} gs-hero gs-hero-fullbleed gs-hero-valign-${p.valign ?? 'center'}`} style={heroStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={`${innerClass(sec, align)} gs-hero-inner`}>{text}</div></section>;
  }
  if (layout === 'editorial') {
    return <section className={`${sClass} gs-hero gs-hero-editorial`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, 'left')}><div className="gs-editorial-rule"><span>{p.eyebrow}</span><span>{p.highlights?.[0] ?? ''}</span></div><h1 className="gs-hero-title">{p.heading}</h1><div className="gs-editorial-grid"><div className="gs-editorial-copy">{p.subheading ? <p className="gs-hero-sub">{p.subheading}</p> : null}</div><div className="gs-editorial-buttons"><div className="gs-btn-row">{[buttonHref && p.buttonLabel ? <a className="gs-btn gs-btn-solid" href={buttonHref} key="a">{p.buttonLabel}</a> : null, button2Href && p.button2Label ? <a className="gs-btn gs-btn-outline" href={button2Href} key="b">{p.button2Label}</a> : null]}</div></div></div><div className="gs-editorial-media">{media}</div></div></section>;
  }
  if (layout === 'card-over-image') {
    return <section className={`${sClass} gs-hero gs-hero-card-over-image`} style={heroStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={`${innerClass(sec, 'left')} gs-hero-inner`}><div className={`gs-hero-card gs-hero-card-${p.cardSide ?? 'left'}`}>{text}</div></div></section>;
  }
  if (layout === 'minimal') {
    return <section className={`${sClass} gs-hero gs-hero-minimal`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, align)}>{text}</div></section>;
  }
  if (layout === 'diagonal') {
    return <section className={`${sClass} gs-hero gs-hero-diagonal`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, 'left')}><div className="gs-diagonal-panel">{text}</div><div className="gs-diagonal-media">{media}</div></div></section>;
  }
  if (layout === 'product-shot') {
    return <section className={`${sClass} gs-hero gs-hero-product-shot`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={innerClass(sec, 'center')}><div className="gs-product-glow" aria-hidden="true" />{text}<div className="gs-browser-frame"><div className="gs-browser-bar"><span /><span /><span /><i /></div>{media}</div></div></section>;
  }
  if (layout === 'arch') {
    return <section className={`${sClass} gs-hero gs-hero-arch gs-hero-image-${side}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={`${innerClass(sec, align)} gs-hero-inner`}>{text}<div className="gs-arch-wrap">{media}</div></div></section>;
  }
  if (layout === 'offset-frame') {
    return <section className={`${sClass} gs-hero gs-hero-offset-frame gs-hero-image-${side}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={`${innerClass(sec, align)} gs-hero-inner`}>{text}<div className="gs-offset-wrap">{media}{p.badgeText ? <span className="gs-hero-badge">{p.badgeText}</span> : null}</div></div></section>;
  }
  return <section className={`${sClass} gs-hero gs-hero-split gs-hero-image-${side}`} style={sStyle} id={sec.anchor || undefined} data-block-id={rawId}><div className={`${innerClass(sec, align)} gs-hero-inner`}>{text}<div className="gs-hero-media-wrap">{media}</div></div></section>;
}

function formatHours(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const labels: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  return days.map((day) => {
    const hours = (value as any)[day];
    if (hours === 'closed') return `${labels[day]}: Closed`;
    if (hours === '24h') return `${labels[day]}: 24 hours`;
    if (Array.isArray(hours)) return `${labels[day]}: ${hours.map((p: any) => `${p.from}–${p.to}`).join(', ')}`;
    return '';
  }).filter(Boolean).join('\n');
}

function safeVideoUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}
