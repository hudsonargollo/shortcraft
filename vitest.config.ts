import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@pkg": path.resolve(__dirname, "packages"),
      "@": path.resolve(__dirname, "apps/web"),
    },
  },
  test: {
    include: ["tests/unit/**/*.spec.ts"],
    environment: "node",
  },
});
