import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that shouldn't be bundled by Next.js
  serverExternalPackages: [
    'libphonenumber-geo-carrier',
    'libphonenumber-js'
  ],
};

export default nextConfig;

