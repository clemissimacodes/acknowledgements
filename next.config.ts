import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
