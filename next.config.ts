import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 15+ strict mode: disable mdx check for plain pages + enable basePath if used.
  compiler: { styledComponents: true },
  // Traced output so `next start` works from the built `.next` dir.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
