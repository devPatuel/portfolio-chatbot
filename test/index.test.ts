import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { envWith, ORIGIN, withPass } from "./helpers";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function call(path: string, init: RequestInit<IncomingRequestCfProperties>): Promise<Response> {
  return worker.fetch(new IncomingRequest(`https://chat.test${path}`, init), env);
}

describe("routing", () => {
  it("returns 404 for unknown paths", async () => {
    const response = await call("/otra", { method: "GET" });
    expect(response.status).toBe(404);
  });

  it("marks every JSON answer as not cacheable and not sniffable", async () => {
    const response = await call("/otra", { method: "GET" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns 405 for methods other than POST and OPTIONS", async () => {
    const response = await call("/chat", { method: "GET" });
    expect(response.status).toBe(405);
  });

  it("answers the preflight of /session for an allowed origin", async () => {
    const response = await call("/session", { method: "OPTIONS", headers: { Origin: ORIGIN } });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("refuses the preflight of /session for a foreign origin", async () => {
    const response = await call("/session", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
    expect(response.status).toBe(403);
  });

  it("returns 405 for GET on /session", async () => {
    const response = await call("/session", { method: "GET" });
    expect(response.status).toBe(405);
  });

  it("answers the preflight of an allowed origin", async () => {
    const response = await call("/chat", { method: "OPTIONS", headers: { Origin: ORIGIN } });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("refuses the preflight of a foreign origin", async () => {
    const response = await call("/chat", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("turns an unexpected failure into a 500 without leaking details", async () => {
    const brokenDb = {
      prepare() {
        throw new Error("D1 down");
      },
    } as unknown as D1Database;
    const request = new IncomingRequest("https://chat.test/chat", {
      method: "POST",
      headers: { Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.7" },
      body: JSON.stringify({
        conversationId: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b",
        message: "Hola",
        history: [],
      }),
    });

    // The Worker uses new Date() as "now", so the pass is signed for the same moment.
    const signed = await withPass(request, new Date());
    const response = await worker.fetch(
      signed as unknown as Request<unknown, IncomingRequestCfProperties>,
      envWith({ DB: brokenDb }),
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"error":"internal_error"}');
  });
});
