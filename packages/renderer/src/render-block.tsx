import React from "react";
import { blockSchema, linkToHref } from "@get-on/blocks";
import { Icon } from "./icons";

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
};

type ParsedBlock = ReturnType<typeof blockSchema.parse>;

function bgClass(background: string | undefined): string {
  if (background === "soft") return "gs-section-bg-soft";
  if (background === "brand") return "gs-section-bg-brand";
  return "";
}

function alignClass(align: string | undefined): string {
  return align === "center" ? "gs-align-center" : "";
}

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

function Gallery({
  imageIds,
  columns,
  ctx,
}: {
  imageIds: string[];
  columns: number;
  ctx: RenderContext;
}) {
  const images = imageIds
    .map((id) => (ctx.getImage ? ctx.getImage(id) : null))
    .filter((image): image is RenderImage => Boolean(image));
  if (images.length === 0) return null;
  return (
    <div className={`gs-gallery gs-grid-${Math.min(Math.max(columns, 2), 4)}`}>
      {images.map((image, index) => (
        <img
          key={index}
          className="gs-img"
          src={image.src}
          srcSet={image.srcSet}
          sizes="(min-width: 900px) 30vw, (min-width: 640px) 45vw, 100vw"
          width={image.width}
          height={image.height}
          alt={image.alt ?? ""}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}

export function RenderBlock({
  block,
  ctx = {},
}: {
  block: unknown;
  ctx?: RenderContext;
}) {
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success) {
    return null;
  }
  const b = parsed.data as ParsedBlock;
  const props = b.props as Record<string, never>;
  const background = (props as { background?: string }).background;
  const align = (props as { align?: string }).align;

  switch (b.type) {
    case "spacer": {
      const height =
        b.props.height === "small" ? 24 : b.props.height === "large" ? 96 : 48;
      return (
        <div className="gs-spacer" style={{ height }} aria-hidden="true" />
      );
    }

    case "divider":
      return <div className="gs-divider" role="separator" />;

    case "contact-form":
      return null;

    case "hero": {
      const buttonHref = linkToHref(b.props.buttonLink, {
        getPageHref: ctx.getPageHref,
      });
      const layout = b.props.layout ?? "text-only";
      const image =
        b.props.imageId && ctx.getImage ? ctx.getImage(b.props.imageId) : null;
      return (
        <section
          className={`gs-section gs-hero gs-hero-${layout} ${bgClass(background)}`}
        >
          <div className="gs-inner gs-hero-inner">
            <div className={`gs-hero-text ${alignClass(align)}`}>
              <h1 className="gs-hero-title">{b.props.heading}</h1>
              {b.props.subheading ? (
                <p className="gs-hero-sub">{b.props.subheading}</p>
              ) : null}
              {buttonHref && b.props.buttonLabel ? (
                <div className="gs-btn-wrap">
                  <a className="gs-btn gs-btn-solid" href={buttonHref}>
                    {b.props.buttonLabel}
                  </a>
                </div>
              ) : null}
            </div>
            {image && layout !== "text-only" ? (
              <div className="gs-hero-media">
                <img
                  className="gs-img"
                  src={image.src}
                  srcSet={image.srcSet}
                  sizes="(min-width: 900px) 45vw, 100vw"
                  width={image.width}
                  height={image.height}
                  alt={image.alt ?? ""}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    case "heading": {
      const Tag = b.props.level === "h3" ? "h3" : "h2";
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className={`gs-inner ${alignClass(align)}`}>
            <Tag className={Tag === "h3" ? "gs-h3" : "gs-h2"}>
              {b.props.text}
            </Tag>
          </div>
        </section>
      );
    }

    case "text":
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className={`gs-inner ${alignClass(align)}`}>
            <p className="gs-p">{textOf(b.props.content)}</p>
          </div>
        </section>
      );

    case "image": {
      const image =
        b.props.imageId && ctx.getImage ? ctx.getImage(b.props.imageId) : null;
      if (!image) return null;
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className={`gs-inner ${alignClass(align)}`}>
            <figure
              className={`gs-figure gs-figure-${b.props.size ?? "medium"}`}
            >
              <img
                className="gs-img"
                src={image.src}
                srcSet={image.srcSet}
                sizes="(min-width: 900px) 720px, 100vw"
                width={image.width}
                height={image.height}
                alt={b.props.alt || image.alt || ""}
                loading="lazy"
                decoding="async"
              />
              {b.props.caption ? (
                <figcaption className="gs-caption">
                  {b.props.caption}
                </figcaption>
              ) : null}
            </figure>
          </div>
        </section>
      );
    }

    case "gallery":
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className="gs-inner">
            <Gallery
              imageIds={b.props.imageIds ?? []}
              columns={b.props.columns ?? 3}
              ctx={ctx}
            />
          </div>
        </section>
      );

    case "features":
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className="gs-inner">
            {b.props.heading ? (
              <h2 className="gs-h2">{b.props.heading}</h2>
            ) : null}
            <div
              className={`gs-features gs-grid-${b.props.columns === 2 ? 2 : 3}`}
            >
              {b.props.items.map((item, index) => (
                <div className="gs-feature" key={index}>
                  <span className="gs-feature-icon">
                    <Icon name={item.icon} size={24} />
                  </span>
                  <h3 className="gs-feature-title">{item.title}</h3>
                  <p className="gs-feature-text">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "faq":
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className="gs-inner">
            {b.props.heading ? (
              <h2 className="gs-h2">{b.props.heading}</h2>
            ) : null}
            <div className="gs-faq">
              {b.props.items.map((item, index) => (
                <details className="gs-faq-item" key={index}>
                  <summary className="gs-faq-question">{item.question}</summary>
                  <p className="gs-faq-answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );

    case "contact-details": {
      const mapHref = b.props.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.props.address)}`
        : null;
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className="gs-inner">
            {b.props.heading ? (
              <h2 className="gs-h2">{b.props.heading}</h2>
            ) : null}
            <ul className="gs-contact">
              {b.props.phone ? (
                <li className="gs-contact-item">
                  <Icon name="phone" size={20} />
                  <a href={`tel:${b.props.phone.replace(/[^+\d]/g, "")}`}>
                    {b.props.phone}
                  </a>
                </li>
              ) : null}
              {b.props.email ? (
                <li className="gs-contact-item">
                  <Icon name="mail" size={20} />
                  <a href={`mailto:${b.props.email}`}>{b.props.email}</a>
                </li>
              ) : null}
              {b.props.address ? (
                <li className="gs-contact-item">
                  <Icon name="map-pin" size={20} />
                  <span>{b.props.address}</span>
                </li>
              ) : null}
              {b.props.hours ? (
                <li className="gs-contact-item">
                  <Icon name="clock" size={20} />
                  <span>{b.props.hours}</span>
                </li>
              ) : null}
            </ul>
            {b.props.showMapLink && mapHref ? (
              <div className="gs-btn-wrap">
                <a
                  className="gs-btn gs-btn-outline"
                  href={mapHref}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Find us on the map
                </a>
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    case "social-links":
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className={`gs-inner ${alignClass(align)}`}>
            <ul className="gs-social">
              {b.props.items
                .filter((item) => item.url)
                .map((item, index) => (
                  <li key={index}>
                    <a
                      className="gs-social-link"
                      href={item.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {item.network}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      );

    case "button": {
      const buttonHref = linkToHref(b.props.link, {
        getPageHref: ctx.getPageHref,
      });
      if (!buttonHref || !b.props.label) return null;
      return (
        <section className={`gs-section ${bgClass(background)}`}>
          <div className={`gs-inner ${alignClass(align)}`}>
            <div className="gs-btn-wrap">
              <a
                className={`gs-btn ${b.props.style === "outline" ? "gs-btn-outline" : "gs-btn-solid"}`}
                href={buttonHref}
              >
                {b.props.label}
              </a>
            </div>
          </div>
        </section>
      );
    }

    default:
      return null;
  }
}
