import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { ORIGIN } from "./helpers";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function call(path: string, init: RequestInit<IncomingRequestCfProperties>): Promise<Response> {
  return worker.fetch(new IncomingRequest(`https://chat.test${path}`, init), env);
}

describe("routing", () => {
  it("returns 404 for unknown paths", async () => {
    const response = await call("/otra", { method: "GET" });
    expect(response.status).toBe(404);
  });

  it("returns 405 for methods other than POST and OPTIONS", async () => {
    const response = await call("/chat", { method: "GET" });
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
});
