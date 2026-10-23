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
  transpilePackages: ["@get-on/blocks", "@get-on/renderer"],
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
