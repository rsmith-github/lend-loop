import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**/*.test.ts", "node_modules/**"],
    environment: "node",
  },
  esbuild: {
    target: "node18",
  },
});
