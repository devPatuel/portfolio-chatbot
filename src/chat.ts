import { readJsonBody } from "./body";
import { CONFIG } from "./config";
import { json } from "./http";
import { KNOWLEDGE } from "./knowledge";
import { countMetric, errorMessage, saveExchange } from "./log";
import type { ModelProvider } from "./model";
import { corsHeaders, isAllowedOrigin, parseAllowedOrigins } from "./origin";
import { classify, isUsableCanary, truncate } from "./outputFilter";
import { bearerToken, isUsablePassSecret, verifyPass } from "./pass";
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
    await countMetric(env.DB, day, "rejected_origin");
    return json({ error: "forbidden_origin" }, 403);
  }
  const cors = corsHeaders(origin);

  // Fail closed: without its secrets the bot must not answer at all. An empty canary would
  // match every reply, an empty salt would make visitor ids reversible, and a weak pass
  // secret would make passes forgeable.
  if (!isUsableCanary(env.CANARY) || !env.VISITOR_SALT || !isUsablePassSecret(env.PASS_SECRET)) {
    console.error("missing or unusable secrets");
    return json({ error: "server_misconfigured" }, 500, cors);
  }

  // 2. Pass. Proves the captcha was solved by this same visitor in the last 30 minutes. It is
  //    checked before reading the body or spending quota because it is the cheapest check left.
  //    Without the header every caller shares one bucket, which is the safe direction.
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const visitor = await visitorId(ip, day, env.VISITOR_SALT);
  const token = bearerToken(request.headers.get("Authorization"));
  if (token === null || !(await verifyPass(env.PASS_SECRET, token, visitor, now))) {
    await countMetric(env.DB, day, "rejected_pass");
    return json({ error: "invalid_pass" }, 401, cors);
  }

  // 3. Validation. The visitor only learns that the request was invalid, never which rule it broke.
  const parsed = validateChatRequest(await readJsonBody(request, CONFIG.maxBodyBytes));
  if (!parsed.ok) {
    await countMetric(env.DB, day, "rejected_invalid");
    return json({ error: "invalid_request" }, 400, cors);
  }
  const { conversationId, message, history } = parsed.value;

  // 4. Limits. Everything cheap runs before the model, the only scarce resource.
  //    If the database is down this throws and the model is never called.
  const limit = await checkAndCount(env.DB, day, visitor, limitsFromEnv(env));
  if (!limit.allowed) {
    if (limit.reason === "visitor_limit") {
      await countMetric(env.DB, day, "limited_visitor");
      return json({ error: "visitor_limit" }, 429, cors);
    }
    await countMetric(env.DB, day, "limited_global");
    return json({ error: "daily_limit" }, 503, cors);
  }

  // 5. Model. Rules travel in the system message; the visitor's text only ever travels as "user".
  let raw: string;
  try {
    raw = await model.generate(buildSystemPrompt(KNOWLEDGE, env.CANARY), [
      ...history,
      { role: "user", content: message },
    ]);
    // An empty reply is a failed generation, not something to show or store as an answer.
    if (!raw.trim()) throw new Error("empty model reply");
  } catch (error) {
    console.error("model failed", errorMessage(error));
    await countMetric(env.DB, day, "model_errors");
    return json({ error: "model_error" }, 502, cors);
  }

  // 6. Output filter. The model's reply is untrusted input too. A leak is answered with the
  //    same sentence as any off-topic question, so the attacker gets no signal.
  const kind = classify(raw, env.CANARY, CONFIG.refusalText);
  const reply = kind === "canary" ? CONFIG.refusalText : truncate(raw, CONFIG.maxHistoryEntryChars);
  if (kind === "canary") await countMetric(env.DB, day, "canary_hits");

  // 7. Log. The original reply is stored, even when it was blocked, to study what worked.
  try {
    await saveExchange(env.DB, {
      createdAt: now.toISOString(),
      conversationId,
      kind,
      userMessage: message,
      modelReply: raw,
    });
  } catch (error) {
    console.error("exchange log failed", errorMessage(error));
  }

  return json({ reply, remaining: limit.remaining }, 200, cors);
}
