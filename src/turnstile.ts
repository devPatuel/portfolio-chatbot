const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// A slow Cloudflare must not hold requests open; a timeout throws, so the caller fails closed.
const SITEVERIFY_TIMEOUT_MS = 5000;
// Cloudflare's public test secrets (always pass, always fail, token already spent).
const TEST_SECRET = /^[123]x0+AA$/;

export function isTestTurnstileSecret(secret: string): boolean {
  return TEST_SECRET.test(secret);
}

// The captcha provider sits behind an interface, like the model, so tests never reach Cloudflare.
export interface TurnstileVerifier {
  verify(token: string, ip: string): Promise<boolean>;
}

export class CloudflareTurnstile implements TurnstileVerifier {
  constructor(
    private readonly secret: string,
    private readonly allowedHostnames: string[],
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  // Throws when Cloudflare cannot be reached or answers badly: that is "unknown", not "failed",
  // and the caller must not hand out a pass in that case.
  async verify(token: string, ip: string): Promise<boolean> {
    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);

    // Call through a local so the global fetch never runs with `this` = this instance (Workers throw "Illegal invocation").
    const fetcher = this.fetcher;
    const response = await fetcher(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`siteverify http ${response.status}`);

    const result = (await response.json()) as { success?: unknown; hostname?: unknown };
    if (result.success !== true) return false;
    // A token solved on someone else's page must not buy a pass here. Test secrets always
    // answer with a fixed hostname, so the check only makes sense with a real secret.
    if (isTestTurnstileSecret(this.secret)) return true;
    return typeof result.hostname === "string" && this.allowedHostnames.includes(result.hostname);
  }
}
