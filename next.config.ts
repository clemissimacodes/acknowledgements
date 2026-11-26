import { execSync } from "child_process";
import type { NextConfig } from "next";

function lastUpdated() {
  try {
    return execSync("git log -1 --format=%cI", { encoding: "utf8" }).trim();
  } catch {
    return new Date().toISOString();
  }
}

const nextConfig: NextConfig = {
  env: {
    SITE_UPDATED_AT: lastUpdated(),
  },
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
            value: "camera=(self), microphone=(self), geolocation=()",
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
        source: "/secrets",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
        ],
      },
      {
        source: "/controlroom/shop/reveal",
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
      {
        source: "/dandelion",
        destination: "/blow-on-a-fat-dandelion",
        permanent: true,
      },
      // Former Secrets pages now live in the control room vault.
      ...[
        "radar",
        "sunday-posties",
        "shop",
        "acknowledgements",
      ].flatMap((section) => [
        {
          source: `/${section}`,
          destination: `/controlroom/${section}`,
          permanent: false,
        },
        {
          source: `/${section}/:path*`,
          destination: `/controlroom/${section}/:path*`,
          permanent: false,
        },
      ]),
      // Anything under /secrets collapses to the challenge itself.
      { source: "/secrets/:path+", destination: "/secrets", permanent: false },
      { source: "/unlock", destination: "/secrets", permanent: false },
      {
        source: "/admin/:path*",
        destination: "/controlroom/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
