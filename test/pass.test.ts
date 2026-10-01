import { describe, expect, it } from "vitest";
import { bearerToken, isUsablePassSecret, issuePass, verifyPass } from "../src/pass";

const SECRET = "test-pass-secret-0123456789abcdef-0123456789";
const NOW = new Date("2030-01-01T12:00:00Z");
const VISITOR = "a".repeat(64);

describe("issuePass and verifyPass", () => {
  it("accepts a pass for the visitor it was issued to", async () => {
    const pass = await issuePass(SECRET, VISITOR, NOW, 1800);
    expect(pass.split(".")).toHaveLength(2);
    expect(await verifyPass(SECRET, pass, VISITOR, NOW)).toBe(true);
  });

  it("rejects a pass presented by another visitor", async () => {
    const pass = await issuePass(SECRET, VISITOR, NOW, 1800);
    expect(await verifyPass(SECRET, pass, "b".repeat(64), NOW)).toBe(false);
  });

  it("expires exactly after the time to live", async () => {
    const pass = await issuePass(SECRET, VISITOR, NOW, 1800);
    expect(await verifyPass(SECRET, pass, VISITOR, new Date(NOW.getTime() + 1799_000))).toBe(true);
    expect(await verifyPass(SECRET, pass, VISITOR, new Date(NOW.getTime() + 1800_000))).toBe(false);
  });

  it("rejects a pass signed with another secret", async () => {
    const pass = await issuePass("another-secret-0123456789abcdef-0123456789", VISITOR, NOW, 1800);
    expect(await verifyPass(SECRET, pass, VISITOR, NOW)).toBe(false);
  });

  it("rejects a pass whose payload was replaced but kept the old signature", async () => {
    const pass = await issuePass(SECRET, VISITOR, NOW, 1800);
    const forged = btoa(JSON.stringify({ exp: 9_999_999_999, vid: VISITOR }))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    expect(await verifyPass(SECRET, `${forged}.${pass.split(".")[1]}`, VISITOR, NOW)).toBe(false);
  });

  it("rejects a pass with a damaged signature", async () => {
    const pass = await issuePass(SECRET, VISITOR, NOW, 1800);
    const [payload, signature] = pass.split(".");
    // Damage the first character: the last one of a base64 text only carries padding bits,
    // so changing it could decode to the very same bytes.
    const damaged = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    expect(await verifyPass(SECRET, `${payload}.${damaged}`, VISITOR, NOW)).toBe(false);
  });

  it.each(["", "abc", "a.b.c", "a.", ".b", ".", "%%%.%%%", "a b.c d"])("rejects malformed input %j without throwing", async (pass) => {
    expect(await verifyPass(SECRET, pass, VISITOR, NOW)).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extracts the token of a Bearer header", () => {
    expect(bearerToken("Bearer abc.def-123_x")).toBe("abc.def-123_x");
  });

  it.each([null, "", "Bearer", "Bearer ", "Basic abc", "bearer abc", "Bearer a b", `Bearer ${"a".repeat(2049)}`])(
    "returns null for %j",
    (header) => {
      expect(bearerToken(header)).toBeNull();
    },
  );
});

describe("isUsablePassSecret", () => {
  it("requires at least 32 characters", () => {
    expect(isUsablePassSecret(undefined)).toBe(false);
    expect(isUsablePassSecret("")).toBe(false);
    expect(isUsablePassSecret("short")).toBe(false);
    expect(isUsablePassSecret("x".repeat(31))).toBe(false);
    expect(isUsablePassSecret("x".repeat(32))).toBe(true);
  });
});
