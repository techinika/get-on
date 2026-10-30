interface Env {
  supportEmail: string;
  privacyEmail: string;
  abuseEmail: string;
  teamEmail: string;
  emailTransport: string;
  workerSharedSecret: string;
  appOrigin: string;
  formTokenSecret: string;
  formTokenSecretPrevious: string;
  ipHashSalt: string;
  enableGoogleAuth: boolean;
  supportWhatsapp: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  NEXT_PUBLIC_GA_MEASUREMENT_ID: string;
  FIELD_KEYS: string;
  FIELD_KEY_CURRENT: number;
  HEARTBEAT_URL: string;
}

function getEnv(): Env {
  return {
    supportEmail: process.env.TEAM_EMAIL ?? process.env.SUPPORT_EMAIL ?? "team@get-on.tech",
    privacyEmail: process.env.TEAM_EMAIL ?? process.env.SUPPORT_EMAIL ?? "team@get-on.tech",
    abuseEmail: process.env.TEAM_EMAIL ?? process.env.ABUSE_EMAIL ?? "team@get-on.tech",
    teamEmail: process.env.TEAM_EMAIL ?? "team@get-on.tech",
    emailTransport: process.env.EMAIL_TRANSPORT ?? "console",
    workerSharedSecret: process.env.WORKER_SHARED_SECRET ?? "",
    appOrigin: process.env.APP_ORIGIN ?? "",
    formTokenSecret: process.env.FORM_TOKEN_SECRET ?? "dev-form-token-secret-change-me",
    formTokenSecretPrevious: process.env.FORM_TOKEN_SECRET_PREVIOUS ?? "",
    ipHashSalt: process.env.IP_HASH_SALT ?? "dev-salt",
    enableGoogleAuth: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true",
    supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_ORIGIN ?? "",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
    FIELD_KEYS: process.env.FIELD_KEYS ?? '{"1": ""}',
    FIELD_KEY_CURRENT: Number(process.env.FIELD_KEY_CURRENT ?? 1),
    HEARTBEAT_URL: process.env.HEARTBEAT_URL ?? "",
  };
}

const env = getEnv();
export default env;