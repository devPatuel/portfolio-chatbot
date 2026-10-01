import { json } from "./http";
import { KNOWLEDGE } from "./knowledge";
import type { ModelProvider } from "./model";
import { buildSystemPrompt } from "./prompt";
import type { ChatRequest } from "./types";

const OPEN_CORS = { "Access-Control-Allow-Origin": "*" };

export async function handleChat(request: Request, env: Env, model: ModelProvider, _now: Date): Promise<Response> {
  // Still trusting the body blindly: validation arrives in the next step of this layer.
  const body = (await request.json()) as ChatRequest;

  // Rules travel in the system message; the visitor's text only ever travels as "user".
  const reply = await model.generate(buildSystemPrompt(KNOWLEDGE, env.CANARY), [
    ...(body.history ?? []),
    { role: "user", content: body.message },
  ]);

  return json({ reply, remaining: 999 }, 200, OPEN_CORS);
}
