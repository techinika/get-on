import type { SampleProfile } from "./types";

export type RealProfile = SampleProfile & {
  businessType?: string;
  city?: string;
  region?: string;
  country?: string;
  areaServed?: string;
  logo?: boolean;
  ownerFirstName?: string;
};

export type ResolveResult = {
  value: unknown;
  missing: string[];
  used: string[];
  hadVariable: boolean;
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  "salon-beauty": "Salon and beauty",
  shop: "Shop",
  portfolio: "Portfolio",
  consultant: "Consultant",
  "church-community": "Community",
  "repair-services": "Repair services",
  "farm-agriculture": "Farm and agriculture",
  "education-tutoring": "Education and tutoring",
  other: "Business",
};

export function businessTypeLabel(value: string | undefined): string {
  if (!value) return "";
  return BUSINESS_TYPE_LABELS[value] ?? value.replace(/-/g, " ");
}

function firstLine(value: string | undefined, max = 0): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (!max || text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

export function variableValues(profile: RealProfile, now = new Date()): Record<string, string> {
  const name = profile.businessName?.trim() ?? "";
  const tagline = profile.tagline?.trim() ?? "";
  const description = profile.description?.trim() ?? "";
  const phone = profile.phone?.trim() ?? "";
  const email = profile.email?.trim() ?? "";
  const address = profile.address?.trim() ?? "";
  const hours = profile.hoursNote?.trim() ?? "";
  const type = businessTypeLabel(profile.businessType);
  const city = profile.city?.trim() ?? "";
  const region = profile.region?.trim() ?? "";
  const country = profile.country?.trim() ?? "";
  const areaServed = profile.areaServed?.trim() ?? "";
  const values: Record<string, string> = {
    "business.name": name,
    "business.tagline": tagline,
    "business.description": description,
    "business.type": type,
    "business.city": city,
    "business.region": region,
    "business.country": country,
    "business.phone": phone,
    "business.email": email,
    "business.address": address,
    "business.hoursSummary": hours,
    "business.areaServed": areaServed,
    "site.address": address,
    "owner.firstName": profile.ownerFirstName?.trim() ?? "",
    year: String(now.getFullYear()),
    "business.descriptionShort": firstLine(description, 155),
    "business.descriptionFooter": firstLine(description, 200),
  };
  values.businessName = name;
  values.tagline = tagline;
  values.description = description;
  values.phone = phone;
  values.email = email;
  values.address = address;
  values.hoursNote = hours;
  values.social = profile.social?.[0]?.url ?? "";
  return values;
}

const VARIABLE_RE = /\{\{\s*([A-Za-z0-9_.]+)\s*(?:\|([^}]*))?\}\}/g;

export function resolveTemplateString(
  input: string,
  values: Record<string, string>,
  missing?: Set<string>,
): { value: string; hadVariable: boolean; used: string[] } {
  let hadVariable = false;
  const used: string[] = [];
  const value = input.replace(VARIABLE_RE, (_match, key: string, fallback?: string) => {
    hadVariable = true;
    const resolved = values[key] ?? "";
    if (resolved) {
      used.push(key);
      return resolved;
    }
    const safeFallback = (fallback ?? "").trim();
    if (safeFallback) {
      used.push(`${key}|fallback`);
      return safeFallback;
    }
    missing?.add(key);
    return "";
  });
  return { value, hadVariable, used };
}

export function resolveDeep(
  value: unknown,
  values: Record<string, string>,
  missing: Set<string>,
): unknown {
  if (typeof value === "string") return resolveTemplateString(value, values, missing).value;
  if (Array.isArray(value)) return value.map((item) => resolveDeep(item, values, missing));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) out[key] = resolveDeep(child, values, missing);
    return out;
  }
  return value;
}

const CONDITION_KEYS = ["phone", "email", "address", "hours", "social", "logo", "description", "tagline", "city", "areaServed"] as const;
export type IncludeIf = (typeof CONDITION_KEYS)[number];

export function hasCondition(profile: RealProfile, key: string): boolean {
  switch (key) {
    case "phone": return Boolean(profile.phone?.trim());
    case "email": return Boolean(profile.email?.trim());
    case "address": return Boolean(profile.address?.trim());
    case "hours": return Boolean(profile.hoursNote?.trim());
    case "social": return Boolean(profile.social?.some((item) => item.url?.trim()));
    case "logo": return profile.logo === true;
    case "description": return Boolean(profile.description?.trim());
    case "tagline": return Boolean(profile.tagline?.trim());
    case "city": return Boolean(profile.city?.trim());
    case "areaServed": return Boolean(profile.areaServed?.trim());
    default: return true;
  }
}

export function isKnownCondition(key: unknown): key is IncludeIf {
  return typeof key === "string" && (CONDITION_KEYS as readonly string[]).includes(key);
}

function isEmptyObject(value: Record<string, unknown>): boolean {
  const meaningful = Object.entries(value).filter(([key]) => !["id", "type", "sec", "includeIf", "slotMeta"].includes(key));
  if (meaningful.length === 0) return true;
  return meaningful.every(([, child]) => {
    if (child == null) return true;
    if (typeof child === "string") return child.trim() === "";
    if (Array.isArray(child)) return child.length === 0;
    if (typeof child === "object") return isEmptyObject(child as Record<string, unknown>);
    return false;
  });
}

/**
 * Drops blocks whose condition is missing and, when slotMeta.hideIfEmpty is
 * set, blocks or list items that only contained empty variables.
 */
export function applyVisibility(content: unknown, profile: RealProfile, missing: Set<string>): unknown {
  if (Array.isArray(content)) return content.map((item) => applyVisibility(item, profile, missing));
  if (!content || typeof content !== "object") return content;
  const raw = content as Record<string, unknown>;
  const includeIf = raw.includeIf ?? (raw.props && typeof raw.props === "object" ? (raw.props as Record<string, unknown>).includeIf : undefined);
  if (isKnownCondition(includeIf) && !hasCondition(profile, includeIf)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(raw)) out[key] = applyVisibility(child, profile, missing);
  const props = out.props && typeof out.props === "object" ? (out.props as Record<string, unknown>) : null;
  const slotMeta = out.slotMeta && typeof out.slotMeta === "object" ? (out.slotMeta as Record<string, unknown>) : null;
  if (slotMeta?.hideIfEmpty === true) {
    if (props) {
      if (Array.isArray(props.items)) {
        props.items = (props.items as unknown[]).filter((item) => {
          if (!item || typeof item !== "object") return true;
          const text = Object.values(item as Record<string, unknown>).some((value) => typeof value === "string" && value.trim() !== "");
          return text;
        });
      }
      if (isEmptyObject(props)) return null;
    }
    if (isEmptyObject(out)) return null;
  }
  return out;
}

export type SampleLeak = { kind: "sample" | "example-domain" | "fake-phone"; value: string };

/** Finds template sample details or placeholder patterns left after resolution. */
export function scanSampleLeaks(content: unknown, sample: Partial<SampleProfile>): SampleLeak[] {
  const leaks: SampleLeak[] = [];
  const sampleStrings = [
    sample.businessName,
    sample.tagline,
    sample.description,
    sample.phone,
    sample.email,
    sample.address,
    sample.hoursNote,
    ...(sample.social ?? []).map((item) => item.url),
  ]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length >= 4);
  const seen = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      for (const sampleValue of sampleStrings) {
        if (value.includes(sampleValue)) {
          const key = `sample:${sampleValue}`;
          if (!seen.has(key)) {
            seen.add(key);
            leaks.push({ kind: "sample", value: sampleValue });
          }
        }
      }
      if (/example\.(com|org|net)\b/i.test(value)) {
        const key = `domain:${value}`;
        if (!seen.has(key)) {
          seen.add(key);
          leaks.push({ kind: "example-domain", value });
        }
      }
      if (/(?:\+?1[\s.-]?)?\(?555\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(value)) {
        const key = `phone:${value}`;
        if (!seen.has(key)) {
          seen.add(key);
          leaks.push({ kind: "fake-phone", value });
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(content);
  return leaks;
}

export function scrubSampleLeaks(content: unknown, sample: Partial<SampleProfile>): unknown {
  const sampleStrings = [
    sample.businessName,
    sample.tagline,
    sample.phone,
    sample.email,
    sample.address,
    sample.hoursNote,
    ...(sample.social ?? []).map((item) => item.url),
  ]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length >= 4);
  const clean = (value: unknown): unknown => {
    if (typeof value === "string") {
      let out = value;
      for (const item of sampleStrings) out = out.split(item).join("");
      return out.replace(/\s{2,}/g, " ").trim();
    }
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) out[key] = clean(child);
      return out;
    }
    return value;
  };
  return clean(content);
}
