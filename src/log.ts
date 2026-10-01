import type { ExchangeKind } from "./outputFilter";

export type MetricName =
  | "rejected_invalid"
  | "rejected_origin"
  | "rejected_pass"
  | "captcha_failed"
  | "captcha_unavailable"
  | "limited_visitor"
  | "limited_global"
  | "canary_hits"
  | "model_errors";

export async function bumpMetric(db: D1Database, day: string, name: MetricName): Promise<void> {
  await db
    .prepare(
      "INSERT INTO metrics (day, name, count) VALUES (?1, ?2, 1) ON CONFLICT (day, name) DO UPDATE SET count = count + 1",
    )
    .bind(day, name)
    .run();
}

// Log only the message: provider errors can carry request details we do not want in logs.
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

// A counter that fails to update must never change the response.
export async function countMetric(db: D1Database, day: string, name: MetricName): Promise<void> {
  try {
    await bumpMetric(db, day, name);
  } catch (error) {
    console.error("metric failed", name, errorMessage(error));
  }
}

export interface Exchange {
  createdAt: string;
  conversationId: string;
  kind: ExchangeKind;
  userMessage: string;
  modelReply: string;
}

// No IP and no visitor id on purpose: a stored exchange cannot be traced back to a person.
export async function saveExchange(db: D1Database, exchange: Exchange): Promise<void> {
  await db
    .prepare(
      "INSERT INTO exchanges (created_at, conversation_id, kind, user_message, model_reply) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(exchange.createdAt, exchange.conversationId, exchange.kind, exchange.userMessage, exchange.modelReply)
    .run();
}
