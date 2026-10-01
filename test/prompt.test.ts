import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/config";
import { buildSystemPrompt } from "../src/prompt";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt("Jordi programa en Java.", "ZX-TESTCANARY0001");

  it("includes the canary", () => {
    expect(prompt).toContain("ZX-TESTCANARY0001");
  });

  it("includes the fixed refusal sentence", () => {
    expect(prompt).toContain(CONFIG.refusalText);
  });

  it("puts the knowledge between the delimiters", () => {
    const start = prompt.indexOf("<<<");
    const end = prompt.indexOf(">>>");
    expect(start).toBeGreaterThan(-1);
    expect(prompt.slice(start, end)).toContain("Jordi programa en Java.");
  });

  it("states the rules before the knowledge", () => {
    expect(prompt.indexOf("REGLAS")).toBeLessThan(prompt.indexOf("INFORMACIÓN"));
  });
});
