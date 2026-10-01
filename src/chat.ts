import { readJsonBody } from "./body";
import { CONFIG } from "./config";
import { json } from "./http";
import { KNOWLEDGE } from "./knowledge";
import type { ModelProvider } from "./model";
import { buildSystemPrompt } from "./prompt";
import { validateChatRequest } from "./validate";

const OPEN_CORS = { "Access-Control-Allow-Origin": "*" };

export async function handleChat(request: Request, env: Env, model: ModelProvider, _now: Date): Promise<Response> {
  // The visitor only learns that the request was invalid, never which rule it broke.
  const parsed = validateChatRequest(await readJsonBody(request, CONFIG.maxBodyBytes));
  if (!parsed.ok) return json({ error: "invalid_request" }, 400, OPEN_CORS);
  const { message, history } = parsed.value;

  // Rules travel in the system message; the visitor's text only ever travels as "user".
  const reply = await model.generate(buildSystemPrompt(KNOWLEDGE, env.CANARY), [
    ...history,
    { role: "user", content: message },
  ]);

  return json({ reply, remaining: 999 }, 200, OPEN_CORS);
}
