import { createHash } from "node:crypto";
import type { TemplatePackage } from "@get-on/templates";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? "null" : encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
    .join(",")}}`;
}

export function templatePackageHash(pkg: TemplatePackage): string {
  return createHash("sha256").update(canonical(pkg)).digest("hex");
}

export function templatePackageBytes(pkg: TemplatePackage): number {
  return Buffer.byteLength(canonical(pkg), "utf8");
}
