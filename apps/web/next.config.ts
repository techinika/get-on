import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@get-on/blocks', '@get-on/renderer'],
};

export default nextConfig;
