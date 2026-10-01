import { describe, expect, it } from "vitest";
import { readJsonBody } from "../src/body";

function post(body: string | null): Request {
  return new Request("https://chat.test/chat", { method: "POST", body });
}

describe("readJsonBody", () => {
  it("parses a JSON body", async () => {
    expect(await readJsonBody(post('{"a":1}'), 100)).toEqual({ a: 1 });
  });

  it("returns undefined when there is no body", async () => {
    expect(await readJsonBody(post(null), 100)).toBeUndefined();
  });

  it("returns undefined when the body is not JSON", async () => {
    expect(await readJsonBody(post("hola"), 100)).toBeUndefined();
  });

  it("accepts a body of exactly the maximum size", async () => {
    const body = JSON.stringify("a".repeat(98));
    expect(body.length).toBe(100);
    expect(await readJsonBody(post(body), 100)).toBe("a".repeat(98));
  });

  it("returns undefined when the body is over the maximum size", async () => {
    expect(await readJsonBody(post(JSON.stringify("a".repeat(99))), 100)).toBeUndefined();
  });

  it("counts bytes, not characters", async () => {
    // 62 characters, but each "ñ" takes two bytes: 122 bytes in total.
    expect(await readJsonBody(post(JSON.stringify("ñ".repeat(60))), 100)).toBeUndefined();
  });
});
