import type { ChatMessage } from "./types";

export interface ModelProvider {
  generate(system: string, messages: ChatMessage[]): Promise<string>;
}

type RunChat = (
  model: string,
  input: { messages: { role: string; content: string }[]; max_tokens: number },
) => Promise<{ response?: string }>;

export class WorkersAiProvider implements ModelProvider {
  constructor(
    private readonly ai: Ai,
    private readonly model: string,
    private readonly maxTokens: number,
  ) {}

  async generate(system: string, messages: ChatMessage[]): Promise<string> {
    // Ai.run is typed per model name. Ours comes from config, so narrow it to the chat shape we use.
    const run = this.ai.run.bind(this.ai) as unknown as RunChat;
    const result = await run(this.model, {
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: this.maxTokens,
    });
    const text = result.response?.trim();
    if (!text) throw new Error("empty model response");
    return text;
  }
}
