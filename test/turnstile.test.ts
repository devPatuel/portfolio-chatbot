import { describe, expect, it } from "vitest";
import { CloudflareTurnstile } from "../src/turnstile";

function fetcherReturning(status: number, body: unknown) {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(init.body as URLSearchParams) });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe("CloudflareTurnstile", () => {
  it("posts the secret, the token and the IP to siteverify", async () => {
    const { fetcher, calls } = fetcherReturning(200, { success: true });

    await new CloudflareTurnstile("the-secret", fetcher).verify("the-token", "203.0.113.7");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(calls[0].body.get("secret")).toBe("the-secret");
    expect(calls[0].body.get("response")).toBe("the-token");
    expect(calls[0].body.get("remoteip")).toBe("203.0.113.7");
  });

  it("omits the IP when it is unknown", async () => {
    const { fetcher, calls } = fetcherReturning(200, { success: true });

    await new CloudflareTurnstile("s", fetcher).verify("t", "unknown");

    expect(calls[0].body.has("remoteip")).toBe(false);
  });

  it("returns true only for success: true", async () => {
    expect(await new CloudflareTurnstile("s", fetcherReturning(200, { success: true }).fetcher).verify("t", "1.1.1.1")).toBe(true);
    expect(await new CloudflareTurnstile("s", fetcherReturning(200, { success: false, "error-codes": ["invalid-input-response"] }).fetcher).verify("t", "1.1.1.1")).toBe(false);
    expect(await new CloudflareTurnstile("s", fetcherReturning(200, { success: "true" }).fetcher).verify("t", "1.1.1.1")).toBe(false);
    expect(await new CloudflareTurnstile("s", fetcherReturning(200, {}).fetcher).verify("t", "1.1.1.1")).toBe(false);
  });

  it("throws when Cloudflare answers with an error status, so the caller fails closed", async () => {
    await expect(new CloudflareTurnstile("s", fetcherReturning(500, {}).fetcher).verify("t", "1.1.1.1")).rejects.toThrow("siteverify http 500");
  });

  it("throws when the network fails", async () => {
    const failing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(new CloudflareTurnstile("s", failing).verify("t", "1.1.1.1")).rejects.toThrow("network down");
  });

  it("calls the fetcher without binding it to the verifier instance", async () => {
    let seenThis: unknown = "not-called";
    const fetcher = async function (this: unknown) {
      seenThis = this;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } as unknown as typeof fetch;
    const verifier = new CloudflareTurnstile("s", fetcher);

    await verifier.verify("t", "1.1.1.1");

    expect(seenThis).not.toBe(verifier);
  });

  it("throws when a 200 response is not JSON, so the caller fails closed", async () => {
    const fetcher = (async () => new Response("<html>oops</html>", { status: 200 })) as unknown as typeof fetch;
    await expect(new CloudflareTurnstile("s", fetcher).verify("t", "1.1.1.1")).rejects.toThrow();
  });
});
