import * as React from "react";

export type ResolvedMedia = {
  src: string;
  alt?: string;
} | null;

export type ResolvedItem = Record<string, unknown> & {
  _img?: ResolvedMedia;
  _afterImg?: ResolvedMedia;
  _href?: string;
};

export type ResolvedTab = {
  id: string;
  label: string;
  intro?: string;
  featuredImage?: ResolvedMedia;
  items: ResolvedItem[];
};

export function renderCardMeta(item: ResolvedItem, idx?: number) {
  const indexLabel =
    typeof item.number === "string"
      ? item.number
      : typeof idx === "number" && item._numbered === true
        ? String(idx + 1).padStart(2, "0")
        : null;
  const features = Array.isArray(item.features)
    ? item.features.map((f) => String(f)).filter(Boolean)
    : [];

  return (
    <>
      {indexLabel ? <span className="gs-index-num">{indexLabel}</span> : null}
      {item._img ? (
        <img
          src={item._img.src}
          alt={String(item.alt ?? item.name ?? item.title ?? item._img.alt ?? "")}
          className="gs-card-img"
        />
      ) : null}
      <div className="gs-card-body">
        <div className="gs-card-head">
          <div>
            {typeof item.category === "string" && item.category ? (
              <p className="gs-meta-tag">{item.category}</p>
            ) : null}
            {typeof item.value === "string" ? <p className="gs-stat-val">{item.value}</p> : null}
            {typeof item.title === "string" ? <h3>{item.title}</h3> : null}
            {typeof item.name === "string" ? <h3>{item.name}</h3> : null}
            {typeof item.role === "string" ? <p className="gs-card-sub">{item.role}</p> : null}
          </div>
          {typeof item.price === "string" ? <span className="gs-price">{item.price}</span> : null}
        </div>
        {(typeof item.time === "string" && item.time) ||
        (typeof item.duration === "string" && item.duration) ||
        (typeof item.level === "string" && item.level) ||
        (typeof item.year === "string" && item.year) ||
        (typeof item.coordinates === "string" && item.coordinates) ? (
          <p className="gs-meta-row">
            {[item.time, item.duration, item.level, item.year, item.coordinates]
              .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
              .join(" · ")}
          </p>
        ) : null}
        {typeof item.text === "string" && item.text ? <p className="gs-card-copy">{item.text}</p> : null}
        {typeof item.description === "string" && item.description ? (
          <p className="gs-card-copy">{item.description}</p>
        ) : null}
        {typeof item.quote === "string" && item.quote ? (
          <p className="gs-card-copy gs-quote">{item.quote}</p>
        ) : null}
        {features.length > 0 ? (
          <ul className="gs-card-list">
            {features.map((feat, fIdx) => (
              <li key={fIdx}>{feat}</li>
            ))}
          </ul>
        ) : null}
        {typeof item.author === "string" && item.author ? (
          <p className="gs-card-author">{item.author}</p>
        ) : null}
        {typeof item.buttonLabel === "string" && item.buttonLabel && item._href ? (
          <p style={{ margin: "12px 0 0" }}>
            <a href={item._href} className="gs-inline-link">
              {item.buttonLabel}
            </a>
          </p>
        ) : null}
      </div>
    </>
  );
}
