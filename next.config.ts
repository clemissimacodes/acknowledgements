import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/title", destination: "/", permanent: true },
      { source: "/dedication", destination: "/", permanent: true },
      { source: "/contents", destination: "/", permanent: true },
      { source: "/foreword", destination: "/", permanent: true },
      { source: "/poetry/admin", destination: "/poetry", permanent: false },
    ];
  },
};

export default nextConfig;
