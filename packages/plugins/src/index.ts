export type PluginManifest = {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "available" | "planned";
  freeOk: boolean;
  nav: Array<{ label: string; route: string }>;
  settingsRoute: string;
};

export const PLUGIN_MANIFESTS: PluginManifest[] = [
  {
    id: "contact",
    name: "Contact forms",
    description: "Receive enquiries from visitors on your website with spam protection and email alerts.",
    icon: "mail",
    status: "available",
    freeOk: true,
    nav: [{ label: "Messages", route: "/messages" }],
    settingsRoute: "/plugins/contact",
  },
];

export type PluginSandboxPermissions = {
  /** Allow outbound HTTPS requests from inside the isolated sandbox (connect-src https:). */
  allowNetwork?: boolean;
  /** Allow HTML form submission inside the sandbox frame (sandbox allow-forms). */
  allowForms?: boolean;
  /** Allow opening external links cleanly on user interaction (allow-popups allow-popups-to-escape-sandbox). */
  allowPopups?: boolean;
  /** Allow validated http(s) navigation requests through the host postMessage bridge. */
  allowNavigate?: boolean;
  /** Allow clamped height resizing (48..2400px) through the host postMessage bridge. Defaults to true. */
  allowResize?: boolean;
};

export type NormalizedPluginSandboxPermissions = {
  allowNetwork: boolean;
  allowForms: boolean;
  allowPopups: boolean;
  allowNavigate: boolean;
  allowResize: boolean;
};

export type PluginMountPlacement = "inline" | "floating" | "headless";

export type ThirdPartyPluginDefinition = {
  id: string;
  name?: string;
  /** JavaScript code executed exclusively inside an opaque-origin sandboxed iframe. */
  script: string;
  /** Optional sanitized HTML markup mounted inside the sandbox iframe body. */
  html?: string;
  /** Optional sanitized CSS scoped to the sandbox iframe document. */
  css?: string;
  /** Plain JSON configuration forwarded to the sandboxed plugin via postMessage. */
  config?: Record<string, unknown>;
  /** Where the sandboxed plugin mounts when placed automatically on pages. Defaults to "inline". */
  placement?: PluginMountPlacement;
  /** Initial iframe height in pixels for visible placements (48..2400). */
  defaultHeight?: number;
  /** Least-privilege sandbox permissions. */
  permissions?: PluginSandboxPermissions;
  /** Toggle plugin without removing its configuration. Defaults to true. */
  enabled?: boolean;
};

const MAX_PLUGIN_COUNT = 20;
const MAX_PLUGIN_SCRIPT_BYTES = 256 * 1024;
const MAX_PLUGIN_MARKUP_BYTES = 128 * 1024;
const FORBIDDEN_CONFIG_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function fnv1aHex(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function normalizePluginId(rawId: string, fallbackSeed = "plugin"): string {
  const lowered = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (lowered.length >= 2 && lowered.length <= 40) return lowered;
  const digest = fnv1aHex(rawId || fallbackSeed);
  const base = lowered || "plugin";
  return `${base}_${digest}`.slice(0, 40);
}

function sanitizeJsonValue(value: unknown, depth: number): unknown {
  if (depth > 4) return null;
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return typeof value === "string" ? value.slice(0, 8192) : value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
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

export function sanitizePluginConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return sanitizeJsonValue(raw, 0) as Record<string, unknown>;
}

export function sandboxPermissionsOf(
  raw?: PluginSandboxPermissions | null,
): NormalizedPluginSandboxPermissions {
  return {
    allowNetwork: raw?.allowNetwork === true,
    allowForms: raw?.allowForms === true,
    allowPopups: raw?.allowPopups === true,
    allowNavigate: raw?.allowNavigate === true,
    allowResize: raw?.allowResize !== false,
  };
}

/**
 * Computes the strict iframe `sandbox` attribute token list.
 * NEVER grants `allow-same-origin`, `allow-top-navigation`, or `allow-modals`.
 */
export function sandboxAttributesForPermissions(
  raw?: PluginSandboxPermissions | null,
): string {
  const perms = sandboxPermissionsOf(raw);
  const tokens = ["allow-scripts"];
  if (perms.allowForms) tokens.push("allow-forms");
  if (perms.allowPopups) {
    tokens.push("allow-popups", "allow-popups-to-escape-sandbox");
  }
  return tokens.join(" ");
}

export function normalizeThirdPartyPlugins(raw: unknown): ThirdPartyPluginDefinition[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ThirdPartyPluginDefinition[] = [];

  for (let i = 0; i < raw.length && out.length < MAX_PLUGIN_COUNT; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    if (rec.enabled === false) continue;

    const rawId = typeof rec.id === "string" ? rec.id : `plugin_${i + 1}`;
    const id = normalizePluginId(rawId, `plugin_${i + 1}`);
    if (seen.has(id)) continue;

    const script = typeof rec.script === "string" ? rec.script.trim() : "";
    const html = typeof rec.html === "string" ? rec.html : "";
    const css = typeof rec.css === "string" ? rec.css : "";
    if (!script && !html.trim()) continue;
    if (script.length > MAX_PLUGIN_SCRIPT_BYTES) continue;
    if (html.length > MAX_PLUGIN_MARKUP_BYTES || css.length > MAX_PLUGIN_MARKUP_BYTES) continue;

    const placementRaw = typeof rec.placement === "string" ? rec.placement : "inline";
    const placement: PluginMountPlacement =
      placementRaw === "floating" || placementRaw === "headless" ? placementRaw : "inline";

    const heightNum = Number(rec.defaultHeight);
    const defaultHeight =
      placement === "headless"
        ? 0
        : Number.isFinite(heightNum)
          ? Math.max(48, Math.min(2400, Math.round(heightNum)))
          : 220;

    const permsRaw =
      rec.permissions && typeof rec.permissions === "object"
        ? (rec.permissions as PluginSandboxPermissions)
        : undefined;

    seen.add(id);
    out.push({
      id,
      name:
        typeof rec.name === "string" && rec.name.trim()
          ? rec.name.trim().slice(0, 80)
          : id,
      script,
      html,
      css,
      config: sanitizePluginConfig(rec.config),
      placement,
      defaultHeight,
      permissions: sandboxPermissionsOf(permsRaw),
      enabled: true,
    });
  }

  return out;
}
