import {
  collectContentBlocks,
  compileStyles,
  isPageContentV5,
  richTextToPlain,
  sanitizeHtml,
  themeGoogleFontsUrl,
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

export type PluginSandboxPermissionsInput = {
  allowNetwork?: boolean;
  allowForms?: boolean;
  allowPopups?: boolean;
  allowNavigate?: boolean;
  allowResize?: boolean;
};

export type ThirdPartyPluginInput = {
  id: string;
  name?: string;
  script: string;
  html?: string;
  css?: string;
  config?: Record<string, unknown>;
  placement?: "inline" | "floating" | "headless";
  defaultHeight?: number;
  permissions?: PluginSandboxPermissionsInput;
  enabled?: boolean;
};

export type BuildSiteInput = {
  siteId: string;
  subdomain?: string;
  publishId: string;
  builtAt?: Date;
  rootDomain?: string;
  primaryHost?: string | null;
  activePlugins?: string[];
  thirdPartyPlugins?: ThirdPartyPluginInput[];
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

type NormalizedSandboxPlugin = {
  id: string;
  name: string;
  script: string;
  html: string;
  css: string;
  config: Record<string, unknown>;
  placement: "inline" | "floating" | "headless";
  defaultHeight: number;
  permissions: {
    allowNetwork: boolean;
    allowForms: boolean;
    allowPopups: boolean;
    allowNavigate: boolean;
    allowResize: boolean;
  };
  docPath: string;
  scriptPath: string;
  sandboxAttr: string;
};

const FORBIDDEN_CONFIG_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function normalizePluginId(rawId: string, fallbackSeed = "plugin"): string {
  const lowered = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (lowered.length >= 2 && lowered.length <= 40) return lowered;
  const digest = fnv1aHex(rawId || fallbackSeed);
  const base = lowered || "plugin";
  return `${base}_${digest}`.slice(0, 40);
}

function sanitizeJsonValue(value: unknown, depth: number): unknown {
  if (depth > 4) return null;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 8192);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeJsonValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (count >= 50) break;
      if (FORBIDDEN_CONFIG_KEYS.has(k) || typeof v === "undefined" || typeof v === "function") {
        continue;
      }
      out[k.slice(0, 80)] = sanitizeJsonValue(v, depth + 1);
      count += 1;
    }
    return out;
  }
  return null;
}

function sanitizePluginConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return sanitizeJsonValue(raw, 0) as Record<string, unknown>;
}

function sanitizePluginCss(rawCss: string): string {
  if (!rawCss) return "";
  return rawCss
    .replace(/[<>]/g, "")
    .replace(/@import\b[^;]*(;|$)/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .slice(0, 128 * 1024);
}

function sandboxAttributesForPlugin(perms: NormalizedSandboxPlugin["permissions"]): string {
  const tokens = ["allow-scripts"];
  if (perms.allowForms) tokens.push("allow-forms");
  if (perms.allowPopups) tokens.push("allow-popups", "allow-popups-to-escape-sandbox");
  return tokens.join(" ");
}

function buildPluginSandboxRuntimeJs(plugin: { id: string; script: string }): string {
  return `(function(){
"use strict";
var PLUGIN_ID=${JSON.stringify(plugin.id)};
var rootEl=document.getElementById("gs-plugin-root");
var instanceId=(window.location.hash||"").replace(/^#/,"").slice(0,80);
var channelToken="";
var readyFired=false;
var currentCtx=null;
var callbacks=[];
function deliver(ctx){
for(var i=0;i<callbacks.length;i+=1){
try{callbacks[i](ctx);}catch(_err){}
}
}
function postToHost(payload){
try{
if(window.parent&&window.parent!==window){
window.parent.postMessage(payload,"*");
}
}catch(_err){}
}
var sdk={
version:1,
pluginId:PLUGIN_ID,
instanceId:instanceId,
mount:rootEl,
config:Object.create(null),
onReady:function(fn){
if(typeof fn!=="function")return;
callbacks.push(fn);
if(currentCtx){try{fn(currentCtx);}catch(_err){}}
},
init:function(fn){sdk.onReady(fn);},
resize:function(height){
if(!channelToken||typeof height!=="number"||!isFinite(height))return;
postToHost({type:"gs:plugin:resize",token:channelToken,pluginId:PLUGIN_ID,instanceId:instanceId,height:height});
},
navigate:function(url){
if(!channelToken||typeof url!=="string")return;
postToHost({type:"gs:plugin:navigate",token:channelToken,pluginId:PLUGIN_ID,instanceId:instanceId,url:url});
},
emit:function(name,detail){
if(!channelToken||typeof name!=="string")return;
postToHost({type:"gs:plugin:event",token:channelToken,pluginId:PLUGIN_ID,instanceId:instanceId,name:name,detail:detail===undefined?null:detail});
}
};
window.GetOnPlugin=sdk;
window.addEventListener("message",function(ev){
if(ev.source!==window.parent)return;
var d=ev.data;
if(!d||typeof d!=="object"||d.type!=="gs:plugin:init")return;
if(d.pluginId!==PLUGIN_ID)return;
if(instanceId&&d.instanceId&&d.instanceId!==instanceId)return;
if(typeof d.instanceId==="string"&&d.instanceId&&!instanceId){
instanceId=d.instanceId;
sdk.instanceId=instanceId;
}
if(typeof d.token!=="string"||!d.token)return;
var first=!channelToken;
channelToken=d.token;
sdk.config=d.config&&typeof d.config==="object"?d.config:Object.create(null);
currentCtx={pluginId:PLUGIN_ID,instanceId:instanceId,pagePath:typeof d.pagePath==="string"?d.pagePath:"/",config:sdk.config,mount:rootEl,resize:sdk.resize,navigate:sdk.navigate,emit:sdk.emit};
if(first&&!readyFired){
readyFired=true;
deliver(currentCtx);
}
});
function announce(){
postToHost({type:"gs:plugin:ready",pluginId:PLUGIN_ID,instanceId:instanceId});
}
if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",announce,{once:true});
}else{
announce();
}
try{
(function(GetOnPlugin,root){
"use strict";
${plugin.script}
})(sdk,rootEl);
}catch(_pluginErr){}
})();`;
}

function buildPluginSandboxHtml(
  plugin: NormalizedSandboxPlugin,
  scriptPath: string,
): string {
  const safeCss = sanitizePluginCss(plugin.css);
  const safeMarkup = plugin.html ? sanitizeHtml(plugin.html).html : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(plugin.name)}</title>
<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent;font-family:system-ui,-apple-system,sans-serif}#gs-plugin-root{width:100%}${safeCss}</style>
<script src="/${escapeHtml(scriptPath)}" defer></script>
</head>
<body>
<div id="gs-plugin-root" data-gs-plugin="${escapeHtml(plugin.id)}">${safeMarkup}</div>
</body>
</html>`;
}

function normalizeThirdPartyPlugins(
  raw: ThirdPartyPluginInput[] | undefined,
  encoder: TextEncoder,
): {
  plugins: NormalizedSandboxPlugin[];
  pluginById: Map<string, NormalizedSandboxPlugin>;
  files: Record<string, BuiltFile>;
} {
  const plugins: NormalizedSandboxPlugin[] = [];
  const pluginById = new Map<string, NormalizedSandboxPlugin>();
  const files: Record<string, BuiltFile> = {};
  if (!Array.isArray(raw)) return { plugins, pluginById, files };

  for (let i = 0; i < raw.length && plugins.length < 20; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object" || item.enabled === false) continue;
    const id = normalizePluginId(typeof item.id === "string" ? item.id : `plugin_${i + 1}`, `plugin_${i + 1}`);
    if (pluginById.has(id)) continue;

    const script = typeof item.script === "string" ? item.script.trim() : "";
    const html = typeof item.html === "string" ? item.html : "";
    const css = typeof item.css === "string" ? item.css : "";
    if (!script && !html.trim()) continue;
    if (script.length > 256 * 1024 || html.length > 128 * 1024 || css.length > 128 * 1024) {
      continue;
    }

    const placement =
      item.placement === "floating" || item.placement === "headless" ? item.placement : "inline";
    const heightNum = Number(item.defaultHeight);
    const defaultHeight =
      placement === "headless"
        ? 0
        : Number.isFinite(heightNum)
          ? Math.max(48, Math.min(2400, Math.round(heightNum)))
          : 220;

    const permissions = {
      allowNetwork: item.permissions?.allowNetwork === true,
      allowForms: item.permissions?.allowForms === true,
      allowPopups: item.permissions?.allowPopups === true,
      allowNavigate: item.permissions?.allowNavigate === true,
      allowResize: item.permissions?.allowResize !== false,
    };

    const jsText = buildPluginSandboxRuntimeJs({ id, script });
    const jsHash = fnv1aHex(jsText);
    const scriptPath = `_plugins/${id}/plugin-${jsHash}.js`;
    const docPath = `_plugins/${id}/${permissions.allowNetwork ? "net.html" : "index.html"}`;

    const normalized: NormalizedSandboxPlugin = {
      id,
      name:
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim().slice(0, 80)
          : id,
      script,
      html,
      css,
      config: sanitizePluginConfig(item.config),
      placement,
      defaultHeight,
      permissions,
      docPath,
      scriptPath,
      sandboxAttr: sandboxAttributesForPlugin(permissions),
    };

    const jsBytes = encoder.encode(jsText);
    files[scriptPath] = {
      body: jsBytes,
      contentType: "text/javascript; charset=utf-8",
      size: jsBytes.byteLength,
    };

    const htmlText = buildPluginSandboxHtml(normalized, scriptPath);
    const htmlBytes = encoder.encode(htmlText);
    files[docPath] = {
      body: htmlBytes,
      contentType: "text/html; charset=utf-8",
      size: htmlBytes.byteLength,
    };

    plugins.push(normalized);
    pluginById.set(id, normalized);
  }

  return { plugins, pluginById, files };
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
  thirdPartyPluginById: Map<string, NormalizedSandboxPlugin>;
  mountedThirdPartyPlugins: Set<string>;
  pluginInstanceSeq: number;
};

function renderPluginIframeHtml(
  plugin: NormalizedSandboxPlugin,
  ctx: RenderHtmlContext,
  overrideProps?: Record<string, unknown>,
): string {
  ctx.pluginInstanceSeq += 1;
  ctx.mountedThirdPartyPlugins.add(plugin.id);

  const instanceId = `plg_${plugin.id}_${fnv1aHex(`${ctx.pagePath}:${plugin.id}:${ctx.pluginInstanceSeq}`)}`;
  const blockConfig = overrideProps?.config
    ? sanitizePluginConfig(overrideProps.config)
    : {};
  const mergedConfig = { ...plugin.config, ...blockConfig };
  const placement =
    overrideProps?.placement === "floating" ||
    overrideProps?.placement === "headless" ||
    overrideProps?.placement === "inline"
      ? overrideProps.placement
      : plugin.placement;
  const rawHeight = Number(overrideProps?.height ?? plugin.defaultHeight);
  const height =
    placement === "headless"
      ? 0
      : Number.isFinite(rawHeight)
        ? Math.max(48, Math.min(2400, Math.round(rawHeight)))
        : plugin.defaultHeight;
  const title =
    typeof overrideProps?.title === "string" && overrideProps.title.trim()
      ? overrideProps.title.trim().slice(0, 80)
      : plugin.name;

  const style =
    placement === "headless"
      ? "width:0;height:0;border:0;visibility:hidden;position:absolute"
      : placement === "floating"
        ? `width:360px;max-width:100%;height:${height}px;border:0;display:block;background:transparent`
        : `width:100%;height:${height}px;border:0;display:block;background:transparent`;

  const tabindexAttr = placement === "headless" ? ' tabindex="-1" aria-hidden="true"' : "";
  const loadingAttr = placement === "headless" ? "eager" : "lazy";

  return `<iframe src="/${escapeHtml(plugin.docPath)}#${escapeHtml(instanceId)}" title="${escapeHtml(
    title,
  )}" sandbox="${escapeHtml(
    plugin.sandboxAttr,
  )}" referrerpolicy="no-referrer" loading="${loadingAttr}"${tabindexAttr} data-gs-plugin-frame="1" data-gs-plugin-id="${escapeHtml(
    plugin.id,
  )}" data-gs-plugin-instance="${escapeHtml(instanceId)}" data-gs-plugin-config="${escapeHtml(
    JSON.stringify(mergedConfig),
  )}" data-gs-plugin-resize="${plugin.permissions.allowResize ? "1" : "0"}" data-gs-plugin-navigate="${
    plugin.permissions.allowNavigate ? "1" : "0"
  }" style="${style}"></iframe>`;
}

function renderPluginBlockHtml(
  rawId: string,
  props: Record<string, unknown>,
  ctx: RenderHtmlContext,
  extraClasses = "",
  anchorId?: string,
): string {
  const rawPluginId = typeof props.pluginId === "string" ? props.pluginId : "";
  if (!rawPluginId) return "";
  const plugin = ctx.thirdPartyPluginById.get(normalizePluginId(rawPluginId));
  if (!plugin) return "";

  const attrs = [
    anchorId ? `id="${escapeHtml(anchorId)}"` : "",
    rawId ? `data-gs-node="${escapeHtml(rawId)}"` : "",
    `data-gs-block="plugin"`,
    `data-gs-plugin-section="1"`,
    `data-gs-plugin-id="${escapeHtml(plugin.id)}"`,
  ]
    .filter(Boolean)
    .join(" ");

  const iframeHtml = renderPluginIframeHtml(plugin, ctx, props);
  const placement =
    props.placement === "floating" || props.placement === "headless" ? props.placement : "inline";
  if (placement === "headless") {
    return `<div class="gs-plugin-headless" ${attrs} style="position:absolute;width:0;height:0;overflow:hidden;border:0;pointer-events:none" aria-hidden="true">${iframeHtml}</div>`;
  }
  if (placement === "floating") {
    return `<div class="gs-plugin-floating" ${attrs} style="position:fixed;right:16px;bottom:16px;z-index:50;max-width:calc(100vw - 32px)">${iframeHtml}</div>`;
  }
  const sectionClass = ["gs-section gs-plugin-section", extraClasses].filter(Boolean).join(" ");
  return `<section class="${escapeHtml(sectionClass)}" ${attrs}><div class="gs-container">${iframeHtml}</div></section>`;
}

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

function renderCardItemHtml(
  item: Record<string, unknown>,
  idx: number,
  ctx: RenderHtmlContext,
  options: { numbered?: boolean; expandable?: boolean } = {},
): string {
  const itemImgId =
    typeof item.imageId === "string"
      ? item.imageId
      : typeof item.photoId === "string"
        ? item.photoId
        : "";
  const itemImg = itemImgId ? ctx.images.get(itemImgId) : undefined;
  const indexLabel =
    typeof item.number === "string"
      ? item.number
      : options.numbered
        ? String(idx + 1).padStart(2, "0")
        : "";
  const metaParts = [item.time, item.duration, item.level, item.year, item.coordinates]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const features = Array.isArray(item.features)
    ? item.features.map((f) => String(f)).filter(Boolean)
    : [];
  const priceMonthly = typeof item.price === "string" ? item.price : "";
  const priceAnnual = typeof item.annualPrice === "string" ? item.annualPrice : "";
  const highlightedAttr = item.highlighted ? ' data-gs-highlighted="true"' : "";

  const parts: string[] = [`<div class="gs-card"${highlightedAttr}>`];
  if (indexLabel) parts.push(`<span class="gs-index-num">${escapeHtml(indexLabel)}</span>`);
  if (itemImg) {
    parts.push(
      `<img src="${escapeHtml(itemImg.src)}" alt="${escapeHtml(String(item.alt ?? item.name ?? item.title ?? itemImg.alt ?? ""))}" class="gs-card-img">`,
    );
  }
  parts.push(`<div class="gs-card-body"><div class="gs-card-head"><div>`);
  if (typeof item.category === "string" && item.category) {
    parts.push(`<p class="gs-meta-tag">${escapeHtml(item.category)}</p>`);
  }
  if (typeof item.value === "string") parts.push(`<p class="gs-stat-val">${escapeHtml(item.value)}</p>`);
  if (typeof item.title === "string") parts.push(`<h3>${escapeHtml(item.title)}</h3>`);
  if (typeof item.name === "string") parts.push(`<h3>${escapeHtml(item.name)}</h3>`);
  if (typeof item.role === "string") parts.push(`<p class="gs-card-sub">${escapeHtml(item.role)}</p>`);
  parts.push(`</div>`);
  if (priceMonthly) {
    parts.push(
      `<span class="gs-price"${priceAnnual ? ` data-gs-price-monthly="${escapeHtml(priceMonthly)}" data-gs-price-annual="${escapeHtml(priceAnnual)}"` : ""}>${escapeHtml(priceMonthly)}</span>`,
    );
  }
  parts.push(`</div>`);
  if (metaParts.length > 0) {
    parts.push(`<p class="gs-meta-row">${escapeHtml(metaParts.join(" · "))}</p>`);
  }
  if (typeof item.text === "string" && item.text) parts.push(`<p class="gs-card-copy">${escapeHtml(item.text)}</p>`);
  if (typeof item.description === "string" && item.description) {
    parts.push(`<p class="gs-card-copy">${escapeHtml(item.description)}</p>`);
  }
  if (typeof item.quote === "string" && item.quote) {
    parts.push(`<p class="gs-card-copy gs-quote">${escapeHtml(item.quote)}</p>`);
  }
  if (features.length > 0) {
    parts.push(`<ul class="gs-card-list">${features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`);
  }
  if (typeof item.author === "string" && item.author) {
    parts.push(`<p class="gs-card-author">${escapeHtml(item.author)}</p>`);
  }
  if (typeof item.buttonLabel === "string" && item.buttonLabel && item.buttonLink) {
    parts.push(
      `<p style="margin:12px 0 0"><a href="${escapeHtml(resolveLinkHref(item.buttonLink, ctx.pageHrefById))}" class="gs-inline-link">${escapeHtml(item.buttonLabel)}</a></p>`,
    );
  }
  if (options.expandable && typeof item.details === "string" && item.details) {
    const expanded = idx === 0;
    parts.push(
      `<div style="margin-top:12px"><button type="button" class="gs-expand-btn" data-gs-expand-trigger="" aria-expanded="${
        expanded ? "true" : "false"
      }">${expanded ? "Hide details" : "Treatment details"}</button><p class="gs-expand-panel" data-gs-expand-panel=""${
        expanded ? "" : " hidden"
      }>${escapeHtml(item.details)}</p></div>`,
    );
  }
  parts.push(`</div></div>`);
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
  const tone = typeof props.tone === "string" ? props.tone : "";
  const attrs = [
    anchorId ? `id="${escapeHtml(anchorId)}"` : "",
    rawId ? `data-gs-node="${escapeHtml(rawId)}"` : "",
    `data-gs-block="${escapeHtml(type)}"`,
    tone ? `data-gs-tone="${escapeHtml(tone)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (type === "contact-form") {
    return renderContactFormHtml(rawId, props, ctx, attrs);
  }
  if (type === "plugin" || (type === "custom-code" && typeof props.pluginId === "string")) {
    return renderPluginBlockHtml(rawId, props, ctx, extraClasses, anchorId);
  }

  const eyebrow = typeof props.eyebrow === "string" ? props.eyebrow : "";
  const heading = typeof props.heading === "string" ? props.heading : "";
  const subheading = typeof props.subheading === "string" ? props.subheading : "";
  const text = typeof props.text === "string" ? props.text : "";
  const imageId = typeof props.imageId === "string" ? props.imageId : "";
  const layout = typeof props.layout === "string" ? props.layout : "";
  const img = imageId ? ctx.images.get(imageId) : undefined;
  const items = Array.isArray(props.items)
    ? (props.items as Array<Record<string, unknown>>)
    : [];
  const rawTabs = Array.isArray(props.tabs)
    ? (props.tabs as Array<Record<string, unknown>>)
    : [];

  const soft = type === "features" || type === "faq" || type === "testimonials" || type === "newsletter";
  const sectionClass = ["gs-section", soft ? "gs-section--soft" : "", extraClasses]
    .filter(Boolean)
    .join(" ");
  const layoutAttr = layout ? ` data-gs-layout="${escapeHtml(layout)}"` : "";

  const btn1 = typeof props.buttonLabel === "string" ? props.buttonLabel : "";
  const btn2 = typeof props.button2Label === "string" ? props.button2Label : "";
  const actionsParts: string[] = [];
  if (btn1 || btn2) {
    actionsParts.push(`<div class="gs-hero-actions" style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">`);
    if (btn1) {
      actionsParts.push(
        `<a class="gs-btn" href="${escapeHtml(resolveLinkHref(props.buttonLink, ctx.pageHrefById))}">${escapeHtml(btn1)}</a>`,
      );
    }
    if (btn2) {
      actionsParts.push(
        `<a class="gs-btn gs-btn--secondary" href="${escapeHtml(resolveLinkHref(props.button2Link, ctx.pageHrefById))}">${escapeHtml(btn2)}</a>`,
      );
    }
    actionsParts.push(`</div>`);
  }

  if (type === "image-text") {
    const reverseAttr = layout === "split-reverse" ? ' data-gs-reverse="true"' : "";
    const mediaHtml = img
      ? `<div class="gs-split-media"><img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt ?? heading)}"></div>`
      : "";
    const textHtml = `<div>${eyebrow ? `<p class="gs-badge">${escapeHtml(eyebrow)}</p>` : ""}${
      heading ? `<h2>${escapeHtml(heading)}</h2>` : ""
    }${subheading ? `<p style="font-size:1.125rem;opacity:.85">${escapeHtml(subheading)}</p>` : ""}${
      text ? `<p style="max-width:60ch">${escapeHtml(text)}</p>` : ""
    }${actionsParts.join("")}</div>`;
    return `<section class="${escapeHtml(sectionClass)}" ${attrs}${layoutAttr}><div class="gs-container"><div class="gs-split-feature"${reverseAttr}>${mediaHtml}${textHtml}</div></div></section>`;
  }

  if (type === "newsletter") {
    const label = btn1 || "Subscribe";
    const placeholder = typeof props.placeholder === "string" ? props.placeholder : "you@example.com";
    return `<section class="${escapeHtml(sectionClass)}" ${attrs}${layoutAttr}><div class="gs-container"><div class="gs-card" style="max-width:680px;margin-inline:auto;padding:28px">${
      eyebrow ? `<p class="gs-badge">${escapeHtml(eyebrow)}</p>` : ""
    }${heading ? `<h2>${escapeHtml(heading)}</h2>` : ""}${
      subheading ? `<p style="opacity:.85;margin:0 0 8px">${escapeHtml(subheading)}</p>` : ""
    }${text ? `<p style="margin:0">${escapeHtml(text)}</p>` : ""}<form class="gs-newsletter-form" data-gs-newsletter=""><input type="email" required placeholder="${escapeHtml(
      placeholder,
    )}" class="gs-input" aria-label="Email address"><button type="submit" class="gs-btn">${escapeHtml(
      label,
    )}</button></form></div></div></section>`;
  }

  const inner: string[] = [];
  const copyParts: string[] = [];
  if (eyebrow) copyParts.push(`<p class="gs-badge">${escapeHtml(eyebrow)}</p>`);
  if (heading) {
    copyParts.push(
      type === "hero"
        ? `<h1>${escapeHtml(heading)}</h1>`
        : `<h2>${escapeHtml(heading)}</h2>`,
    );
  }
  if (subheading) copyParts.push(`<p>${escapeHtml(subheading)}</p>`);
  if (text) copyParts.push(`<p>${escapeHtml(text)}</p>`);

  const isSplitHero =
    type === "hero" &&
    Boolean(img) &&
    layout !== "centered" &&
    layout !== "minimal" &&
    layout !== "fullbleed" &&
    layout !== "statement";

  if (isSplitHero && img) {
    const mediaHtml = `<div class="gs-hero-media"><img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt ?? heading)}"></div>`;
    const copyHtml = `<div class="gs-hero-copy">${copyParts.join("")}${actionsParts.join("")}</div>`;
    inner.push(
      `<div class="gs-hero-grid">${
        layout === "card-over-image" ? `${mediaHtml}${copyHtml}` : `${copyHtml}${mediaHtml}`
      }</div>`,
    );
  } else {
    if (type === "hero") inner.push(`<div class="gs-hero-copy">`);
    inner.push(...copyParts);
    if (img) {
      inner.push(
        `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt ?? heading)}" style="width:100%;max-height:420px;object-fit:cover;border-radius:var(--s-radius);margin-top:16px">`,
      );
    }
    inner.push(...actionsParts);
    if (type === "hero") inner.push(`</div>`);
  }

  const numbered = layout === "index-list";
  const expandable = (type === "services" || type === "features") && Boolean(props.expandable);

  if (rawTabs.length > 0) {
    inner.push(`<div class="gs-tabs-wrap" data-gs-tabs=""><div class="gs-tablist" role="tablist" aria-label="Categories">`);
    rawTabs.forEach((tab, tIdx) => {
      const tabId = String(tab.id ?? `tab-${tIdx + 1}`);
      const label = String(tab.label ?? `Category ${tIdx + 1}`);
      inner.push(
        `<button type="button" role="tab" aria-selected="${tIdx === 0 ? "true" : "false"}" data-gs-tab="${escapeHtml(
          tabId,
        )}" class="gs-tab-btn${tIdx === 0 ? " is-active" : ""}">${escapeHtml(label)}</button>`,
      );
    });
    inner.push(`</div>`);
    rawTabs.forEach((tab, tIdx) => {
      const tabId = String(tab.id ?? `tab-${tIdx + 1}`);
      const tabImgId =
        typeof tab.featuredImageId === "string"
          ? tab.featuredImageId
          : typeof tab.imageId === "string"
            ? tab.imageId
            : "";
      const tabImg = tabImgId ? ctx.images.get(tabImgId) : undefined;
      const tabIntro = typeof tab.intro === "string" ? tab.intro : "";
      const tabItems = Array.isArray(tab.items) ? (tab.items as Array<Record<string, unknown>>) : [];
      inner.push(`<div data-gs-tab-panel="${escapeHtml(tabId)}"${tIdx === 0 ? "" : " hidden"}>`);
      if (tabImg || tabIntro) {
        inner.push(`<div class="gs-tab-feature">`);
        if (tabImg) {
          inner.push(
            `<img src="${escapeHtml(tabImg.src)}" alt="${escapeHtml(tabImg.alt ?? String(tab.label ?? ""))}" class="gs-tab-feature-img">`,
          );
        }
        if (tabIntro) inner.push(`<p class="gs-tab-intro">${escapeHtml(tabIntro)}</p>`);
        inner.push(`</div>`);
      }
      inner.push(`<div class="gs-grid"${layoutAttr} style="margin-top:18px">`);
      tabItems.forEach((item, idx) => {
        inner.push(renderCardItemHtml(item, idx, ctx, { numbered, expandable }));
      });
      inner.push(`</div></div>`);
    });
    inner.push(`</div>`);
  } else if (type === "faq" && items.length > 0) {
    inner.push(`<div class="gs-accordion">`);
    items.forEach((item, idx) => {
      const q = String(item.question ?? item.title ?? item.name ?? `Question ${idx + 1}`);
      const a = String(item.answer ?? item.text ?? "");
      const panelId = `gs-faq-${fnv1aHex(`${rawId}:${idx}`)}`;
      inner.push(
        `<div class="gs-accordion-item"><button type="button" class="gs-accordion-trigger" data-gs-accordion-trigger="" aria-controls="${panelId}" aria-expanded="${
          idx === 0 ? "true" : "false"
        }"><span>${escapeHtml(q)}</span><span aria-hidden style="opacity:.65">${
          idx === 0 ? "−" : "+"
        }</span></button><div id="${panelId}" class="gs-accordion-panel" data-gs-accordion-panel=""${
          idx === 0 ? "" : " hidden"
        }><p style="margin:0">${escapeHtml(a)}</p></div></div>`,
      );
    });
    inner.push(`</div>`);
  } else if (type === "before-after" && items.length > 0) {
    const first = items[0];
    inner.push(`<div style="margin-top:24px;display:grid;gap:20px">`);
    if (first && (typeof first.beforeText === "string" || typeof first.afterText === "string")) {
      inner.push(
        `<div class="gs-ba-compare"><div class="gs-ba-split"><div class="gs-ba-pane"><span class="gs-meta-tag">Before</span><p style="margin:6px 0 0">${escapeHtml(
          String(first.beforeText ?? first.text ?? ""),
        )}</p></div><div class="gs-ba-pane gs-ba-pane--after" data-gs-ba-after=""><span class="gs-meta-tag">After</span><p style="margin:6px 0 0">${escapeHtml(
          String(first.afterText ?? first.text ?? ""),
        )}</p></div></div><label class="gs-ba-range-label"><span>Compare stage</span><input type="range" min="15" max="100" value="52" class="gs-ba-range" data-gs-ba-range="" aria-label="Compare before and after"></label></div>`,
      );
    }
    inner.push(`<div class="gs-grid"${layoutAttr}>`);
    items.forEach((item, idx) => {
      inner.push(renderCardItemHtml(item, idx, ctx, { numbered, expandable }));
    });
    inner.push(`</div></div>`);
  } else if (type === "pricing" && items.some((i) => typeof i.annualPrice === "string")) {
    inner.push(
      `<div class="gs-billing-wrap" data-gs-billing=""><div class="gs-billing-toggle" role="group" aria-label="Billing interval"><button type="button" class="gs-tab-btn is-active" aria-pressed="true" data-gs-billing-btn="monthly">Monthly</button><button type="button" class="gs-tab-btn" aria-pressed="false" data-gs-billing-btn="annual">Annual (Save 20%)</button></div><div class="gs-grid"${layoutAttr} style="margin-top:22px">`,
    );
    items.forEach((item, idx) => {
      inner.push(renderCardItemHtml(item, idx, ctx, { numbered, expandable }));
    });
    inner.push(`</div></div>`);
  } else if (items.length > 0) {
    inner.push(`<div class="gs-grid"${layoutAttr} style="margin-top:24px">`);
    items.forEach((item, idx) => {
      inner.push(renderCardItemHtml(item, idx, ctx, { numbered, expandable }));
    });
    inner.push(`</div>`);
  }

  return `<section class="${escapeHtml(sectionClass)}" ${attrs}${layoutAttr}><div class="gs-container">${inner.join("")}</div></section>`;
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
if(res.status===503||res.status===404){
setStatus("Contact form is temporarily unavailable. Please try again soon.",true);
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
var tabRoots=document.querySelectorAll("[data-gs-tabs]");
for(var t=0;t<tabRoots.length;t+=1){
(function(wrap){
var btns=wrap.querySelectorAll("[data-gs-tab]");
var panels=wrap.querySelectorAll("[data-gs-tab-panel]");
for(var k=0;k<btns.length;k+=1){
(function(btn){
btn.addEventListener("click",function(){
var target=btn.getAttribute("data-gs-tab");
for(var b=0;b<btns.length;b+=1){
var isSel=btns[b].getAttribute("data-gs-tab")===target;
btns[b].setAttribute("aria-selected",isSel?"true":"false");
if(isSel){btns[b].classList.add("is-active");}else{btns[b].classList.remove("is-active");}
}
for(var p=0;p<panels.length;p+=1){
if(panels[p].getAttribute("data-gs-tab-panel")===target){panels[p].removeAttribute("hidden");}else{panels[p].setAttribute("hidden","");}
}
});
})(btns[k]);
}
})(tabRoots[t]);
}
var billRoots=document.querySelectorAll("[data-gs-billing]");
for(var b=0;b<billRoots.length;b+=1){
(function(wrap){
var btns=wrap.querySelectorAll("[data-gs-billing-btn]");
var prices=wrap.querySelectorAll("[data-gs-price-monthly]");
for(var k=0;k<btns.length;k+=1){
(function(btn){
btn.addEventListener("click",function(){
var mode=btn.getAttribute("data-gs-billing-btn");
for(var x=0;x<btns.length;x+=1){
var on=btns[x]===btn;
btns[x].setAttribute("aria-pressed",on?"true":"false");
if(on){btns[x].classList.add("is-active");}else{btns[x].classList.remove("is-active");}
}
for(var y=0;y<prices.length;y+=1){
var val=mode==="annual"?prices[y].getAttribute("data-gs-price-annual"):prices[y].getAttribute("data-gs-price-monthly");
if(val)prices[y].textContent=val;
}
});
})(btns[k]);
}
})(billRoots[b]);
}
var expBtns=document.querySelectorAll("[data-gs-expand-trigger]");
for(var e=0;e<expBtns.length;e+=1){
(function(btn){
btn.addEventListener("click",function(){
var card=btn.closest(".gs-card");
var panel=card?card.querySelector("[data-gs-expand-panel]"):null;
if(!panel)return;
var expanded=btn.getAttribute("aria-expanded")==="true";
btn.setAttribute("aria-expanded",expanded?"false":"true");
btn.textContent=expanded?"Treatment details":"Hide details";
if(expanded){panel.setAttribute("hidden","");}else{panel.removeAttribute("hidden");}
});
})(expBtns[e]);
}
var ranges=document.querySelectorAll("[data-gs-ba-range]");
for(var r=0;r<ranges.length;r+=1){
(function(inp){
inp.addEventListener("input",function(){
var box=inp.closest(".gs-ba-compare");
var after=box?box.querySelector("[data-gs-ba-after]"):null;
if(after)after.style.opacity=String(Math.max(0.35,Math.min(1,Number(inp.value)/100)));
});
})(ranges[r]);
}
var nls=document.querySelectorAll("[data-gs-newsletter]");
for(var n=0;n<nls.length;n+=1){
(function(form){
form.addEventListener("submit",function(ev){
ev.preventDefault();
var btn=form.querySelector('button[type="submit"]');
if(btn)btn.textContent="Joined";
});
})(nls[n]);
}
}
});
api.register("analytics",{
init:function(ctx){
if(!ctx.has("analytics"))return;
if(navigator.doNotTrack==="1")return;
var referrerHost="";
try{
if(document.referrer){
var refUrl=new URL(document.referrer);
if(refUrl.hostname&&refUrl.hostname!==window.location.hostname){referrerHost=refUrl.hostname.slice(0,120);}
}
}catch(_e){}
var utmSource="";
try{
if(window.location.search&&typeof URLSearchParams==="function"){
var sp=new URLSearchParams(window.location.search);
var us=sp.get("utm_source");
if(us){utmSource=us.trim().slice(0,80);}
}
}catch(_e){}
var bodyObj={path:ctx.pagePath};
if(referrerHost)bodyObj.referrerHost=referrerHost;
if(utmSource)bodyObj.utmSource=utmSource;
var payload=JSON.stringify(bodyObj);
var sent=false;
try{
if(typeof navigator.sendBeacon==="function"){
sent=navigator.sendBeacon("/_gs/stats",new Blob([payload],{type:"application/json"}));
}
}catch(_e){}
if(!sent&&typeof fetch==="function"){
fetch("/_gs/stats",{method:"POST",keepalive:true,credentials:"same-origin",headers:{"Content-Type":"application/json"},body:payload}).catch(function(){});
}
}
});
function bootAll(){
var keys=Object.keys(registry);
for(var i=0;i<keys.length;i+=1){initPlugin(keys[i],registry[keys[i]]);}
}
api.register("sandbox",{
init:function(ctx){
var frames=document.querySelectorAll("iframe[data-gs-plugin-frame]");
if(!frames||!frames.length)return;
var instances=Object.create(null);
function makeToken(){
if(window.crypto&&typeof window.crypto.getRandomValues==="function"){
var arr=new Uint32Array(4);
window.crypto.getRandomValues(arr);
return arr[0].toString(16)+arr[1].toString(16)+arr[2].toString(16)+arr[3].toString(16);
}
return Math.random().toString(36).slice(2)+Date.now().toString(36);
}
function parseConfig(raw){
if(!raw)return Object.create(null);
try{
var parsed=JSON.parse(raw);
return parsed&&typeof parsed==="object"?parsed:Object.create(null);
}catch(_e){return Object.create(null);}
}
function sendInit(rec){
try{
if(rec.frame&&rec.frame.contentWindow){
rec.frame.contentWindow.postMessage({
type:"gs:plugin:init",
token:rec.token,
pluginId:rec.pluginId,
instanceId:rec.instanceId,
pagePath:ctx.pagePath,
config:rec.config
},"*");
}
}catch(_e){}
}
for(var i=0;i<frames.length;i+=1){
(function(frame){
var pluginId=frame.getAttribute("data-gs-plugin-id")||"";
var instanceId=frame.getAttribute("data-gs-plugin-instance")||"";
if(!pluginId||!instanceId)return;
var rec={
frame:frame,
pluginId:pluginId,
instanceId:instanceId,
token:makeToken(),
allowResize:frame.getAttribute("data-gs-plugin-resize")==="1",
allowNavigate:frame.getAttribute("data-gs-plugin-navigate")==="1",
config:parseConfig(frame.getAttribute("data-gs-plugin-config"))
};
instances[instanceId]=rec;
frame.addEventListener("load",function(){sendInit(rec);});
sendInit(rec);
})(frames[i]);
}
window.addEventListener("message",function(ev){
if(ev.origin!=="null")return;
var d=ev.data;
if(!d||typeof d!=="object")return;
var instanceId=typeof d.instanceId==="string"?d.instanceId:"";
var rec=instanceId?instances[instanceId]:null;
if(!rec||!rec.frame||ev.source!==rec.frame.contentWindow)return;
if(d.type==="gs:plugin:ready"){
if(d.pluginId!==rec.pluginId)return;
sendInit(rec);
return;
}
if(typeof d.token!=="string"||d.token!==rec.token)return;
if(d.type==="gs:plugin:resize"){
if(!rec.allowResize||typeof d.height!=="number"||!isFinite(d.height))return;
var clamped=Math.max(48,Math.min(2400,Math.round(d.height)));
rec.frame.style.height=clamped+"px";
return;
}
if(d.type==="gs:plugin:navigate"){
if(!rec.allowNavigate||typeof d.url!=="string")return;
try{
var parsed=new URL(d.url,window.location.origin);
if(parsed.protocol!=="https:"&&parsed.protocol!=="http:")return;
window.location.assign(parsed.toString());
}catch(_e){}
return;
}
if(d.type==="gs:plugin:event"){
try{
var target=rec.frame.parentElement||document;
target.dispatchEvent(new CustomEvent("geton:plugin",{
bubbles:true,
detail:{
pluginId:rec.pluginId,
instanceId:rec.instanceId,
name:typeof d.name==="string"?d.name.slice(0,64):"",
detail:d.detail===undefined?null:d.detail
}
}));
}catch(_e){}
}
});
}
});
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
  thirdPartyPlugins?: NormalizedSandboxPlugin[];
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
  const thirdPartyPluginById = new Map<string, NormalizedSandboxPlugin>();
  for (const plugin of input.thirdPartyPlugins ?? []) {
    thirdPartyPluginById.set(plugin.id, plugin);
  }
  const ctx: RenderHtmlContext = {
    settings: input.settings,
    images: input.images,
    pageHrefById,
    contactEnabled: Boolean(input.contactEnabled || activePlugins.includes("contact")),
    pagePath: input.pagePath,
    collectedForms: input.collectedForms ?? [],
    thirdPartyPluginById,
    mountedThirdPartyPlugins: new Set<string>(),
    pluginInstanceSeq: 0,
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

  const autoInlinePluginsHtml: string[] = [];
  const overlayPluginsHtml: string[] = [];
  for (const plugin of input.thirdPartyPlugins ?? []) {
    if (ctx.mountedThirdPartyPlugins.has(plugin.id)) continue;
    const html = renderPluginBlockHtml(`auto_${plugin.id}`, { pluginId: plugin.id, placement: plugin.placement }, ctx);
    if (!html) continue;
    if (plugin.placement === "floating" || plugin.placement === "headless") {
      overlayPluginsHtml.push(html);
    } else {
      autoInlinePluginsHtml.push(html);
    }
  }

  const footerMetaParts: string[] = [];
  if (input.settings.phone) footerMetaParts.push(`<p style="margin:0 0 4px">${escapeHtml(input.settings.phone)}</p>`);
  if (input.settings.email) footerMetaParts.push(`<p style="margin:0 0 4px">${escapeHtml(input.settings.email)}</p>`);
  if (input.settings.address) footerMetaParts.push(`<p style="margin:0 0 4px">${escapeHtml(input.settings.address)}</p>`);
  if (input.settings.hours) footerMetaParts.push(`<p style="margin:0 0 4px">${escapeHtml(input.settings.hours)}</p>`);

  const scriptTag = input.scriptSrc
    ? `\n<script src="${escapeHtml(input.scriptSrc)}" defer></script>`
    : "";

  const rhythm = input.settings.theme?.design?.rhythm ?? "even";
  const headerStyle = input.settings.theme?.header?.style ?? "classic";
  const presetId = input.settings.theme?.presetId;
  const fontsUrl = themeGoogleFontsUrl(input.settings.theme);
  const templateAttr = presetId ? ` data-gs-template="${escapeHtml(String(presetId))}"` : "";
  const headerPhoneHtml =
    input.settings.phone && headerStyle === "centered"
      ? `<a class="gs-header-utility" href="tel:${escapeHtml(input.settings.phone.replace(/[^+\d]/g, ""))}">${escapeHtml(input.settings.phone)}</a>`
      : "";

  return `<!doctype html>
<html lang="${escapeHtml(input.settings.locale || "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${escapeHtml(input.canonical)}">
${fontsUrl ? `<link rel="stylesheet" href="${escapeHtml(fontsUrl)}">` : ""}
${input.page.noindex ? '<meta name="robots" content="noindex">' : ""}
<style data-gs="1">${css}</style>${scriptTag}
</head>
<body>
<div class="gs-root" data-gs-rhythm="${escapeHtml(String(rhythm))}"${templateAttr} data-gs-plugins="${escapeHtml(activePlugins.join(","))}" data-gs-page="${escapeHtml(
    input.pagePath,
  )}" style="${cssVarsInline(input.settings.theme)}">
<header class="gs-header" data-gs-header="${escapeHtml(String(headerStyle))}"><div class="gs-container gs-header-inner"><a class="gs-brand" href="/">${
    input.logoUrl
      ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(input.settings.businessName)}" style="height:32px;width:auto">`
      : escapeHtml(input.settings.businessName)
  }${
    input.settings.tagline
      ? `<span style="display:block;font-size:.75rem;font-weight:400;opacity:.75">${escapeHtml(
          input.settings.tagline,
        )}</span>`
      : ""
  }</a>${headerPhoneHtml}${
    navHtml
      ? `<button type="button" class="gs-nav-toggle" aria-expanded="false" aria-label="Toggle navigation">Menu</button><nav class="gs-nav" aria-label="Main navigation" data-open="false">${navHtml}</nav>`
      : ""
  }</div></header>
<main>${blocksHtml}${autoInlinePluginsHtml.join("")}</main>${overlayPluginsHtml.join("")}
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
  const normalizedPlugins = normalizeThirdPartyPlugins(input.thirdPartyPlugins, encoder);
  Object.assign(files, normalizedPlugins.files);

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
      thirdPartyPlugins: normalizedPlugins.plugins,
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
