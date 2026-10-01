import { handleChat } from "./chat";
import { cleanup } from "./cleanup";
import { CONFIG } from "./config";
import { json } from "./http";
import { WorkersAiProvider } from "./model";
import { corsHeaders, isAllowedOrigin, parseAllowedOrigins } from "./origin";
import { handleSession } from "./session";
import { CloudflareTurnstile } from "./turnstile";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/chat" && url.pathname !== "/session") return json({ error: "not_found" }, 404);

    // Browsers send this preflight before a cross-origin JSON POST.
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (!isAllowedOrigin(origin, parseAllowedOrigins(env.ALLOWED_ORIGINS))) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      if (url.pathname === "/session") {
        return await handleSession(request, env, new CloudflareTurnstile(env.TURNSTILE_SECRET ?? ""), new Date());
      }
      const model = new WorkersAiProvider(env.AI, CONFIG.model, CONFIG.maxOutputTokens);
      return await handleChat(request, env, model, new Date());
    } catch (error) {
      // Details go to the logs, never to the caller.
      console.error("unhandled error", error);
      return json({ error: "internal_error" }, 500);
    }
  },

  async scheduled(_controller, env): Promise<void> {
    await cleanup(env.DB, new Date(), CONFIG.exchangeRetentionDays);
  },
} satisfies ExportedHandler<Env>;
