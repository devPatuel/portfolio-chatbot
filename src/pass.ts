// A pass is `payload.signature`, both base64url. The payload carries the expiry and the
// visitor id; the signature is HMAC-SHA256 with a secret only the Worker knows. The pass is
// only valid for the visitor it was issued to, so solving the captcha once cannot be shared.
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const padded = text.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function issuePass(secret: string, visitor: string, now: Date, ttlSeconds: number): Promise<string> {
  const exp = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const payload = toBase64Url(encoder.encode(JSON.stringify({ exp, vid: visitor })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyPass(secret: string, pass: string, visitor: string, now: Date): Promise<boolean> {
  const parts = pass.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;

  const signatureBytes = fromBase64Url(signature);
  const payloadBytes = fromBase64Url(payload);
  if (signatureBytes === null || payloadBytes === null) return false;

  // subtle.verify compares the signatures in constant time.
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), signatureBytes, encoder.encode(payload));
  if (!valid) return false;

  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return false;
  }
  if (typeof claims !== "object" || claims === null) return false;
  const { exp, vid } = claims as Record<string, unknown>;
  return typeof exp === "number" && typeof vid === "string" && exp > now.getTime() / 1000 && vid === visitor;
}

// The limit keeps an absurdly long header from reaching the crypto code at all.
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer ([A-Za-z0-9_.-]{1,2048})$/);
  return match ? match[1] : null;
}

// A short or empty secret would make passes forgeable, so the Worker must refuse to run.
export function isUsablePassSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= 32;
}
