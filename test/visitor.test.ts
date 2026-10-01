import { describe, expect, it } from "vitest";
import { dayOf, visitorId } from "../src/visitor";

describe("dayOf", () => {
  it("returns the UTC calendar day", () => {
    expect(dayOf(new Date("2026-09-30T23:59:59Z"))).toBe("2026-09-30");
    expect(dayOf(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10-01");
  });
});

describe("visitorId", () => {
  it("is a 64-character hex string that does not contain the IP", async () => {
    const id = await visitorId("203.0.113.7", "2026-09-30", "salt");
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).not.toContain("203.0.113.7");
  });

  it("is stable for the same IP, day and salt", async () => {
    expect(await visitorId("203.0.113.7", "2026-09-30", "salt")).toBe(
      await visitorId("203.0.113.7", "2026-09-30", "salt"),
    );
  });

  it("changes with the IP, the day and the salt", async () => {
    const base = await visitorId("203.0.113.7", "2026-09-30", "salt");
    expect(await visitorId("203.0.113.8", "2026-09-30", "salt")).not.toBe(base);
    expect(await visitorId("203.0.113.7", "2026-10-01", "salt")).not.toBe(base);
    expect(await visitorId("203.0.113.7", "2026-09-30", "other")).not.toBe(base);
  });
});
