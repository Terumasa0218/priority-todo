import type { NextConfig } from "next";

const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const firebaseAuthHost = firebaseAuthDomain || (firebaseProjectId ? `${firebaseProjectId}.firebaseapp.com` : null);

const nextConfig: NextConfig = {
  async rewrites() {
    if (!firebaseAuthHost) return [];
    return [
      { source: "/__/auth/:path*", destination: `https://${firebaseAuthHost}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `https://${firebaseAuthHost}/__/firebase/:path*` },
    ];
  },
};

export default nextConfig;
