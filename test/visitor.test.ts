import { describe, expect, it } from "vitest";
import { dayOf, networkKey, visitorId } from "../src/visitor";

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

describe("networkKey", () => {
  it("keeps an IPv4 address whole", () => {
    expect(networkKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("keeps the placeholder used when the header is missing", () => {
    expect(networkKey("unknown")).toBe("unknown");
  });

  it("collapses an IPv6 address to its /64 prefix", () => {
    expect(networkKey("2001:db8:abcd:12::1")).toBe("2001:db8:abcd:12::/64");
    expect(networkKey("2001:db8:abcd:12:ffff:ffff:ffff:ffff")).toBe("2001:db8:abcd:12::/64");
  });

  it("gives different /64 prefixes different keys", () => {
    expect(networkKey("2001:db8:abcd:13::1")).not.toBe(networkKey("2001:db8:abcd:12::1"));
  });

  it("normalizes case, leading zeros, the zone id and the long form", () => {
    expect(networkKey("2001:DB8:ABCD:12::1%eth0")).toBe("2001:db8:abcd:12::/64");
    expect(networkKey("2001:0db8:abcd:0012:0000:0000:0000:0001")).toBe("2001:db8:abcd:12::/64");
  });

  it("treats an IPv4-mapped IPv6 address as IPv4", () => {
    expect(networkKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("leaves a malformed address alone instead of throwing", () => {
    expect(networkKey("2001:db8:::1")).toBe("2001:db8:::1");
    expect(networkKey("not an ip: at all")).toBe("not an ip: at all");
  });
});

describe("visitorId and IPv6", () => {
  it("is the same for two addresses of the same /64 and different across /64", async () => {
    const a = await visitorId("2001:db8:abcd:12::1", "2026-09-30", "salt");
    const b = await visitorId("2001:db8:abcd:12::2", "2026-09-30", "salt");
    const other = await visitorId("2001:db8:abcd:13::1", "2026-09-30", "salt");
    expect(a).toBe(b);
    expect(a).not.toBe(other);
  });

  it("does not change the id of an IPv4 visitor", async () => {
    expect(await visitorId("203.0.113.7", "2026-09-30", "salt")).toMatch(/^[0-9a-f]{64}$/);
  });
});
