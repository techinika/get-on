import type { NextConfig } from "next";

function storagePattern() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const parsed = new URL(url);
    return [
      {
        protocol: parsed.protocol.replace(":", "") as "http" | "https",
        hostname: parsed.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@get-on/activity",
    "@get-on/ai",
    "@get-on/billing",
    "@get-on/blocks",
    "@get-on/email",
    "@get-on/permissions",
    "@get-on/plugins",
    "@get-on/publisher",
    "@get-on/renderer",
    "@get-on/site-package",
    "@get-on/site-server",
    "@get-on/templates",
  ],
  serverExternalPackages: ["sharp"],
  // Tailwind CSS v4 runs through the Turbopack loader, so the utilities in
  // app/globals.css are generated on every build.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
      },
    },
  },
  images: {
    remotePatterns: storagePattern(),
  },
};

export default nextConfig;
