// Every tunable value lives here so limits are changed in one place.
export const CONFIG = {
  maxMessageChars: 500,
  maxHistoryEntries: 20,
  maxHistoryEntryChars: 2000,
  maxBodyBytes: 131_072,
  visitorDailyLimit: 20,
  globalDailyLimit: 100,
  maxOutputTokens: 400,
  exchangeRetentionDays: 30,
  model: "@cf/meta/llama-3.1-8b-instruct-fp8",
  refusalText: "Soy Patu y solo puedo responder preguntas sobre el perfil profesional de Jordi.",
} as const;
