import { env } from "cloudflare:workers";
import { CONFIG } from "../src/config";
import type { ModelProvider } from "../src/model";
import { issuePass } from "../src/pass";
import type { TurnstileVerifier } from "../src/turnstile";
import type { ChatMessage } from "../src/types";
import { dayOf, visitorId } from "../src/visitor";

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
    BURST_LIMITER: env.BURST_LIMITER,
    CANARY: env.CANARY,
    VISITOR_SALT: env.VISITOR_SALT,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
    VISITOR_DAILY_LIMIT: env.VISITOR_DAILY_LIMIT,
    GLOBAL_DAILY_LIMIT: env.GLOBAL_DAILY_LIMIT,
    PASS_SECRET: env.PASS_SECRET,
    TURNSTILE_SECRET: env.TURNSTILE_SECRET,
    ...override,
  } as Env;
}

// Stands in for Cloudflare's captcha check: records what it was asked and returns a fixed result.
export class FakeTurnstile implements TurnstileVerifier {
  calls: { token: string; ip: string }[] = [];

  constructor(private readonly result: boolean | Error = true) {}

  async verify(token: string, ip: string): Promise<boolean> {
    this.calls.push({ token, ip });
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

export function sessionRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://chat.test/session", {
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

// Returns a copy of the request with a valid pass for the visitor behind it, for the day of `now`.
export async function withPass(
  request: Request,
  now: Date,
  options: { secret?: string; ip?: string } = {},
): Promise<Request> {
  const ip = options.ip ?? request.headers.get("CF-Connecting-IP") ?? "unknown";
  const visitor = await visitorId(ip, dayOf(now), env.VISITOR_SALT);
  const pass = await issuePass(options.secret ?? env.PASS_SECRET, visitor, now, CONFIG.passTtlSeconds);
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${pass}`);
  return new Request(request, { headers });
}
