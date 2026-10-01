export type ExchangeKind = "ok" | "refused" | "canary";

// Strips everything that is not a letter or a digit, so spacing, dashes, line breaks
// and letter case cannot hide the canary.
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function containsCanary(reply: string, canary: string): boolean {
  return normalize(reply).includes(normalize(canary));
}

export function classify(reply: string, canary: string, refusalText: string): ExchangeKind {
  if (containsCanary(reply, canary)) return "canary";
  if (reply.includes(refusalText)) return "refused";
  return "ok";
}

export function truncate(reply: string, maxChars: number): string {
  return reply.length <= maxChars ? reply : reply.slice(0, maxChars);
}

// An empty canary would match every reply and a very short one would match by accident.
export function isUsableCanary(canary: string | undefined): canary is string {
  return typeof canary === "string" && normalize(canary).length >= 12;
}
