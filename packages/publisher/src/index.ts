import {
  collectContentBlocks,
  compileStyles,
  isPageContentV5,
  richTextToPlain,
  sanitizeHtml,
  themeTokens,
  type Block,
  type ContentNode,
  type PageContentV5,
  type RichNode,
  type Theme,
} from "@get-on/blocks";
import { RENDERER_CSS, RENDERER_CSS_VERSION } from "@get-on/renderer";

export type BuiltFile = {
  body: Uint8Array;
  contentType: string;
  size: number;
};

export type PublishImage = {
  id: string;
  filename?: string;
  path?: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  contentType?: string;
  mime?: string | null;
  bytes: Uint8Array;
};

export type SocialLink = {
  network: string;
  url: string;
};

export type ContactFormConfig = {
  id: string;
  pagePath: string;
  showName: boolean;
  showPhone: boolean;
  phoneRequired: boolean;
};

export type SiteSettings = {
  businessName: string;
  tagline?: string;
  locale?: string;
  theme: Theme;
  themeColor?: string | null;
  businessType?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  socialLinks?: SocialLink[];
  logo?: { contentType: string; bytes: Uint8Array } | null;
  plan?: string;
  showWatermark?: boolean;
  verification?: {
    gscTag?: string;
    bing?: string;
    [key: string]: unknown;
  };
  seo?: {
    title?: string;
    description?: string;
    titleFormat?: string;
    twitterHandle?: string;
    allowIndexing?: boolean;
  };
  customNotFound?: {
    title?: string;
    text?: string;
    button?: string;
  } | null;
};

export type PublishPage = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  noindex?: boolean;
  hidden?: boolean;
  showInMenu?: boolean;
  position?: number;
  blocks: Block[] | unknown[] | PageContentV5 | { blocks?: Block[] | unknown[] };
};

export type BuildSiteInput = {
  siteId: string;
  subdomain?: string;
  publishId: string;
  builtAt?: Date;
  rootDomain?: string;
  primaryHost?: string | null;
  activePlugins?: string[];
  forms?: { enabled: boolean };
  settings: SiteSettings;
  pages: PublishPage[];
  images?: PublishImage[];
};

export function readRendererCss(): string {
  return RENDERER_CSS;
}

export function assertStyledHtml(html: string): void {
  const required = ['data-gs="1"', ".gs-root", ".gs-header", ".gs-section", ".gs-btn"];
  for (const needle of required) {
    if (!html.includes(needle)) {
      throw new Error(`UPLOAD_VERIFY_FAILED: missing ${needle}`);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fnv1aHex(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function cssVarsInline(theme: Theme): string {
  return Object.entries(themeTokens(theme))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

export function normalizeFormId(rawId: string, fallbackSeed = "form"): string {
  if (/^[A-Za-z0-9_-]{6,32}$/.test(rawId)) return rawId;
  const cleaned = rawId.replace(/[^A-Za-z0-9_-]/g, "");
  if (cleaned.length >= 6 && cleaned.length <= 32) return cleaned;
  const digest = fnv1aHex(rawId || fallbackSeed);
  if (cleaned.length > 32) {
    return `${cleaned.slice(0, 23)}_${digest}`;
  }
  const base = cleaned || "contact";
  return `${base}_${digest}`.slice(0, 32);
}

function resolveLinkHref(
  link: unknown,
  pageHrefById?: Map<string, string>,
): string {
  if (typeof link === "string" && link.trim()) {
    const trimmed = link.trim();
    if (/^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed;
    return "#";
  }
  if (!link || typeof link !== "object") return "#";
  const rec = link as Record<string, unknown>;
  if (rec.type === "url" && typeof rec.url === "string") {
    const url = rec.url.trim();
    return /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : "#";
  }
  if (rec.type === "email" && typeof rec.email === "string") return `mailto:${rec.email.trim()}`;
  if (rec.type === "phone" && typeof rec.phone === "string") return `tel:${rec.phone.trim()}`;
  if (rec.type === "anchor" && typeof rec.anchor === "string") {
    return `#${rec.anchor.trim().replace(/^#/, "")}`;
  }
  if (rec.type === "page" && typeof rec.pageId === "string" && pageHrefById) {
    return pageHrefById.get(rec.pageId) ?? "#";
  }
  return "#";
}

function renderVideoEmbedHtml(rawUrl: string, title = "Embedded video"): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) {
        return `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${escapeHtml(title)}" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:var(--s-radius)"></iframe>`;
      }
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) {
        return `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${escapeHtml(title)}" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:var(--s-radius)"></iframe>`;
      }
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
      if (/^\d{4,16}$/.test(id)) {
        return `<iframe src="https://player.vimeo.com/video/${id}" title="${escapeHtml(title)}" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:var(--s-radius)"></iframe>`;
      }
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(parsed.pathname)) {
      return `<video src="${escapeHtml(parsed.toString())}" controls style="width:100%;border-radius:var(--s-radius)"></video>`;
    }
  } catch {
    return "";
  }
  return "";
}

type RenderHtmlContext = {
  settings: SiteSettings;
  images: Map<string, { src: string; alt?: string }>;
  pageHrefById: Map<string, string>;
  contactEnabled: boolean;
  pagePath: string;
  collectedForms: ContactFormConfig[];
};

function renderContactFormHtml(
  rawId: string,
  props: Record<string, unknown>,
  ctx: RenderHtmlContext,
  nodeAttrs: string,
): string {
  const formId = normalizeFormId(rawId, `contact_${ctx.pagePath}`);
  const eyebrow = typeof props.eyebrow === "string" ? props.eyebrow : "";
  const heading = typeof props.heading === "string" ? props.heading : "Send us a message";
  const subheading = typeof props.subheading === "string" ? props.subheading : "";
  const text = typeof props.text === "string" ? props.text : "";
  const showName = props.showName !== false;
  const showPhone = Boolean(props.showPhone);
  const phoneRequired = Boolean(props.phoneRequired) && showPhone;
  const submitLabel =
    typeof props.submitLabel === "string" && props.submitLabel.trim()
      ? props.submitLabel.trim()
      : typeof props.buttonLabel === "string" && props.buttonLabel.trim()
        ? props.buttonLabel.trim()
        : "Send message";

  if (!ctx.contactEnabled) {
    const email = ctx.settings.email?.trim();
    return `<section class="gs-section gs-section--soft" ${nodeAttrs}><div class="gs-container">${
      eyebrow ? `<p class="gs-badge">${escapeHtml(eyebrow)}</p>` : ""
    }${heading ? `<h2>${escapeHtml(heading)}</h2>` : ""}${
      subheading ? `<p>${escapeHtml(subheading)}</p>` : ""
    }${text ? `<p>${escapeHtml(text)}</p>` : ""}${
      email
        ? `<p><a class="gs-btn" href="mailto:${escapeHtml(email)}">Write to ${escapeHtml(email)}</a></p>`
        : ""
    }</div></section>`;
  }

  if (!ctx.collectedForms.some((item) => item.id === formId)) {
    ctx.collectedForms.push({
      id: formId,
      pagePath: ctx.pagePath,
      showName,
      showPhone,
      phoneRequired,
    });
  }

  const parts: string[] = [];
  parts.push(`<section class="gs-section gs-section--soft" ${nodeAttrs}><div class="gs-container">`);
  if (eyebrow) parts.push(`<p class="gs-badge">${escapeHtml(eyebrow)}</p>`);
  if (heading) parts.push(`<h2>${escapeHtml(heading)}</h2>`);
  if (subheading) parts.push(`<p>${escapeHtml(subheading)}</p>`);
  if (text) parts.push(`<p>${escapeHtml(text)}</p>`);
  parts.push(
    `<form class="gs-form" data-gs-form="${escapeHtml(formId)}" action="/_forms/${escapeHtml(formId)}" method="post">`,
  );
  parts.push(`<input type="hidden" name="_b" value="${escapeHtml(ctx.pagePath)}">`);
  parts.push(`<input type="hidden" name="_t" value="">`);
  parts.push(
    `<div class="gs-hp" aria-hidden="true"><label>Company website <input type="text" name="company_website" tabindex="-1" autocomplete="off"></label></div>`,
  );
  if (showName) {
    parts.push(
      `<div class="gs-field"><label for="gs-name-${escapeHtml(formId)}">Name</label><input id="gs-name-${escapeHtml(formId)}" class="gs-input" type="text" name="name" maxlength="80" autocomplete="name" required></div>`,
    );
  }
  parts.push(
    `<div class="gs-field"><label for="gs-email-${escapeHtml(formId)}">Email</label><input id="gs-email-${escapeHtml(formId)}" class="gs-input" type="email" name="email" maxlength="254" autocomplete="email" required></div>`,
  );
  if (showPhone) {
    parts.push(
      `<div class="gs-field"><label for="gs-phone-${escapeHtml(formId)}">Phone</label><input id="gs-phone-${escapeHtml(formId)}" class="gs-input" type="tel" name="phone" maxlength="30" autocomplete="tel"${
        phoneRequired ? " required" : ""
      }></div>`,
    );
  }
  parts.push(
    `<div class="gs-field"><label for="gs-msg-${escapeHtml(formId)}">Message</label><textarea id="gs-msg-${escapeHtml(formId)}" class="gs-textarea" name="message" minlength="5" maxlength="5000" required></textarea></div>`,
  );
  parts.push(`<div><button type="submit" class="gs-btn">${escapeHtml(submitLabel)}</button></div>`);
  parts.push(`<p class="gs-form-status" role="status" aria-live="polite"></p>`);
  parts.push(`</form></div></section>`);
  return parts.join("");
}

function renderSmartBlockHtml(
  rawId: string,
  type: string,
  props: Record<string, unknown>,
  ctx: RenderHtmlContext,
  extraClasses = "",
  anchorId?: string,
): string {
  const attrs = [
    anchorId ? `id="${escapeHtml(anchorId)}"` : "",
    rawId ? `data-gs-node="${escapeHtml(rawId)}"` : "",
    `data-gs-block="${escapeHtml(type)}"`,
  ]
    .filter(Boolean)
    .join(" ");

  if (type === "contact-form") {
    return renderContactFormHtml(rawId, props, ctx, attrs);
  }

  const eyebrow = typeof props.eyebrow === "string" ? props.eyebrow : "";
  const heading = typeof props.heading === "string" ? props.heading : "";
  const subheading = typeof props.subheading === "string" ? props.subheading : "";
  const text = typeof props.text === "string" ? props.text : "";
  const imageId = typeof props.imageId === "string" ? props.imageId : "";
  const img = imageId ? ctx.images.get(imageId) : undefined;
  const items = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];

  const soft = type === "features" || type === "faq" || type === "testimonials";
  const sectionClass = ["gs-section", soft ? "gs-section--soft" : "", extraClasses]
    .filter(Boolean)
    .join(" ");

  const inner: string[] = [];
  if (eyebrow) inner.push(`<p class="gs-badge">${escapeHtml(eyebrow)}</p>`);
  if (heading) {
    inner.push(
      type === "hero"
        ? `<h1>${escapeHtml(heading)}</h1>`
        : `<h2>${escapeHtml(heading)}</h2>`,
    );
  }
  if (subheading) inner.push(`<p>${escapeHtml(subheading)}</p>`);
  if (text) inner.push(`<p>${escapeHtml(text)}</p>`);
  if (img) {
    inner.push(
      `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt ?? heading)}" style="width:100%;max-height:420px;object-fit:cover;border-radius:var(--s-radius);margin-top:16px">`,
    );
  }

  const btn1 = typeof props.buttonLabel === "string" ? props.buttonLabel : "";
  const btn2 = typeof props.button2Label === "string" ? props.button2Label : "";
  if (btn1 || btn2) {
    inner.push(`<div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">`);
    if (btn1) {
      inner.push(
        `<a class="gs-btn" href="${escapeHtml(resolveLinkHref(props.buttonLink, ctx.pageHrefById))}">${escapeHtml(btn1)}</a>`,
      );
    }
    if (btn2) {
      inner.push(
        `<a class="gs-btn gs-btn--secondary" href="${escapeHtml(resolveLinkHref(props.button2Link, ctx.pageHrefById))}">${escapeHtml(btn2)}</a>`,
      );
    }
    inner.push(`</div>`);
  }

  if (type === "faq" && items.length > 0) {
    inner.push(`<div class="gs-accordion">`);
    items.forEach((item, idx) => {
      const q = String(item.question ?? item.title ?? item.name ?? `Question ${idx + 1}`);
      const a = String(item.answer ?? item.text ?? "");
      const panelId = `gs-faq-${fnv1aHex(`${rawId}:${idx}`)}`;
      inner.push(
        `<div class="gs-accordion-item"><button type="button" class="gs-accordion-trigger" data-gs-accordion-trigger="" aria-controls="${panelId}" aria-expanded="${
          idx === 0 ? "true" : "false"
        }"><span>${escapeHtml(q)}</span></button><div id="${panelId}" class="gs-accordion-panel" data-gs-accordion-panel=""${
          idx === 0 ? "" : " hidden"
        }><p style="margin:0">${escapeHtml(a)}</p></div></div>`,
      );
    });
    inner.push(`</div>`);
  } else if (items.length > 0) {
    inner.push(`<div class="gs-grid" style="margin-top:24px">`);
    for (const item of items) {
      const itemImgId =
        typeof item.imageId === "string"
          ? item.imageId
          : typeof item.photoId === "string"
            ? item.photoId
            : "";
      const itemImg = itemImgId ? ctx.images.get(itemImgId) : undefined;
      inner.push(`<div class="gs-card">`);
      if (itemImg) {
        inner.push(
          `<img src="${escapeHtml(itemImg.src)}" alt="${escapeHtml(String(item.alt ?? item.name ?? item.title ?? ""))}" style="width:100%;height:180px;object-fit:cover;border-radius:var(--s-radius);margin-bottom:12px">`,
        );
      }
      if (typeof item.value === "string") inner.push(`<p class="gs-stat-val">${escapeHtml(item.value)}</p>`);
      if (typeof item.title === "string") inner.push(`<h3>${escapeHtml(item.title)}</h3>`);
      if (typeof item.name === "string") inner.push(`<h3>${escapeHtml(item.name)}</h3>`);
      if (typeof item.role === "string") inner.push(`<p style="opacity:.75;margin-top:0">${escapeHtml(item.role)}</p>`);
      if (typeof item.price === "string") inner.push(`<p style="font-weight:700;color:var(--s-primary)">${escapeHtml(item.price)}</p>`);
      if (typeof item.time === "string") inner.push(`<p style="font-weight:600;opacity:.8">${escapeHtml(item.time)}</p>`);
      if (typeof item.text === "string") inner.push(`<p style="margin:0">${escapeHtml(item.text)}</p>`);
      if (typeof item.description === "string") inner.push(`<p style="margin:0">${escapeHtml(item.description)}</p>`);
      if (typeof item.quote === "string") inner.push(`<p style="margin:0">${escapeHtml(item.quote)}</p>`);
      if (typeof item.author === "string") inner.push(`<p style="margin:10px 0 0;font-weight:600">${escapeHtml(item.author)}</p>`);
      inner.push(`</div>`);
    }
    inner.push(`</div>`);
  }

  return `<section class="${escapeHtml(sectionClass)}" ${attrs}><div class="gs-container">${inner.join("")}</div></section>`;
}

function renderV5NodeHtml(
  node: ContentNode,
  ctx: RenderHtmlContext,
  classMap: Map<string, string[]>,
): string {
  if (
    node.hidden === true ||
    (typeof node.hidden === "object" && node.hidden !== null && node.hidden.all === true)
  ) {
    return "";
  }
  const props = node.props ?? {};
  const extraClasses = [...(node.classes ?? []), ...(classMap.get(node.id) ?? [])]
    .filter(Boolean)
    .join(" ");
  const idAttr = node.attrs?.id ? ` id="${escapeHtml(node.attrs.id)}"` : "";
  const dataAttr = ` data-gs-node="${escapeHtml(node.id)}"`;
  const renderChildren = () =>
    (node.children ?? []).map((child) => renderV5NodeHtml(child, ctx, classMap)).join("");

  switch (node.type) {
    case "page":
      return `<div${idAttr}${dataAttr}${extraClasses ? ` class="${escapeHtml(extraClasses)}"` : ""}>${renderChildren()}</div>`;
    case "section":
    case "container":
    case "columns":
    case "column":
    case "stack":
    case "grid": {
      const base =
        node.type === "section"
          ? "gs-section"
          : node.type === "container"
            ? "gs-container"
            : node.type === "columns"
              ? "gs-columns"
              : node.type === "grid"
                ? "gs-grid"
                : "";
      const cls = [base, extraClasses].filter(Boolean).join(" ");
      return `<div${idAttr}${dataAttr}${cls ? ` class="${escapeHtml(cls)}"` : ""}>${renderChildren()}</div>`;
    }
    case "heading": {
      const rawLevel = Number(props.level ?? 2);
      const level = Number.isFinite(rawLevel) ? Math.max(1, Math.min(6, Math.round(rawLevel))) : 2;
      const clsAttr = extraClasses ? ` class="${escapeHtml(extraClasses)}"` : "";
      return `<h${level}${idAttr}${dataAttr}${clsAttr}>${escapeHtml(String(props.text ?? ""))}</h${level}>`;
    }
    case "text": {
      const clsAttr = extraClasses ? ` class="${escapeHtml(extraClasses)}"` : "";
      return `<p${idAttr}${dataAttr}${clsAttr}>${escapeHtml(String(props.text ?? ""))}</p>`;
    }
    case "richtext": {
      const clsAttr = extraClasses ? ` class="${escapeHtml(extraClasses)}"` : "";
      return `<p${idAttr}${dataAttr}${clsAttr}>${escapeHtml(richTextToPlain(props.doc as RichNode | undefined))}</p>`;
    }
    case "button": {
      const cls = ["gs-btn", extraClasses].filter(Boolean).join(" ");
      return `<a${idAttr}${dataAttr} class="${escapeHtml(cls)}" href="${escapeHtml(
        resolveLinkHref(props.link, ctx.pageHrefById),
      )}">${escapeHtml(String(props.label ?? "Button"))}</a>`;
    }
    case "list": {
      const items = Array.isArray(props.items) ? props.items.map((x) => String(x)) : [];
      const tag = props.ordered ? "ol" : "ul";
      const clsAttr = extraClasses ? ` class="${escapeHtml(extraClasses)}"` : "";
      return `<${tag}${idAttr}${dataAttr}${clsAttr}>${items
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</${tag}>`;
    }
    case "accordion": {
      const cls = ["gs-accordion", extraClasses].filter(Boolean).join(" ");
      return `<div${idAttr}${dataAttr} class="${escapeHtml(cls)}">${renderChildren()}</div>`;
    }
    case "accordion-item": {
      const cls = ["gs-accordion-item", extraClasses].filter(Boolean).join(" ");
      const panelId = `gs-acc-${fnv1aHex(node.id)}`;
      return `<div${idAttr}${dataAttr} class="${escapeHtml(cls)}"><button type="button" class="gs-accordion-trigger" data-gs-accordion-trigger="" aria-controls="${panelId}" aria-expanded="false"><span>${escapeHtml(
        String(props.title ?? "Item"),
      )}</span></button><div id="${panelId}" class="gs-accordion-panel" data-gs-accordion-panel="" hidden><p style="margin:0">${escapeHtml(
        String(props.text ?? ""),
      )}</p>${renderChildren()}</div></div>`;
    }
    case "video":
      return typeof props.url === "string"
        ? renderVideoEmbedHtml(props.url, String(props.title ?? "Video"))
        : "";
    case "html": {
      const cleaned = sanitizeHtml(String(props.html ?? ""));
      const clsAttr = extraClasses ? ` class="${escapeHtml(extraClasses)}"` : "";
      return `<div${idAttr}${dataAttr}${clsAttr}>${cleaned.html}</div>`;
    }
    case "divider":
      return `<hr${idAttr}${dataAttr}${extraClasses ? ` class="${escapeHtml(extraClasses)}"` : ""}>`;
    case "spacer":
      return `<div${idAttr}${dataAttr}${extraClasses ? ` class="${escapeHtml(extraClasses)}"` : ""} style="height:${Math.max(
        0,
        Math.min(400, Number(props.height ?? 32) || 32),
      )}px"></div>`;
    case "image": {
      const id = typeof props.imageId === "string" ? props.imageId : "";
      const img = id ? ctx.images.get(id) : undefined;
      if (!img) return "";
      const clsAttr = extraClasses ? ` class="${escapeHtml(extraClasses)}"` : "";
      return `<img${idAttr}${dataAttr}${clsAttr} src="${escapeHtml(img.src)}" alt="${escapeHtml(
        String(props.alt ?? img.alt ?? ""),
      )}">`;
    }
    case "smart":
      return renderSmartBlockHtml(
        node.id,
        String(props.kind ?? "text"),
        props,
        ctx,
        extraClasses,
        node.attrs?.id,
      );
    default:
      return renderChildren();
  }
}

export function buildSiteRuntimeScript(): string {
  return `(function(){
"use strict";
var registry=Object.create(null);
var root=document.querySelector(".gs-root");
var rawPlugins=root&&root.getAttribute("data-gs-plugins")?root.getAttribute("data-gs-plugins"):"";
var active=rawPlugins?rawPlugins.split(",").map(function(s){return s.trim();}).filter(Boolean):[];
var pagePath=(root&&root.getAttribute("data-gs-page"))||window.location.pathname||"/";
function hasPlugin(id){return active.indexOf(id)!==-1;}
function initPlugin(id,handler){
if(!handler||typeof handler.init!=="function")return;
try{handler.init({root:root,active:active,pagePath:pagePath,has:hasPlugin});}catch(_e){}
}
var api={
version:1,
active:active,
pagePath:pagePath,
registry:registry,
has:hasPlugin,
register:function(id,handler){
registry[id]=handler;
if(document.readyState!=="loading"){initPlugin(id,handler);}
}
};
window.GetOnPlugins=api;
api.register("contact",{
init:function(ctx){
if(!ctx.has("contact"))return;
var forms=document.querySelectorAll("form[data-gs-form]");
for(var i=0;i<forms.length;i+=1){
(function(form){
var formId=form.getAttribute("data-gs-form")||"";
if(!formId)return;
var tokenInput=form.querySelector('input[name="_t"]');
var statusEl=form.querySelector(".gs-form-status");
var btn=form.querySelector('button[type="submit"]');
function setStatus(msg,isErr){
if(!statusEl)return;
statusEl.textContent=msg||"";
statusEl.setAttribute("data-state",isErr?"error":"ok");
}
function fetchToken(){
return fetch("/_forms/"+encodeURIComponent(formId)+"/token",{credentials:"same-origin",cache:"no-store"})
.then(function(r){return r.ok?r.json():null;})
.then(function(d){
if(d&&d.ok&&typeof d.token==="string"&&tokenInput){tokenInput.value=d.token;return d.token;}
return "";
})
.catch(function(){return "";});
}
fetchToken();
form.addEventListener("submit",function(ev){
ev.preventDefault();
if(btn&&btn.disabled)return;
setStatus("Sending...",false);
if(btn){btn.disabled=true;btn.setAttribute("aria-busy","true");}
var ready=tokenInput&&tokenInput.value?Promise.resolve(tokenInput.value):fetchToken();
ready.then(function(){
var body=new URLSearchParams(new FormData(form));
return fetch(form.getAttribute("action")||"/_forms/"+encodeURIComponent(formId),{
method:"POST",
credentials:"same-origin",
headers:{"Content-Type":"application/x-www-form-urlencoded"},
body:body.toString()
});
}).then(function(res){
if(res.ok){
form.reset();
fetchToken();
setStatus("Thank you! Your message has been sent.",false);
return;
}
if(res.status===429){
setStatus("Too many messages right now. Please try again in a few minutes.",true);
return;
}
if(res.status===400){
setStatus("Please check all required fields and try again.",true);
return;
}
setStatus("Could not send your message. Please try again shortly.",true);
}).catch(function(){
setStatus("Network error while sending your message. Please try again.",true);
}).finally(function(){
if(btn){btn.disabled=false;btn.removeAttribute("aria-busy");}
});
});
})(forms[i]);
}
}
});
api.register("ui",{
init:function(){
var toggles=document.querySelectorAll(".gs-nav-toggle");
for(var i=0;i<toggles.length;i+=1){
(function(btn){
btn.addEventListener("click",function(){
var header=btn.closest(".gs-header");
var nav=header?header.querySelector(".gs-nav"):null;
if(!nav)return;
var open=nav.getAttribute("data-open")==="true";
nav.setAttribute("data-open",open?"false":"true");
btn.setAttribute("aria-expanded",open?"false":"true");
});
})(toggles[i]);
}
var accButtons=document.querySelectorAll("[data-gs-accordion-trigger]");
for(var j=0;j<accButtons.length;j+=1){
(function(btn){
btn.addEventListener("click",function(){
var item=btn.closest(".gs-accordion-item");
var panel=item?item.querySelector("[data-gs-accordion-panel]"):null;
if(!panel)return;
var expanded=btn.getAttribute("aria-expanded")==="true";
btn.setAttribute("aria-expanded",expanded?"false":"true");
if(expanded){panel.setAttribute("hidden","");}else{panel.removeAttribute("hidden");}
});
})(accButtons[j]);
}
}
});
api.register("analytics",{
init:function(ctx){
if(!ctx.has("analytics"))return;
if(navigator.doNotTrack==="1"||typeof navigator.sendBeacon!=="function")return;
try{
navigator.sendBeacon("/_gs/stats",new Blob([JSON.stringify({path:ctx.pagePath})],{type:"application/json"}));
}catch(_e){}
}
});
function bootAll(){
var keys=Object.keys(registry);
for(var i=0;i<keys.length;i+=1){initPlugin(keys[i],registry[keys[i]]);}
}
if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",bootAll,{once:true});
}else{
bootAll();
}
})();`;
}

export function renderHtml(input: {
  settings: SiteSettings;
  page: PublishPage;
  canonical: string;
  css?: string;
  scriptSrc?: string | null;
  activePlugins?: string[];
  nav: Array<{ label: string; href: string; pageId?: string }>;
  images: Map<string, { src: string; alt?: string }>;
  logoUrl: string | null;
  ogImageUrl: string | null;
  contactEnabled?: boolean;
  pagePath: string;
  collectedForms?: ContactFormConfig[];
}): string {
  let css = input.css ?? readRendererCss();
  const title = escapeHtml(input.page.seoTitle || input.page.title || input.settings.businessName);
  const desc = escapeHtml(
    input.page.seoDescription ||
      input.page.description ||
      input.settings.seo?.description ||
      input.settings.tagline ||
      input.settings.businessName,
  );
  const navHtml = input.nav
    .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("");
  const pageHrefById = new Map<string, string>();
  for (const item of input.nav) {
    if (item.pageId) pageHrefById.set(item.pageId, item.href);
  }

  const activePlugins = [
    ...(input.activePlugins ?? []),
    ...(input.contactEnabled && !(input.activePlugins ?? []).includes("contact") ? ["contact"] : []),
  ];
  const ctx: RenderHtmlContext = {
    settings: input.settings,
    images: input.images,
    pageHrefById,
    contactEnabled: Boolean(input.contactEnabled || activePlugins.includes("contact")),
    pagePath: input.pagePath,
    collectedForms: input.collectedForms ?? [],
  };

  let blocksHtml = "";
  if (isPageContentV5(input.page.blocks)) {
    const compiled = compileStyles(input.page.blocks.root, { customCss: input.page.blocks.css });
    if (compiled.css) {
      css = `${css}\n${compiled.css}`;
    }
    blocksHtml = renderV5NodeHtml(input.page.blocks.root, ctx, compiled.classes);
  } else {
    const flatBlocks = collectContentBlocks(input.page.blocks);
    blocksHtml = flatBlocks
      .map((blk) => renderSmartBlockHtml(blk.id, blk.type, blk.props, ctx))
      .join("\n");
  }

  const footerMetaParts: string[] = [];
  if (input.settings.phone) footerMetaParts.push(`<p style="margin:0 0 4px">${escapeHtml(input.settings.phone)}</p>`);
  if (input.settings.email) footerMetaParts.push(`<p style="margin:0 0 4px">${escapeHtml(input.settings.email)}</p>`);
  if (input.settings.address) footerMetaParts.push(`<p style="margin:0 0 4px">${escapeHtml(input.settings.address)}</p>`);
  if (input.settings.hours) footerMetaParts.push(`<p style="margin:0 0 4px">${escapeHtml(input.settings.hours)}</p>`);

  const scriptTag = input.scriptSrc
    ? `\n<script src="${escapeHtml(input.scriptSrc)}" defer></script>`
    : "";

  return `<!doctype html>
<html lang="${escapeHtml(input.settings.locale || "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${escapeHtml(input.canonical)}">
${input.page.noindex ? '<meta name="robots" content="noindex">' : ""}
<style data-gs="1">${css}</style>${scriptTag}
</head>
<body>
<div class="gs-root" data-gs-plugins="${escapeHtml(activePlugins.join(","))}" data-gs-page="${escapeHtml(
    input.pagePath,
  )}" style="${cssVarsInline(input.settings.theme)}">
<header class="gs-header"><div class="gs-container gs-header-inner"><a class="gs-brand" href="/">${
    input.logoUrl
      ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(input.settings.businessName)}" style="height:32px;width:auto">`
      : escapeHtml(input.settings.businessName)
  }${
    input.settings.tagline
      ? `<span style="display:block;font-size:.75rem;font-weight:400;opacity:.75">${escapeHtml(
          input.settings.tagline,
        )}</span>`
      : ""
  }</a>${
    navHtml
      ? `<button type="button" class="gs-nav-toggle" aria-expanded="false" aria-label="Toggle navigation">Menu</button><nav class="gs-nav" aria-label="Main navigation" data-open="false">${navHtml}</nav>`
      : ""
  }</div></header>
<main>${blocksHtml}</main>
<footer class="gs-footer"><div class="gs-container"><div class="gs-grid"><div><p style="font-weight:700;margin:0 0 6px">${escapeHtml(
    input.settings.businessName,
  )}</p>${footerMetaParts.join("")}</div>${
    navHtml ? `<div style="display:flex;flex-direction:column;gap:6px">${navHtml}</div>` : ""
  }</div>${
    input.settings.showWatermark
      ? '<p class="gs-watermark" data-gs-protect="1">Built with Get-On</p>'
      : ""
  }</div></footer>
</div>
</body>
</html>`;
}

export function buildSite(input: BuildSiteInput): {
  files: Record<string, BuiltFile>;
  shared: Record<string, BuiltFile>;
  warnings: string[];
  totalBytes: number;
  forms: ContactFormConfig[];
  rendererVersion: number;
  cssHash: string;
  cssBytes: number;
} {
  const encoder = new TextEncoder();
  const files: Record<string, BuiltFile> = {};
  const shared: Record<string, BuiltFile> = {};
  const css = readRendererCss();
  const runtimeScript = buildSiteRuntimeScript();
  const jsHash = fnv1aHex(runtimeScript);
  const scriptPath = `assets/site-${jsHash}.js`;
  const scriptBytes = encoder.encode(runtimeScript);
  files[scriptPath] = {
    body: scriptBytes,
    contentType: "text/javascript; charset=utf-8",
    size: scriptBytes.byteLength,
  };

  const imageMap = new Map<string, { src: string; alt?: string }>();
  for (const img of input.images ?? []) {
    const ext = (img.mime || img.contentType || "image/webp").includes("png") ? "png" : "webp";
    const filePath = `media/${img.id}.${ext}`;
    files[filePath] = {
      body: img.bytes,
      contentType: img.mime || img.contentType || "image/webp",
      size: img.bytes.byteLength,
    };
    imageMap.set(img.id, { src: `/${filePath}`, alt: img.alt ?? "" });
  }

  let logoUrl: string | null = null;
  if (input.settings.logo) {
    const ext = input.settings.logo.contentType.includes("png") ? "png" : "webp";
    const logoPath = `assets/logo.${ext}`;
    files[logoPath] = {
      body: input.settings.logo.bytes,
      contentType: input.settings.logo.contentType,
      size: input.settings.logo.bytes.byteLength,
    };
    logoUrl = `/${logoPath}`;
  }

  const nav = input.pages
    .filter((p) => !p.hidden && p.showInMenu !== false)
    .map((p) => ({
      label: p.title,
      href: p.slug ? `/${p.slug}` : "/",
      pageId: p.id,
    }));

  const host = input.primaryHost || `${input.siteId}.${input.rootDomain || "get-on.tech"}`;
  const activePlugins = [
    ...(input.activePlugins ?? []),
    ...(input.forms?.enabled && !(input.activePlugins ?? []).includes("contact") ? ["contact"] : []),
  ];
  const contactEnabled = activePlugins.includes("contact");
  const forms: ContactFormConfig[] = [];

  for (const page of input.pages) {
    if (page.hidden) continue;
    const cleanSlug = page.slug.replace(/^\/+|\/+$/g, "");
    const outPath = cleanSlug ? `${cleanSlug}/index.html` : "index.html";
    const html = renderHtml({
      settings: input.settings,
      page,
      canonical: `https://${host}${cleanSlug ? `/${cleanSlug}` : "/"}`,
      css,
      scriptSrc: `/${scriptPath}`,
      activePlugins,
      nav,
      images: imageMap,
      logoUrl,
      ogImageUrl: null,
      contactEnabled,
      pagePath: cleanSlug ? `/${cleanSlug}` : "/",
      collectedForms: forms,
    });
    const bytes = encoder.encode(html);
    files[outPath] = {
      body: bytes,
      contentType: "text/html; charset=utf-8",
      size: bytes.byteLength,
    };
  }

  const cssBytes = encoder.encode(css).byteLength;
  const cssHash = fnv1aHex(css);
  const totalBytes = Object.values(files).reduce((sum, f) => sum + f.size, 0);
  return {
    files,
    shared,
    warnings: [],
    totalBytes,
    forms,
    rendererVersion: RENDERER_CSS_VERSION,
    cssHash,
    cssBytes,
  };
}
