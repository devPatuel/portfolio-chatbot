import { readJsonBody } from "./body";
import { CONFIG } from "./config";
import { json } from "./http";
import { countMetric, errorMessage } from "./log";
import { corsHeaders, isAllowedOrigin, parseAllowedOrigins } from "./origin";
import { isUsablePassSecret, issuePass } from "./pass";
import type { TurnstileVerifier } from "./turnstile";
import { dayOf, visitorId } from "./visitor";

function tokenOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const token = (body as Record<string, unknown>).turnstileToken;
  if (typeof token !== "string" || token.length < 1 || token.length > CONFIG.maxCaptchaTokenChars) return null;
  return token;
}

export async function handleSession(
  request: Request,
  env: Env,
  verifier: TurnstileVerifier,
  now: Date,
): Promise<Response> {
  const day = dayOf(now);

  // Origin first: cheaper than anything else and it keeps other sites from solving captchas for us.
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, parseAllowedOrigins(env.ALLOWED_ORIGINS))) {
    await countMetric(env.DB, day, "rejected_origin");
    return json({ error: "forbidden_origin" }, 403);
  }
  const cors = corsHeaders(origin);

  // Fail closed: with a weak or missing secret the passes would be forgeable.
  if (!isUsablePassSecret(env.PASS_SECRET) || !env.TURNSTILE_SECRET || !env.VISITOR_SALT) {
    console.error("missing or unusable secrets");
    return json({ error: "server_misconfigured" }, 500, cors);
  }

  const token = tokenOf(await readJsonBody(request, CONFIG.maxSessionBodyBytes));
  if (token === null) {
    await countMetric(env.DB, day, "rejected_invalid");
    return json({ error: "invalid_request" }, 400, cors);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  let human: boolean;
  try {
    human = await verifier.verify(token, ip);
  } catch (error) {
    // "Could not check" is not "checked and failed", but both must end without a pass.
    console.error("captcha check failed", errorMessage(error));
    await countMetric(env.DB, day, "captcha_unavailable");
    return json({ error: "captcha_unavailable" }, 503, cors);
  }
  if (!human) {
    await countMetric(env.DB, day, "captcha_failed");
    return json({ error: "captcha_failed" }, 403, cors);
  }

  const visitor = await visitorId(ip, day, env.VISITOR_SALT);
  const pass = await issuePass(env.PASS_SECRET, visitor, now, CONFIG.passTtlSeconds);
  return json({ pass, expiresIn: CONFIG.passTtlSeconds }, 200, cors);
}
