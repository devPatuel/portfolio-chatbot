const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// The captcha provider sits behind an interface, like the model, so tests never reach Cloudflare.
export interface TurnstileVerifier {
  verify(token: string, ip: string): Promise<boolean>;
}

export class CloudflareTurnstile implements TurnstileVerifier {
  constructor(
    private readonly secret: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  // Throws when Cloudflare cannot be reached or answers badly: that is "unknown", not "failed",
  // and the caller must not hand out a pass in that case.
  async verify(token: string, ip: string): Promise<boolean> {
    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);

    // Call through a local so the global fetch never runs with `this` = this instance (Workers throw "Illegal invocation").
    const fetcher = this.fetcher;
    const response = await fetcher(SITEVERIFY_URL, { method: "POST", body });
    if (!response.ok) throw new Error(`siteverify http ${response.status}`);

    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  }
}
