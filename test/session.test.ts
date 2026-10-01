import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { verifyPass } from "../src/pass";
import { handleSession } from "../src/session";
import { dayOf, visitorId } from "../src/visitor";
import { envWith, FakeTurnstile, freshDay, ORIGIN, sessionRequest } from "./helpers";

const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

async function metric(day: Date, name: string): Promise<number | null> {
  const row = await env.DB.prepare("SELECT count FROM metrics WHERE day = ?1 AND name = ?2")
    .bind(dayOf(day), name)
    .first<{ count: number }>();
  return row?.count ?? null;
}

describe("handleSession — happy path", () => {
  it("issues a pass for the visitor after the captcha passes", async () => {
    const now = freshDay();
    const verifier = new FakeTurnstile(true);

    const response = await handleSession(sessionRequest({ turnstileToken: TOKEN }), env, verifier, now);

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const body = (await response.json()) as { pass: string; expiresIn: number };
    expect(body.expiresIn).toBe(1800);
    const visitor = await visitorId("203.0.113.7", dayOf(now), env.VISITOR_SALT);
    expect(await verifyPass(env.PASS_SECRET, body.pass, visitor, now)).toBe(true);
    expect(verifier.calls).toEqual([{ token: TOKEN, ip: "203.0.113.7" }]);
  });
});

describe("handleSession — refusals", () => {
  it("refuses a foreign origin before calling the captcha provider", async () => {
    const verifier = new FakeTurnstile(true);

    const response = await handleSession(
      sessionRequest({ turnstileToken: TOKEN }, { Origin: "https://evil.example" }),
      env,
      verifier,
      freshDay(),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden_origin" });
    expect(verifier.calls).toHaveLength(0);
  });

  it.each([
    ["no body", ""],
    ["not JSON", "hola"],
    ["empty object", {}],
    ["token is a number", { turnstileToken: 7 }],
    ["token is empty", { turnstileToken: "" }],
    ["token is too long", { turnstileToken: "a".repeat(2049) }],
  ])("answers 400 without calling the captcha provider when %s", async (_name, body) => {
    const verifier = new FakeTurnstile(true);

    const response = await handleSession(sessionRequest(body), env, verifier, freshDay());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(verifier.calls).toHaveLength(0);
  });

  it("answers 403 and counts it when the captcha is rejected", async () => {
    const now = freshDay();

    const response = await handleSession(sessionRequest({ turnstileToken: TOKEN }), env, new FakeTurnstile(false), now);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "captcha_failed" });
    expect(await metric(now, "captcha_failed")).toBe(1);
  });

  it("fails closed with 503 and no pass when the captcha provider is down", async () => {
    const now = freshDay();

    const response = await handleSession(
      sessionRequest({ turnstileToken: TOKEN }),
      env,
      new FakeTurnstile(new Error("siteverify http 500")),
      now,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "captcha_unavailable" });
    expect(await metric(now, "captcha_unavailable")).toBe(1);
  });
});

describe("handleSession — missing secrets", () => {
  it.each([
    ["PASS_SECRET missing", { PASS_SECRET: undefined }],
    ["PASS_SECRET empty", { PASS_SECRET: "" }],
    ["PASS_SECRET too short", { PASS_SECRET: "short" }],
    ["TURNSTILE_SECRET missing", { TURNSTILE_SECRET: undefined }],
    ["VISITOR_SALT empty", { VISITOR_SALT: "" }],
  ])("answers 500 without calling anyone when %s", async (_name, override) => {
    const verifier = new FakeTurnstile(true);

    const response = await handleSession(
      sessionRequest({ turnstileToken: TOKEN }),
      envWith(override as Partial<Env>),
      verifier,
      freshDay(),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "server_misconfigured" });
    expect(verifier.calls).toHaveLength(0);
  });
});
