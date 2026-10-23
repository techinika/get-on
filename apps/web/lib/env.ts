function getEnv() {
  return {
    supportEmail: process.env.TEAM_EMAIL ?? process.env.SUPPORT_EMAIL ?? "team@get-on.tech",
    privacyEmail: process.env.TEAM_EMAIL ?? process.env.PRIVACY_EMAIL ?? "team@get-on.tech",
    abuseEmail: process.env.TEAM_EMAIL ?? process.env.ABUSE_EMAIL ?? "team@get-on.tech",
    teamEmail: process.env.TEAM_EMAIL ?? "team@get-on.tech",
    emailTransport: process.env.EMAIL_TRANSPORT ?? "console",
    workerSharedSecret: process.env.WORKER_SHARED_SECRET ?? "",
    appOrigin: process.env.APP_ORIGIN ?? "",
    formTokenSecret: process.env.FORM_TOKEN_SECRET ?? "dev-form-token-secret-change-me",
    formTokenSecretPrevious: process.env.FORM_TOKEN_SECRET_PREVIOUS,
    ipHashSalt: process.env.IP_HASH_SALT ?? "dev-salt",
    enableGoogleAuth: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true",
    supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_ORIGIN ?? "",
  };
}

const env = getEnv();
export default env;
