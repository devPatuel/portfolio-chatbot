import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      // Tests never reach the real model: no remote bindings, no quota spent.
      remoteBindings: false,
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          CANARY: "ZX-CANARYTEST0000",
          VISITOR_SALT: "test-salt",
          ALLOWED_ORIGINS: "https://jordipatuel.com,http://localhost:8788",
          VISITOR_DAILY_LIMIT: "3",
          GLOBAL_DAILY_LIMIT: "5",
        },
      },
    }),
  ],
});
