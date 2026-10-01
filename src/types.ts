export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  conversationId: string;
  message: string;
  history: ChatMessage[];
}
