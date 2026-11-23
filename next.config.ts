import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(__filename, "..", "..", "..");

const nextConfig: NextConfig = {
  // Next.js 15+ strict mode: disable mdx check for plain pages + enable basePath if used.
  compiler: { styledComponents: true },
  // Traced output so `next start` works from the built `.next` dir.
  outputFileTracingRoot: __filename,
};
export default nextConfig;
