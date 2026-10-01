import { CONFIG } from "./config";
import type { ChatMessage, ChatRequest } from "./types";

export type ValidationResult = { ok: true; value: ChatRequest } | { ok: false; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason: string): ValidationResult {
  return { ok: false, reason };
}

export function validateChatRequest(body: unknown): ValidationResult {
  if (!isRecord(body)) return fail("body_not_object");

  const { conversationId, message, history } = body;
  if (typeof conversationId !== "string" || !UUID.test(conversationId)) return fail("bad_conversation_id");

  if (typeof message !== "string") return fail("message_not_string");
  const trimmed = message.trim();
  if (trimmed.length === 0) return fail("message_empty");
  if (trimmed.length > CONFIG.maxMessageChars) return fail("message_too_long");

  if (!Array.isArray(history)) return fail("history_not_array");
  if (history.length > CONFIG.maxHistoryEntries) return fail("history_too_long");
  if (history.length % 2 !== 0) return fail("history_not_paired");

  // The history is rebuilt field by field: anything the client added beyond role and
  // content never reaches the model.
  const clean: ChatMessage[] = [];
  for (let i = 0; i < history.length; i++) {
    const entry: unknown = history[i];
    if (!isRecord(entry)) return fail("history_entry_not_object");
    // The visitor speaks first and turns alternate. This also rejects any "system" role.
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (entry.role !== expected) return fail("history_bad_role");
    if (typeof entry.content !== "string" || entry.content.length === 0) return fail("history_bad_content");
    if (entry.content.length > CONFIG.maxHistoryEntryChars) return fail("history_entry_too_long");
    clean.push({ role: expected, content: entry.content });
  }

  return { ok: true, value: { conversationId, message: trimmed, history: clean } };
}
