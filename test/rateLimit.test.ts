import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { checkAndCount, limitsFromEnv } from "../src/rateLimit";

const limits = { visitor: 3, global: 5 };

async function globalTotal(day: string): Promise<number> {
  const row = await env.DB.prepare("SELECT count FROM metrics WHERE day = ?1 AND name = 'messages'")
    .bind(day)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

describe("checkAndCount", () => {
  it("allows up to the visitor limit and reports what is left", async () => {
    const day = "2031-01-01";
    expect(await checkAndCount(env.DB, day, "visitor-a", limits)).toEqual({ allowed: true, remaining: 2 });
    expect(await checkAndCount(env.DB, day, "visitor-a", limits)).toEqual({ allowed: true, remaining: 1 });
    expect(await checkAndCount(env.DB, day, "visitor-a", limits)).toEqual({ allowed: true, remaining: 0 });
    expect(await checkAndCount(env.DB, day, "visitor-a", limits)).toEqual({ allowed: false, reason: "visitor_limit" });
  });

  it("does not let a blocked visitor eat into the global budget", async () => {
    const day = "2031-01-02";
    for (let i = 0; i < 6; i++) await checkAndCount(env.DB, day, "visitor-a", limits);
    expect(await globalTotal(day)).toBe(3);
  });

  it("blocks everyone once the global limit is reached, without overshooting", async () => {
    const day = "2031-01-03";
    for (let i = 0; i < 5; i++) {
      expect(await checkAndCount(env.DB, day, `visitor-${i}`, limits)).toMatchObject({ allowed: true });
    }
    expect(await checkAndCount(env.DB, day, "visitor-late", limits)).toEqual({ allowed: false, reason: "daily_limit" });
    expect(await globalTotal(day)).toBe(5);
  });

  it("never lets simultaneous requests exceed the limit", async () => {
    const day = "2031-01-04";
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkAndCount(env.DB, day, "visitor-a", { visitor: 3, global: 100 })),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
  });

  it("counts each day separately", async () => {
    for (let i = 0; i < 3; i++) await checkAndCount(env.DB, "2031-01-05", "visitor-a", limits);
    expect(await checkAndCount(env.DB, "2031-01-06", "visitor-a", limits)).toEqual({ allowed: true, remaining: 2 });
  });
});

describe("limitsFromEnv", () => {
  it("reads both limits", () => {
    expect(limitsFromEnv({ VISITOR_DAILY_LIMIT: "7", GLOBAL_DAILY_LIMIT: "50" })).toEqual({ visitor: 7, global: 50 });
  });

  it.each([undefined, "", "abc", "0", "-5", "2.5"])("falls back to the defaults for %j", (raw) => {
    expect(limitsFromEnv({ VISITOR_DAILY_LIMIT: raw, GLOBAL_DAILY_LIMIT: raw })).toEqual({ visitor: 20, global: 100 });
  });
});
