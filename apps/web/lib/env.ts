const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  enableGoogleAuth: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@get-on.tech",
  supportWhatsapp: process.env.SUPPORT_WHATSAPP_NUMBER ?? "",
};

export default env;
