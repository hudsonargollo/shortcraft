import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.resolve(__dirname, "..", "..");

const nextConfig: NextConfig = {
  // Monorepo root: Turbopack resolves the tsconfig paths (@/*, @pkg/*) from here.
  // distDir stays at the default (.next inside apps/web) — Next rejects absolute paths.
  turbopack: { root: repoRoot },
};

export default nextConfig;
