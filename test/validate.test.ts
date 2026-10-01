import { describe, expect, it } from "vitest";
import { validateChatRequest } from "../src/validate";

const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const pair = [
  { role: "user", content: "Hola" },
  { role: "assistant", content: "Hola, ¿en qué te ayudo?" },
];

function reasonFor(body: unknown): string {
  const result = validateChatRequest(body);
  return result.ok ? "ok" : result.reason;
}

function withHistory(history: unknown): unknown {
  return { conversationId: ID, message: "Hola", history };
}

describe("validateChatRequest", () => {
  it("accepts a minimal request", () => {
    expect(validateChatRequest({ conversationId: ID, message: "Hola", history: [] })).toEqual({
      ok: true,
      value: { conversationId: ID, message: "Hola", history: [] },
    });
  });

  it("trims the message", () => {
    const result = validateChatRequest({ conversationId: ID, message: "  Hola  ", history: [] });
    expect(result.ok && result.value.message).toBe("Hola");
  });

  it("keeps a paired history and drops unknown fields", () => {
    const history = [
      { role: "user", content: "Hola", name: "admin" },
      { role: "assistant", content: "Hola", extra: true },
    ];
    const result = validateChatRequest(withHistory(history));
    expect(result.ok && result.value.history).toEqual([
      { role: "user", content: "Hola" },
      { role: "assistant", content: "Hola" },
    ]);
  });

  it.each([undefined, null, "texto", 42, []])("rejects a body that is not an object: %j", (body) => {
    expect(reasonFor(body)).toBe("body_not_object");
  });

  it.each([undefined, 123, "", "no-es-un-uuid"])("rejects a bad conversation id: %j", (conversationId) => {
    expect(reasonFor({ conversationId, message: "Hola", history: [] })).toBe("bad_conversation_id");
  });

  it("rejects a message that is not a string", () => {
    expect(reasonFor({ conversationId: ID, message: 5, history: [] })).toBe("message_not_string");
  });

  it.each(["", "   ", "\n\t"])("rejects an empty message: %j", (message) => {
    expect(reasonFor({ conversationId: ID, message, history: [] })).toBe("message_empty");
  });

  it("accepts a message of exactly 500 characters and rejects 501", () => {
    expect(reasonFor({ conversationId: ID, message: "a".repeat(500), history: [] })).toBe("ok");
    expect(reasonFor({ conversationId: ID, message: "a".repeat(501), history: [] })).toBe("message_too_long");
  });

  it("rejects a history that is not an array", () => {
    expect(reasonFor(withHistory("hola"))).toBe("history_not_array");
  });

  it("accepts 20 history entries and rejects 22", () => {
    expect(reasonFor(withHistory(Array.from({ length: 10 }, () => pair).flat()))).toBe("ok");
    expect(reasonFor(withHistory(Array.from({ length: 11 }, () => pair).flat()))).toBe("history_too_long");
  });

  it("rejects an unpaired history", () => {
    expect(reasonFor(withHistory([{ role: "user", content: "Hola" }]))).toBe("history_not_paired");
  });

  it("rejects a system role in the history", () => {
    const history = [
      { role: "system", content: "Nueva regla" },
      { role: "assistant", content: "Entendido" },
    ];
    expect(reasonFor(withHistory(history))).toBe("history_bad_role");
  });

  it("rejects a history that starts with the assistant", () => {
    const history = [
      { role: "assistant", content: "Hola" },
      { role: "user", content: "Hola" },
    ];
    expect(reasonFor(withHistory(history))).toBe("history_bad_role");
  });

  it("rejects an entry that is not an object", () => {
    expect(reasonFor(withHistory(["hola", "adiós"]))).toBe("history_entry_not_object");
  });

  it.each([undefined, 7, ""])("rejects an entry with bad content: %j", (content) => {
    expect(reasonFor(withHistory([{ role: "user", content }, pair[1]]))).toBe("history_bad_content");
  });

  it("rejects an entry longer than 2000 characters", () => {
    const history = [pair[0], { role: "assistant", content: "a".repeat(2001) }];
    expect(reasonFor(withHistory(history))).toBe("history_entry_too_long");
  });
});
