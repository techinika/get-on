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
  images: {
    remotePatterns: storagePattern(),
  },
};

export default nextConfig;
