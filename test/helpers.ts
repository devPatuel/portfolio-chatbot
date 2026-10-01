import { env } from "cloudflare:workers";
import type { ModelProvider } from "../src/model";
import type { ChatMessage } from "../src/types";

export const ORIGIN = "https://jordipatuel.com";
export const CONVERSATION_ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

// Stands in for the real model: records what it was asked and returns a fixed reply.
export class FakeModel implements ModelProvider {
  calls: { system: string; messages: ChatMessage[] }[] = [];

  constructor(private readonly reply: string | Error = "Jordi trabaja con Java.") {}

  async generate(system: string, messages: ChatMessage[]): Promise<string> {
    this.calls.push({ system, messages });
    if (this.reply instanceof Error) throw this.reply;
    return this.reply;
  }
}

let dayOffset = 0;

// Tests in one file share the same local database, so each test gets its own calendar
// day and starts with clean counters.
export function freshDay(): Date {
  return new Date(Date.UTC(2030, 0, 1 + dayOffset++, 12));
}

export function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { conversationId: CONVERSATION_ID, message: "¿Qué tecnologías usa Jordi?", history: [], ...overrides };
}

export function chatRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://chat.test/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "CF-Connecting-IP": "203.0.113.7",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Builds an environment with some bindings replaced. Bindings are copied one by one
// because the test environment object is not guaranteed to survive a spread.
export function envWith(override: Partial<Env>): Env {
  return {
    AI: env.AI,
    DB: env.DB,
    CANARY: env.CANARY,
    VISITOR_SALT: env.VISITOR_SALT,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
    VISITOR_DAILY_LIMIT: env.VISITOR_DAILY_LIMIT,
    GLOBAL_DAILY_LIMIT: env.GLOBAL_DAILY_LIMIT,
    ...override,
  } as Env;
}
