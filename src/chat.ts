import { readJsonBody } from "./body";
import { CONFIG } from "./config";
import { json } from "./http";
import { KNOWLEDGE } from "./knowledge";
import type { ModelProvider } from "./model";
import { corsHeaders, isAllowedOrigin, parseAllowedOrigins } from "./origin";
import { buildSystemPrompt } from "./prompt";
import { validateChatRequest } from "./validate";

export async function handleChat(request: Request, env: Env, model: ModelProvider, _now: Date): Promise<Response> {
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

  // 3. Model. Rules travel in the system message; the visitor's text only ever travels as "user".
  const reply = await model.generate(buildSystemPrompt(KNOWLEDGE, env.CANARY), [
    ...history,
    { role: "user", content: message },
  ]);

  return json({ reply, remaining: 999 }, 200, cors);
}
