import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        // Tests never reach the real model: no remote bindings, no quota spent.
        remoteBindings: false,
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            // Test-only binding so the setup file can create the tables.
            TEST_MIGRATIONS: migrations,
            CANARY: "ZX-CANARYTEST0000",
            VISITOR_SALT: "test-salt",
            ALLOWED_ORIGINS: "https://jordipatuel.com,http://localhost:8788",
            VISITOR_DAILY_LIMIT: "3",
            GLOBAL_DAILY_LIMIT: "5",
            PASS_SECRET: "test-pass-secret-0123456789abcdef-0123456789",
            TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
