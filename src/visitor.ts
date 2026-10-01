export function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// The salt is what makes this irreversible: there are only ~4 billion IPv4 addresses, so
// an unsalted hash could be reversed by hashing them all. Including the day means the
// same visitor gets a different id tomorrow.
export async function visitorId(ip: string, day: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${day}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
