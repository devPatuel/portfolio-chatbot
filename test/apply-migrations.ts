import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Safe to run more than once: only migrations that are not applied yet are executed.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
