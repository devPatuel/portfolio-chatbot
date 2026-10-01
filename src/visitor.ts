export function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// Someone with IPv6 controls a whole /64 block, so rate limits are keyed by the prefix:
// changing address inside it must not give a fresh daily quota. IPv4 stays per address.
export function networkKey(ip: string): string {
  const address = ip.split("%")[0].toLowerCase();
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!address.includes(":")) return address;

  const groups = expandIPv6(address);
  if (groups === null) return address;
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(":")}::/64`;
}

function expandIPv6(address: string): number[] | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 2 && missing < 1)) return null;

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  const numbers = groups.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : Number.NaN));
  return numbers.some(Number.isNaN) ? null : numbers;
}

// The salt is what makes this irreversible: there are only ~4 billion IPv4 addresses, so
// an unsalted hash could be reversed by hashing them all. Including the day means the
// same visitor gets a different id tomorrow.
export async function visitorId(ip: string, day: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${day}|${networkKey(ip)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
