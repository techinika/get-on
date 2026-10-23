import React from "react";
import { Icon } from "./icons";
import type { RenderContext } from "./render-block";

export type FormMode = "live" | "editor";

function hrefFor(ctx: RenderContext, link: { type: string } & Record<string, unknown>): string | null {
  switch (link.type) {
    case "page":
      return ctx.getPageHref ? ctx.getPageHref(String(link.pageId)) : "#";
    case "url":
      return String(link.url);
    case "phone":
      return `tel:${String(link.number).replace(/[^+\d]/g, "")}`;
    case "email":
      return `mailto:${String(link.address)}`;
    case "whatsapp":
      return `https://wa.me/${String(link.number).replace(/\D/g, "")}`;
    default:
      return null;
  }
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function Field({
  name,
  label,
  type = "text",
  required,
  value,
  placeholder,
  multiline,
  minHeight,
  mode,
  autoComplete,
  inputMode,
  maxLength,
  rows,
  id,
  ariaRequired,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  mode: FormMode;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel";
  maxLength?: number;
  rows?: number;
  id: string;
  ariaRequired?: boolean;
}) {
  const fieldId = `${id}-${name}`;
  const inputProps = {
    id: fieldId,
    name,
    className: "gs-field",
    disabled: mode === "editor",
    autoComplete,
    inputMode,
    maxLength,
    "aria-required": ariaRequired ? true : undefined,
    required: required && mode === "live" ? true : undefined,
    defaultValue: value || undefined,
    placeholder,
  } as React.InputHTMLAttributes<HTMLInputElement> &
    React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  return (
    <div className="gs-field-group">
      <label className="gs-field-label" htmlFor={fieldId}>
        {label}
        {required ? null : <span className="gs-field-optional"> (optional)</span>}
      </label>
      {multiline ? (
        <textarea {...inputProps} rows={rows ?? 5} style={{ minHeight }} />
      ) : (
        <input type={type} {...inputProps} />
      )}
    </div>
  );
}

export function ContactFormBlock({
  props,
  ctx,
  mode,
  token,
  pagePath,
  formId,
}: {
  props: Record<string, any>;
  ctx: RenderContext;
  mode: FormMode;
  token?: string;
  pagePath?: string;
  formId?: string;
}) {
  const variation: string = props.variation ?? "classic";
  const background: string = props.background ?? "plain";
  const showName =
    variation === "mini" ? props.showName === true : props.showName !== false;
  const showPhone = variation === "compact" || variation === "mini" ? false : Boolean(props.showPhone);
  const phoneRequired = Boolean(props.phoneRequired) && showPhone;
  const submitLabel: string = props.submitLabel ?? "Send message";
  const consentText: string = props.consentText ?? "";
  const uid = formId ?? "static";

  const fields = (
    <>
      {variation !== "mini" && variation !== "compact" ? (
        <div className="gs-form-row">
          {showName ? (
            <Field
              id={uid}
              name="name"
              label="Your name"
              value=""
              mode={mode}
              autoComplete="name"
              maxLength={80}
              required
              ariaRequired
            />
          ) : null}
          <Field
            id={uid}
            name="email"
            label="Email"
            type="email"
            value=""
            mode={mode}
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            ariaRequired
            placeholder="you@example.com"
          />
        </div>
      ) : (
        <>
          {showName ? (
            <Field
              id={uid}
              name="name"
              label="Your name"
              value=""
              mode={mode}
              autoComplete="name"
              maxLength={80}
              required
              ariaRequired
            />
          ) : null}
          <Field
            id={uid}
            name="email"
            label="Email"
            type="email"
            value=""
            mode={mode}
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            ariaRequired
            placeholder="you@example.com"
          />
        </>
      )}
      {showPhone ? (
        <Field
          id={uid}
          name="phone"
          label="Phone"
          type="tel"
          value=""
          mode={mode}
          autoComplete="tel"
          inputMode="tel"
          maxLength={30}
          required={phoneRequired}
          ariaRequired={phoneRequired}
        />
      ) : null}
      <Field
        id={uid}
        name="message"
        label="Your message"
        multiline
        rows={5}
        minHeight={variation === "mini" ? 88 : variation === "compact" ? 112 : 144}
        value=""
        mode={mode}
        maxLength={5000}
        required
        ariaRequired
      />
    </>
  );

  const formBody = (
    <form
      className={`gs-form gs-form-${variation}`}
      method="post"
      action={mode === "live" && formId ? `/_forms/${formId}` : undefined}
      acceptCharset="utf-8"
    >
      {mode === "live" && formId ? (
        <>
          <input type="hidden" name="_t" value={token ?? `{{GS_FORM_TOKEN:${formId}}}`} />
          <input type="hidden" name="_b" value={pagePath ?? "{{GS_PAGE_PATH}}"} />
        </>
      ) : null}
      <div className="gs-hp" aria-hidden="true">
        <label>
          Website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {fields}
      <button type="submit" className="gs-btn gs-btn-solid gs-form-submit" disabled={mode === "editor"}>
        {submitLabel}
      </button>
      {consentText ? <p className="gs-consent">{consentText}</p> : null}
      {mode === "editor" ? (
        <p className="gs-form-caption">
          <Icon name="star" size={14} /> This form works on your live website.
        </p>
      ) : null}
    </form>
  );

  const details = props;

  if (variation === "split") {
    return (
      <section className={`gs-section ${bgClass(background)} gs-form-section`}>
        <div className="gs-inner">
          <div className="gs-form-split">
            <div className="gs-form-split-left">
              <h2 className="gs-h2">{props.heading}</h2>
              {props.intro ? <p className="gs-form-intro">{props.intro}</p> : null}
              <ul className="gs-contact gs-form-details">
                {details.phone ? (
                  <li className="gs-contact-item">
                    <span className="gs-icon-tile">
                      <Icon name="phone" size={20} />
                    </span>
                    <span className="gs-contact-label">Phone</span>
                    <a href={`tel:${digits(details.phone)}`}>{details.phone}</a>
                  </li>
                ) : null}
                {details.email ? (
                  <li className="gs-contact-item">
                    <span className="gs-icon-tile">
                      <Icon name="mail" size={20} />
                    </span>
                    <span className="gs-contact-label">Email</span>
                    <a href={`mailto:${details.email}`}>{details.email}</a>
                  </li>
                ) : null}
                {details.address ? (
                  <li className="gs-contact-item">
                    <span className="gs-icon-tile">
                      <Icon name="map-pin" size={20} />
                    </span>
                    <span className="gs-contact-label">Address</span>
                    <span>{details.address}</span>
                  </li>
                ) : null}
              </ul>
            </div>
            <div className="gs-form-card">{formBody}</div>
          </div>
        </div>
      </section>
    );
  }

  const headingTag = variation === "boxed" ? "gs-h2 gs-form-h2-boxed" : variation === "compact" ? "gs-h3" : variation === "mini" ? "gs-form-h-mini" : "gs-h2";
  const wrapInner = (
    <>
      <h2 className={`${headingTag} gs-form-heading`} style={variation === "mini" ? { fontSize: 18, fontWeight: 600 } : undefined}>
        {props.heading}
      </h2>
      {props.intro ? <p className="gs-form-intro">{props.intro}</p> : null}
      {formBody}
    </>
  );

  if (variation === "boxed") {
    return (
      <section className={`gs-section ${bgClass(background)} gs-form-section`}>
        <div className="gs-inner gs-form-boxed-inner">
          <div className="gs-form-card">{wrapInner}</div>
        </div>
      </section>
    );
  }

  if (variation === "compact") {
    return (
      <section className={`gs-section ${bgClass(background)} gs-form-section`}>
        <div className="gs-inner gs-form-compact-inner">{wrapInner}</div>
      </section>
    );
  }

  if (variation === "mini") {
    return (
      <section className={`gs-section ${bgClass(background)} gs-form-section`}>
        <div className="gs-inner gs-form-mini-inner">{wrapInner}</div>
      </section>
    );
  }

  return (
    <section className={`gs-section ${bgClass(background)} gs-form-section`}>
      <div className="gs-inner gs-form-classic-inner gs-align-center">{wrapInner}</div>
    </section>
  );
}

export function ContactCtaBlock({
  props,
  ctx,
}: {
  props: Record<string, any>;
  ctx: RenderContext;
}) {
  const layout: string = props.layout ?? "strip";
  const align: string = layout === "banner" ? "center" : props.align ?? "left";
  const background: string = layout === "banner" ? "brand" : props.background ?? "plain";
  const primaryHref = props.primaryLabel ? hrefFor(ctx, props.primaryLink ?? { type: "none" }) : null;
  const secondaryHref =
    props.secondaryLabel ? hrefFor(ctx, props.secondaryLink ?? { type: "none" }) : null;

  const buttons = (
    <div className="gs-cta-buttons">
      {primaryHref && props.primaryLabel ? (
        <a className="gs-btn gs-btn-solid" href={primaryHref}>
          {props.primaryLabel}
        </a>
      ) : null}
      {secondaryHref && props.secondaryLabel ? (
        <a className="gs-btn gs-btn-outline" href={secondaryHref}>
          {props.secondaryLabel}
        </a>
      ) : null}
    </div>
  );

  if (layout === "banner") {
    return (
      <section className={`gs-section gs-section-bg-brand gs-cta-banner gs-align-center`}>
        <div className="gs-inner">
          <h2 className="gs-h2 gs-cta-banner-title">{props.heading}</h2>
          {props.text ? <p className="gs-cta-banner-text">{props.text}</p> : null}
          {buttons}
        </div>
      </section>
    );
  }

  if (layout === "card") {
    return (
      <section className={`gs-section ${bgClass(background)} gs-cta-card-section`}>
        <div className="gs-inner">
          <div className="gs-cta-card gs-align-center">
            <h2 className="gs-h2">{props.heading}</h2>
            {props.text ? <p className="gs-form-intro">{props.text}</p> : null}
            {buttons}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`gs-section ${bgClass(background)} gs-cta-strip`}>
      <div className="gs-inner gs-cta-strip-inner">
        <div className="gs-cta-strip-text">
          <h3 className="gs-h3">{props.heading}</h3>
          {props.text ? <p className="gs-form-intro">{props.text}</p> : null}
        </div>
        {buttons}
      </div>
    </section>
  );
}

export function QuickContactBlock({
  props,
}: {
  props: Record<string, any>;
}) {
  const layout: string = props.layout ?? "row";
  const align: string = props.align ?? "left";
  const background: string = props.background ?? "plain";
  const items: Array<{ key: string; label: string; href: string }> = [];
  if (props.showCall !== false && props.phone) {
    items.push({ key: "call", label: "Call us", href: `tel:${digits(props.phone)}` });
  }
  if (props.showEmail !== false && props.email) {
    items.push({ key: "email", label: "Email us", href: `mailto:${props.email}` });
  }
  if (props.showWhatsApp !== false && props.whatsapp) {
    items.push({ key: "whatsapp", label: "WhatsApp", href: `https://wa.me/${digits(props.whatsapp)}` });
  }
  if (items.length === 0) return null;

  return (
    <section className={`gs-section ${bgClass(background)} gs-quick`}>
      <div className={`gs-inner gs-quick-inner gs-quick-${layout} ${align === "center" ? "gs-align-center" : ""}`}>
        {items.map((item, index) => (
          <a
            key={item.key}
            className={`gs-btn ${index === 0 ? "gs-btn-solid" : "gs-btn-outline"} gs-quick-btn`}
            href={item.href}
            rel="noopener noreferrer"
            target={item.key === "whatsapp" ? "_blank" : undefined}
          >
            <Icon name={item.key === "call" ? "phone" : item.key === "email" ? "mail" : "star"} size={20} />
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function bgClass(background: string | undefined): string {
  if (background === "soft") return "gs-section-bg-soft";
  if (background === "brand") return "gs-section-bg-brand";
  return "";
}
