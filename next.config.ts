import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a stray package-lock.json in the home directory, which makes
  // Next guess the wrong workspace root and warn on every build. Pin it.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
