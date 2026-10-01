import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { cleanup } from "../src/cleanup";

async function insertExchange(conversationId: string, createdAt: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO exchanges (created_at, conversation_id, kind, user_message, model_reply) VALUES (?1, ?2, 'ok', 'q', 'a')",
  )
    .bind(createdAt, conversationId)
    .run();
}

async function exists(sql: string, value: string): Promise<boolean> {
  return (await env.DB.prepare(sql).bind(value).first()) !== null;
}

describe("cleanup", () => {
  it("deletes exchanges older than the retention and rate-limit rows from past days", async () => {
    await insertExchange("old", "2032-01-15T00:00:00.000Z");
    await insertExchange("recent", "2032-02-20T00:00:00.000Z");
    await env.DB.prepare("INSERT INTO rate_limit (day, visitor, count) VALUES ('2032-03-01', 'v', 1)").run();
    await env.DB.prepare("INSERT INTO rate_limit (day, visitor, count) VALUES ('2032-03-02', 'v', 1)").run();
    await env.DB.prepare("INSERT INTO metrics (day, name, count) VALUES ('2032-03-01', 'messages', 9)").run();

    await cleanup(env.DB, new Date("2032-03-02T12:00:00.000Z"), 30);

    const byConversation = "SELECT 1 FROM exchanges WHERE conversation_id = ?1";
    const byDay = "SELECT 1 FROM rate_limit WHERE day = ?1";
    expect(await exists(byConversation, "old")).toBe(false);
    expect(await exists(byConversation, "recent")).toBe(true);
    expect(await exists(byDay, "2032-03-01")).toBe(false);
    expect(await exists(byDay, "2032-03-02")).toBe(true);
    // Daily counters hold no personal data and are kept as history.
    expect(await exists("SELECT 1 FROM metrics WHERE day = ?1", "2032-03-01")).toBe(true);
  });
});
