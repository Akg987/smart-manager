import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    agentFeedback: true,
    cpus: 2,
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  async rewrites() {
    const api = process.env.NEST_API_URL ?? "http://localhost:4000";
    return [
      {
        source: "/profile/avatars/:id",
        destination: `${api}/api/users/:id/avatar`,
      },
      { source: "/api/:path*", destination: `${api}/api/:path*` },
    ];
  },
};

export default nextConfig;
