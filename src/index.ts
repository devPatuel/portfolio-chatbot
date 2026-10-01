import { handleChat } from "./chat";
import { CONFIG } from "./config";
import { json } from "./http";
import { WorkersAiProvider } from "./model";

const OPEN_PREFLIGHT = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/chat") return json({ error: "not_found" }, 404);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: OPEN_PREFLIGHT });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const model = new WorkersAiProvider(env.AI, CONFIG.model, CONFIG.maxOutputTokens);
    return handleChat(request, env, model, new Date());
  },
} satisfies ExportedHandler<Env>;
