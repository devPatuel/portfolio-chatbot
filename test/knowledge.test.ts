import { describe, expect, it } from "vitest";
import { KNOWLEDGE } from "../src/knowledge";

describe("knowledge", () => {
  it("has real content", () => {
    expect(KNOWLEDGE.trim().length).toBeGreaterThan(200);
  });

  it("stays small enough to travel in every request", () => {
    expect(KNOWLEDGE.length).toBeLessThan(6000);
  });

  it("contains no phone number", () => {
    expect(KNOWLEDGE).not.toMatch(/[6-9]\d{2}[ .-]?\d{3}[ .-]?\d{3}/);
  });

  it("contains no email address other than the chatbot's own", () => {
    const emails = KNOWLEDGE.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
    expect(emails).toEqual(["chatbot.info@jordipatuel.com"]);
  });
});
