import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

const isProduction = process.env.NODE_ENV === "production";
const prefix = isProduction ? "__Host-" : "";

export const BINDING_COOKIE = `${prefix}gs_chal`;
export const PENDING_COOKIE = `${prefix}gs_pending`;
export const DEVICE_COOKIE = `${prefix}gs_dev`;

const base: Partial<ResponseCookie> = {
  httpOnly: true,
  secure: isProduction,
  path: "/",
  sameSite: "strict",
};

export function bindingCookieOptions(): Partial<ResponseCookie> {
  return { ...base, maxAge: 30 * 60 };
}

export function pendingCookieOptions(): Partial<ResponseCookie> {
  return { ...base, maxAge: 30 * 60 };
}

export function deviceCookieOptions(): Partial<ResponseCookie> {
  return { ...base, maxAge: 365 * 24 * 60 * 60, sameSite: "lax" };
}
