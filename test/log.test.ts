import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { bumpMetric, saveExchange } from "../src/log";
import { CONFIG } from "../src/config";

describe("bumpMetric", () => {
  it("creates the counter and then increments it", async () => {
    await bumpMetric(env.DB, "2033-01-01", "canary_hits");
    await bumpMetric(env.DB, "2033-01-01", "canary_hits");

    const row = await env.DB.prepare("SELECT count FROM metrics WHERE day = '2033-01-01' AND name = 'canary_hits'").first<{
      count: number;
    }>();
    expect(row?.count).toBe(2);
  });
});

describe("saveExchange", () => {
  it("stores the exchange with its label and no visitor identifier", async () => {
    await saveExchange(env.DB, {
      createdAt: "2033-01-01T10:00:00.000Z",
      conversationId: "11111111-1111-4111-8111-111111111111",
      kind: "refused",
      userMessage: "¿Capital de Francia?",
      modelReply: CONFIG.refusalText,
    });

    const row = await env.DB.prepare(
      "SELECT * FROM exchanges WHERE conversation_id = '11111111-1111-4111-8111-111111111111'",
    ).first<Record<string, unknown>>();
    expect(row).toMatchObject({
      created_at: "2033-01-01T10:00:00.000Z",
      kind: "refused",
      user_message: "¿Capital de Francia?",
      model_reply: CONFIG.refusalText,
    });
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "conversation_id",
      "created_at",
      "id",
      "kind",
      "model_reply",
      "user_message",
    ]);
  });
});
