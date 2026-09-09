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
            value: "camera=(), microphone=(), geolocation=()",
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
      {
        source: "/controlroom/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
        ],
      },
      {
        source: "/api/radar/shortcut",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
      {
        source: "/secrets/shop/reveal",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
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
      { source: "/radar", destination: "/secrets/radar", permanent: true },
      {
        source: "/sunday-posties",
        destination: "/secrets/sunday-posties",
        permanent: true,
      },
      { source: "/cia", destination: "/secrets", permanent: true },
      {
        source: "/shop/:path*",
        destination: "/secrets/shop/:path*",
        permanent: true,
      },
      {
        source: "/cia/:path*",
        destination: "/secrets/:path*",
        permanent: true,
      },
      {
        source: "/admin/:path*",
        destination: "/controlroom/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
