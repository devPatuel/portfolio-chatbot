import { describe, expect, it } from "vitest";
import { CloudflareTurnstile, isTestTurnstileSecret } from "../src/turnstile";

const HOSTS = ["jordipatuel.com"];

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
    const { fetcher, calls } = fetcherReturning(200, { success: true, hostname: "jordipatuel.com" });

    await new CloudflareTurnstile("the-secret", HOSTS, fetcher).verify("the-token", "203.0.113.7");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(calls[0].body.get("secret")).toBe("the-secret");
    expect(calls[0].body.get("response")).toBe("the-token");
    expect(calls[0].body.get("remoteip")).toBe("203.0.113.7");
  });

  it("omits the IP when it is unknown", async () => {
    const { fetcher, calls } = fetcherReturning(200, { success: true, hostname: "jordipatuel.com" });

    await new CloudflareTurnstile("s", HOSTS, fetcher).verify("t", "unknown");

    expect(calls[0].body.has("remoteip")).toBe(false);
  });

  it("returns true only for success: true", async () => {
    expect(await new CloudflareTurnstile("s", HOSTS, fetcherReturning(200, { success: true, hostname: "jordipatuel.com" }).fetcher).verify("t", "1.1.1.1")).toBe(true);
    expect(await new CloudflareTurnstile("s", HOSTS, fetcherReturning(200, { success: false, "error-codes": ["invalid-input-response"] }).fetcher).verify("t", "1.1.1.1")).toBe(false);
    expect(await new CloudflareTurnstile("s", HOSTS, fetcherReturning(200, { success: "true" }).fetcher).verify("t", "1.1.1.1")).toBe(false);
    expect(await new CloudflareTurnstile("s", HOSTS, fetcherReturning(200, {}).fetcher).verify("t", "1.1.1.1")).toBe(false);
  });

  it("throws when Cloudflare answers with an error status, so the caller fails closed", async () => {
    await expect(new CloudflareTurnstile("s", HOSTS, fetcherReturning(500, {}).fetcher).verify("t", "1.1.1.1")).rejects.toThrow("siteverify http 500");
  });

  it("throws when the network fails", async () => {
    const failing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(new CloudflareTurnstile("s", HOSTS, failing).verify("t", "1.1.1.1")).rejects.toThrow("network down");
  });

  it("calls the fetcher without binding it to the verifier instance", async () => {
    let seenThis: unknown = "not-called";
    const fetcher = async function (this: unknown) {
      seenThis = this;
      return new Response(JSON.stringify({ success: true, hostname: "jordipatuel.com" }), { status: 200 });
    } as unknown as typeof fetch;
    const verifier = new CloudflareTurnstile("s", HOSTS, fetcher);

    await verifier.verify("t", "1.1.1.1");

    expect(seenThis).not.toBe(verifier);
  });

  it("throws when a 200 response is not JSON, so the caller fails closed", async () => {
    const fetcher = (async () => new Response("<html>oops</html>", { status: 200 })) as unknown as typeof fetch;
    await expect(new CloudflareTurnstile("s", HOSTS, fetcher).verify("t", "1.1.1.1")).rejects.toThrow();
  });

  it("rejects a token solved on a hostname that is not ours", async () => {
    const other = fetcherReturning(200, { success: true, hostname: "evil.example" }).fetcher;
    const missing = fetcherReturning(200, { success: true }).fetcher;
    expect(await new CloudflareTurnstile("s", HOSTS, other).verify("t", "1.1.1.1")).toBe(false);
    expect(await new CloudflareTurnstile("s", HOSTS, missing).verify("t", "1.1.1.1")).toBe(false);
  });

  it("skips the hostname check only with Cloudflare's test secrets, which answer with a fixed hostname", async () => {
    const fetcher = fetcherReturning(200, { success: true, hostname: "example.com" }).fetcher;
    expect(await new CloudflareTurnstile("1x0000000000000000000000000000000AA", HOSTS, fetcher).verify("t", "1.1.1.1")).toBe(true);
  });

  it("gives up on a slow siteverify through an abort signal", async () => {
    let signal: AbortSignal | undefined;
    const fetcher = (async (_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Response(JSON.stringify({ success: true, hostname: "jordipatuel.com" }), { status: 200 });
    }) as unknown as typeof fetch;

    await new CloudflareTurnstile("s", HOSTS, fetcher).verify("t", "1.1.1.1");

    expect(signal).toBeInstanceOf(AbortSignal);
  });
});

describe("isTestTurnstileSecret", () => {
  it.each(["1x0000000000000000000000000000000AA", "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"])(
    "recognises the public test secret %s",
    (secret) => expect(isTestTurnstileSecret(secret)).toBe(true),
  );

  it("does not flag a real-looking secret", () => {
    expect(isTestTurnstileSecret("0x4AAAAAAAbcdefghijklmnopqrstuvwxyz")).toBe(false);
  });
});
