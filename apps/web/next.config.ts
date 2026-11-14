import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/docs/build-a-verifier", destination: "/docs/verifier", permanent: true },
      // Removed v1 prototype routes. Sources are exact matches, so /fulfillers is untouched.
      { source: "/qr", destination: "/pay", permanent: true },
      { source: "/agent", destination: "/docs#agents", permanent: true },
      { source: "/orders/new", destination: "/shop", permanent: true },
      { source: "/fulfiller", destination: "/earn", permanent: true },
      { source: "/status/legacy", destination: "/status", permanent: true },
    ];
  },
  serverExternalPackages: [
    "better-sqlite3",
    "@napi-rs/canvas",
    "pdfjs-dist",
    "@phala/dcap-qvl",
  ],
};

export default nextConfig;
