import { handleChat } from "./chat";
import { CONFIG } from "./config";
import { json } from "./http";
import { WorkersAiProvider } from "./model";
import { corsHeaders, isAllowedOrigin, parseAllowedOrigins } from "./origin";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/chat") return json({ error: "not_found" }, 404);

    // Browsers send this preflight before a cross-origin JSON POST.
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (!isAllowedOrigin(origin, parseAllowedOrigins(env.ALLOWED_ORIGINS))) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const model = new WorkersAiProvider(env.AI, CONFIG.model, CONFIG.maxOutputTokens);
    return handleChat(request, env, model, new Date());
  },
} satisfies ExportedHandler<Env>;
