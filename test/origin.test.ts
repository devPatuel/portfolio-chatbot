import { describe, expect, it } from "vitest";
import { corsHeaders, isAllowedOrigin, parseAllowedOrigins } from "../src/origin";

describe("parseAllowedOrigins", () => {
  it("splits and trims a comma-separated list", () => {
    expect(parseAllowedOrigins(" https://a.com , https://b.com ")).toEqual(["https://a.com", "https://b.com"]);
  });

  it.each([undefined, "", " , "])("returns an empty list for %j", (raw) => {
    expect(parseAllowedOrigins(raw)).toEqual([]);
  });
});

describe("isAllowedOrigin", () => {
  const allowed = ["https://jordipatuel.com"];

  it("accepts a listed origin", () => {
    expect(isAllowedOrigin("https://jordipatuel.com", allowed)).toBe(true);
  });

  it.each([
    null,
    "https://evil.example",
    "http://jordipatuel.com",
    "https://jordipatuel.com.evil.example",
    "https://sub.jordipatuel.com",
    "null",
  ])("rejects %j", (origin) => {
    expect(isAllowedOrigin(origin, allowed)).toBe(false);
  });

  it("rejects everything when the list is empty", () => {
    expect(isAllowedOrigin("https://jordipatuel.com", [])).toBe(false);
  });
});

describe("corsHeaders", () => {
  it("echoes the origin and varies on it", () => {
    const headers = corsHeaders("https://jordipatuel.com");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://jordipatuel.com");
    expect(headers.Vary).toBe("Origin");
  });
});
