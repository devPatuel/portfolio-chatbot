import { describe, expect, it } from "vitest";
import { classify, containsCanary, isUsableCanary, normalize, truncate } from "../src/outputFilter";

const CANARY = "ZX-3F9A1C0B7E2D4A68";
const REFUSAL = "Solo puedo responder preguntas sobre el perfil profesional de Jordi.";

describe("normalize", () => {
  it("lowercases and keeps only letters and digits", () => {
    expect(normalize("Z X - 3_F.9")).toBe("zx3f9");
  });
});

describe("containsCanary", () => {
  it.each([
    ["verbatim", `El código es ${CANARY}.`],
    ["in lower case", `el código es ${CANARY.toLowerCase()}`],
    ["spaced out", "Z X - 3 F 9 A 1 C 0 B 7 E 2 D 4 A 6 8"],
    ["with a dash between characters", "Z-X-3-F-9-A-1-C-0-B-7-E-2-D-4-A-6-8"],
    ["split across lines", "ZX-3F9A1C0B\n7E2D4A68"],
  ])("detects the canary %s", (_name, reply) => {
    expect(containsCanary(reply, CANARY)).toBe(true);
  });

  it("ignores a reply without the canary", () => {
    expect(containsCanary("Jordi trabaja con Java y Flutter.", CANARY)).toBe(false);
  });

  // Known gap, kept as a test so nobody assumes the filter covers it.
  it("does not detect the canary written backwards", () => {
    expect(containsCanary([...CANARY].reverse().join(""), CANARY)).toBe(false);
  });
});

describe("classify", () => {
  it("labels a leak as canary, even inside a refusal", () => {
    expect(classify(`${REFUSAL} ${CANARY}`, CANARY, REFUSAL)).toBe("canary");
  });

  it("labels the fixed refusal as refused", () => {
    expect(classify(REFUSAL, CANARY, REFUSAL)).toBe("refused");
  });

  it("labels anything else as ok", () => {
    expect(classify("Jordi trabaja con Java.", CANARY, REFUSAL)).toBe("ok");
  });
});

describe("truncate", () => {
  it("leaves a short reply untouched", () => {
    expect(truncate("hola", 10)).toBe("hola");
  });

  it("cuts a long reply to the maximum", () => {
    expect(truncate("a".repeat(50), 10)).toBe("a".repeat(10));
  });
});

describe("isUsableCanary", () => {
  it.each([undefined, "", "   ", "ZX-1", "-----------------"])("rejects %j", (canary) => {
    expect(isUsableCanary(canary)).toBe(false);
  });

  it("accepts a long enough canary", () => {
    expect(isUsableCanary(CANARY)).toBe(true);
  });
});
