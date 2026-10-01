import { CONFIG } from "./config";
import { KNOWLEDGE } from "./knowledge";
import { buildSystemPrompt } from "./prompt";

// LAYER 0 — deliberately naive baseline. No validation, no limits, no output filter,
// open CORS, and the visitor's text glued to the instructions in a single prompt.
// Each later layer replaces one of these weaknesses.
const OPEN_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface NaiveBody {
  message: string;
  history?: { role: string; content: string }[];
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: OPEN_CORS });
    }

    const body = (await request.json()) as NaiveBody;
    const transcript = (body.history ?? []).map((turn) => `${turn.role}: ${turn.content}`).join("\n");
    const prompt = `${buildSystemPrompt(KNOWLEDGE, env.CANARY)}\n\n${transcript}\nuser: ${body.message}\nassistant:`;

    const result = (await env.AI.run(CONFIG.model as never, { prompt, max_tokens: 1024 } as never)) as {
      response?: string;
    };
    return Response.json({ reply: result.response ?? "", remaining: 999 }, { headers: OPEN_CORS });
  },
} satisfies ExportedHandler<Env>;
