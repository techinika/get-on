import { createAdminClient } from "@/lib/supabase/admin";

export type TwoFactorPolicy = "required" | "recommended";

export type SecuritySettings = {
  twoFactorPolicy: TwoFactorPolicy;
  otpLength: number;
  loginCodeMinutes: number;
  signupCodeMinutes: number;
  stepUpMinutes: number;
  sessionDays: number;
  sessionIdleDays: number;
  staffSessionHours: number;
  staffIdleMinutes: number;
  staffElevationMinutes: number;
  minPasswordLength: number;
  hibpEnabled: boolean;
  maxLoginFailures: number;
  lockoutMinutes: number;
  registerPerIpHour: number;
  registerPerIpDay: number;
  unverifiedDeleteDays: number;
  disposableBlock: boolean;
  registrationOpen: boolean;
};

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  twoFactorPolicy: "required",
  otpLength: 6,
  loginCodeMinutes: 10,
  signupCodeMinutes: 30,
  stepUpMinutes: 10,
  sessionDays: 30,
  sessionIdleDays: 7,
  staffSessionHours: 8,
  staffIdleMinutes: 30,
  staffElevationMinutes: 30,
  minPasswordLength: 10,
  hibpEnabled: true,
  maxLoginFailures: 10,
  lockoutMinutes: 15,
  registerPerIpHour: 5,
  registerPerIpDay: 20,
  unverifiedDeleteDays: 7,
  disposableBlock: true,
  registrationOpen: true,
};

const CACHE_MS = 60_000;
let cache: { at: number; value: SecuritySettings } | null = null;

export function resetSecuritySettingsCache() {
  cache = null;
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("security_settings").select("*").eq("id", true).maybeSingle();
    if (!data) return DEFAULT_SECURITY_SETTINGS;
    const row = data as Record<string, unknown>;
    const value: SecuritySettings = {
      twoFactorPolicy: row.two_factor_policy === "recommended" ? "recommended" : "required",
      otpLength: Number(row.otp_length ?? 6),
      loginCodeMinutes: Number(row.login_code_minutes ?? 10),
      signupCodeMinutes: Number(row.signup_code_minutes ?? 30),
      stepUpMinutes: Number(row.step_up_minutes ?? 10),
      sessionDays: Number(row.session_days ?? 30),
      sessionIdleDays: Number(row.session_idle_days ?? 7),
      staffSessionHours: Number(row.staff_session_hours ?? 8),
      staffIdleMinutes: Number(row.staff_idle_minutes ?? 30),
      staffElevationMinutes: Number(row.staff_elevation_minutes ?? 30),
      minPasswordLength: Number(row.min_password_length ?? 10),
      hibpEnabled: row.hibp_enabled !== false,
      maxLoginFailures: Number(row.max_login_failures ?? 10),
      lockoutMinutes: Number(row.lockout_minutes ?? 15),
      registerPerIpHour: Number(row.register_per_ip_hour ?? 5),
      registerPerIpDay: Number(row.register_per_ip_day ?? 20),
      unverifiedDeleteDays: Number(row.unverified_delete_days ?? 7),
      disposableBlock: row.disposable_block !== false,
      registrationOpen: row.registration_open !== false,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_SECURITY_SETTINGS;
  }
}
