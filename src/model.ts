import type { ChatMessage } from "./types";

export interface ModelProvider {
  generate(system: string, messages: ChatMessage[]): Promise<string>;
}

type RunChat = (
  model: string,
  input: {
    messages: { role: string; content: string }[];
    max_tokens: number;
    chat_template_kwargs?: { enable_thinking: boolean };
  },
) => Promise<{
  response?: string;
  choices?: { message?: { content?: string | null } }[];
}>;

export class WorkersAiProvider implements ModelProvider {
  constructor(
    private readonly ai: Ai,
    private readonly model: string,
    private readonly maxTokens: number,
    private readonly thinking = true,
  ) {}

  async generate(system: string, messages: ChatMessage[]): Promise<string> {
    // Ai.run is typed per model name. Ours comes from config, so narrow it to the chat shape we use.
    const run = this.ai.run.bind(this.ai) as unknown as RunChat;
    const result = await run(this.model, {
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: this.maxTokens,
      // Reasoning models spend the token budget thinking and can return no content at all.
      ...(this.thinking ? {} : { chat_template_kwargs: { enable_thinking: false } }),
    });
    // Older models answer with `response`; newer ones (Gemma 4, Qwen 3.x) use the OpenAI shape.
    const text = (result.response ?? result.choices?.[0]?.message?.content)?.trim();
    if (!text) throw new Error("empty model response");
    return text;
  }
}
