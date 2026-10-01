import { readJsonBody } from "./body";
import { CONFIG } from "./config";
import { json } from "./http";
import { KNOWLEDGE } from "./knowledge";
import type { ModelProvider } from "./model";
import { corsHeaders, isAllowedOrigin, parseAllowedOrigins } from "./origin";
import { buildSystemPrompt } from "./prompt";
import { checkAndCount, limitsFromEnv } from "./rateLimit";
import { validateChatRequest } from "./validate";
import { dayOf, visitorId } from "./visitor";

export async function handleChat(request: Request, env: Env, model: ModelProvider, now: Date): Promise<Response> {
  const day = dayOf(now);

  // 1. Origin. Stops other websites from using the bot through their visitors' browsers.
  //    A script can forge this header: that is what rate limits and the captcha are for.
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, parseAllowedOrigins(env.ALLOWED_ORIGINS))) {
    return json({ error: "forbidden_origin" }, 403);
  }
  const cors = corsHeaders(origin);

  // 2. Validation. The visitor only learns that the request was invalid, never which rule it broke.
  const parsed = validateChatRequest(await readJsonBody(request, CONFIG.maxBodyBytes));
  if (!parsed.ok) return json({ error: "invalid_request" }, 400, cors);
  const { message, history } = parsed.value;

  // 3. Limits. Everything cheap runs before the model, the only scarce resource.
  //    Without the header every caller shares one bucket, which is the safe direction.
  //    If D1 fails this throws and the model is never reached: failing closed.
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const visitor = await visitorId(ip, day, env.VISITOR_SALT);
  const limit = await checkAndCount(env.DB, day, visitor, limitsFromEnv(env));
  if (!limit.allowed) {
    return limit.reason === "visitor_limit"
      ? json({ error: "visitor_limit" }, 429, cors)
      : json({ error: "daily_limit" }, 503, cors);
  }

  // 4. Model. Rules travel in the system message; the visitor's text only ever travels as "user".
  const reply = await model.generate(buildSystemPrompt(KNOWLEDGE, env.CANARY), [
    ...history,
    { role: "user", content: message },
  ]);

  return json({ reply, remaining: limit.remaining }, 200, cors);
}
