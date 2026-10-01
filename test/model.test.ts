import { describe, expect, it } from "vitest";
import { WorkersAiProvider } from "../src/model";

function fakeAi(response: unknown) {
  const calls: { model: string; input: unknown }[] = [];
  const ai = {
    run: async (model: string, input: unknown) => {
      calls.push({ model, input });
      return response;
    },
  } as unknown as Ai;
  return { ai, calls };
}

describe("WorkersAiProvider", () => {
  it("sends the rules as the system message, before the conversation", async () => {
    const { ai, calls } = fakeAi({ response: "Hola" });
    const provider = new WorkersAiProvider(ai, "test-model", 400);

    await provider.generate("RULES", [{ role: "user", content: "Hola" }]);

    expect(calls[0]).toEqual({
      model: "test-model",
      input: {
        messages: [
          { role: "system", content: "RULES" },
          { role: "user", content: "Hola" },
        ],
        max_tokens: 400,
      },
    });
  });

  it("returns the trimmed reply", async () => {
    const { ai } = fakeAi({ response: "  Hola  \n" });
    const provider = new WorkersAiProvider(ai, "test-model", 400);

    expect(await provider.generate("RULES", [])).toBe("Hola");
  });

  it.each([{ response: "" }, { response: "   " }, {}])("throws when the model returns no text: %j", async (response) => {
    const { ai } = fakeAi(response);
    const provider = new WorkersAiProvider(ai, "test-model", 400);

    await expect(provider.generate("RULES", [])).rejects.toThrow("empty model response");
  });
});
