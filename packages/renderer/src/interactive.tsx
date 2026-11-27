"use client";

import * as React from "react";

import {
  renderCardMeta,
  type ResolvedItem,
  type ResolvedMedia,
  type ResolvedTab,
} from "./card-meta";

export type { ResolvedItem, ResolvedMedia, ResolvedTab };

export function TabbedItemsClient({
  tabs,
  layout,
}: {
  tabs: ResolvedTab[];
  layout?: string;
}) {
  const [activeId, setActiveId] = React.useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === activeId) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="gs-tabs-wrap" data-gs-tabs="">
      <div className="gs-tablist" role="tablist" aria-label="Categories">
        {tabs.map((tab) => {
          const selected = tab.id === current.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-gs-tab={tab.id}
              className={`gs-tab-btn${selected ? " is-active" : ""}`}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {current.intro || current.featuredImage ? (
        <div className="gs-tab-feature">
          {current.featuredImage ? (
            <img
              src={current.featuredImage.src}
              alt={current.featuredImage.alt ?? current.label}
              className="gs-tab-feature-img"
            />
          ) : null}
          {current.intro ? <p className="gs-tab-intro">{current.intro}</p> : null}
        </div>
      ) : null}
      <div className="gs-grid" data-gs-layout={layout || undefined} style={{ marginTop: 18 }}>
        {current.items.map((item, idx) => (
          <div
            key={idx}
            className="gs-card"
            data-gs-highlighted={item.highlighted ? "true" : undefined}
          >
            {renderCardMeta(item, idx)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingToggleClient({
  items,
  layout,
}: {
  items: ResolvedItem[];
  layout?: string;
}) {
  const [annual, setAnnual] = React.useState(false);

  return (
    <div className="gs-billing-wrap" data-gs-billing="">
      <div className="gs-billing-toggle" role="group" aria-label="Billing interval">
        <button
          type="button"
          className={`gs-tab-btn${!annual ? " is-active" : ""}`}
          aria-pressed={!annual}
          data-gs-billing-btn="monthly"
          onClick={() => setAnnual(false)}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`gs-tab-btn${annual ? " is-active" : ""}`}
          aria-pressed={annual}
          data-gs-billing-btn="annual"
          onClick={() => setAnnual(true)}
        >
          Annual (Save 20%)
        </button>
      </div>
      <div className="gs-grid" data-gs-layout={layout || undefined} style={{ marginTop: 22 }}>
        {items.map((item, idx) => {
          const monthly = typeof item.price === "string" ? item.price : "";
          const yearly = typeof item.annualPrice === "string" ? item.annualPrice : monthly;
          const displayItem: ResolvedItem = {
            ...item,
            price: annual ? yearly : monthly,
          };
          return (
            <div
              key={idx}
              className="gs-card"
              data-gs-highlighted={item.highlighted ? "true" : undefined}
            >
              {renderCardMeta(displayItem, idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExpandableCardsClient({
  items,
  layout,
}: {
  items: ResolvedItem[];
  layout?: string;
}) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  return (
    <div className="gs-grid" data-gs-layout={layout || undefined} style={{ marginTop: 24 }}>
      {items.map((item, idx) => {
        const expanded = openIdx === idx;
        const details = typeof item.details === "string" ? item.details : "";
        return (
          <div
            key={idx}
            className="gs-card gs-card--expandable"
            data-gs-expanded={expanded ? "true" : "false"}
          >
            {renderCardMeta(item, idx)}
            {details ? (
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="gs-expand-btn"
                  data-gs-expand-trigger=""
                  aria-expanded={expanded}
                  onClick={() => setOpenIdx(expanded ? null : idx)}
                >
                  {expanded ? "Hide details" : "Treatment details"}
                </button>
                {expanded ? (
                  <p className="gs-expand-panel" data-gs-expand-panel="">
                    {details}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function BeforeAfterClient({ items }: { items: ResolvedItem[] }) {
  const [position, setPosition] = React.useState(52);
  const first = items[0];

  return (
    <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
      {first && (typeof first.beforeText === "string" || typeof first.afterText === "string") ? (
        <div className="gs-ba-compare">
          <div className="gs-ba-split">
            <div className="gs-ba-pane">
              <span className="gs-meta-tag">Before</span>
              <p style={{ margin: "6px 0 0" }}>{String(first.beforeText ?? first.text ?? "")}</p>
            </div>
            <div
              className="gs-ba-pane gs-ba-pane--after"
              style={{ opacity: Math.max(0.35, Math.min(1, position / 100)) }}
            >
              <span className="gs-meta-tag">After ({position}%)</span>
              <p style={{ margin: "6px 0 0" }}>{String(first.afterText ?? first.text ?? "")}</p>
            </div>
          </div>
          <label className="gs-ba-range-label">
            <span>Compare stage</span>
            <input
              type="range"
              min={15}
              max={100}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="gs-ba-range"
              aria-label="Compare before and after"
            />
          </label>
        </div>
      ) : null}
      <div className="gs-grid">
        {items.map((item, idx) => (
          <div key={idx} className="gs-card">
            {renderCardMeta(item, idx)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FaqAccordionClient({ items }: { items: ResolvedItem[] }) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  return (
    <div className="gs-accordion">
      {items.map((item, idx) => {
        const title = String(item.question ?? item.title ?? item.name ?? `Question ${idx + 1}`);
        const answer = String(item.answer ?? item.text ?? "");
        const expanded = openIdx === idx;
        return (
          <div key={idx} className="gs-accordion-item">
            <button
              type="button"
              className="gs-accordion-trigger"
              data-gs-accordion-trigger=""
              aria-expanded={expanded}
              onClick={() => setOpenIdx(expanded ? null : idx)}
            >
              <span>{title}</span>
              <span aria-hidden style={{ opacity: 0.65 }}>
                {expanded ? "−" : "+"}
              </span>
            </button>
            <div className="gs-accordion-panel" data-gs-accordion-panel="" hidden={!expanded}>
              <p style={{ margin: 0 }}>{answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NewsletterClient({
  buttonLabel = "Subscribe",
  placeholder = "you@example.com",
}: {
  buttonLabel?: string;
  placeholder?: string;
}) {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  return (
    <form
      className="gs-newsletter-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) setSubmitted(true);
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (submitted) setSubmitted(false);
        }}
        placeholder={placeholder}
        className="gs-input"
        aria-label="Email address"
      />
      <button type="submit" className="gs-btn">
        {submitted ? "Joined" : buttonLabel}
      </button>
    </form>
  );
}

export function ContactFormClient({
  showName,
  showPhone,
  phoneRequired,
  submitLabel,
}: {
  showName: boolean;
  showPhone: boolean;
  phoneRequired: boolean;
  submitLabel: string;
}) {
  const [submitted, setSubmitted] = React.useState(false);

  return (
    <form
      className="gs-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
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
      {submitted ? (
        <p className="gs-form-status" role="status">
          Preview submission received (live sites deliver messages to your inbox).
        </p>
      ) : null}
    </form>
  );
}
