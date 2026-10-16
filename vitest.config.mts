import { defineConfig } from "vitest/config";
import path from "node:path";
import { testEnvironment } from "./scripts/test-db.mjs";
const isolated = testEnvironment();
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    globals: true,
    env: {
      DATABASE_URL: isolated.DATABASE_URL,
      TEST_DATABASE_URL: isolated.TEST_DATABASE_URL,
      SV_TEST_ISOLATED: "1",
      TZ: "UTC",
    },
    setupFiles: ["./tests/isolation-guard.ts"],
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(process.cwd(), "./src") } },
});
