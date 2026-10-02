export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

// Exact match only: no prefixes, no wildcards, no subdomains.
export function isAllowedOrigin(origin: string | null, allowed: string[]): origin is string {
  return origin !== null && allowed.includes(origin);
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    // The response depends on the Origin header, so caches must not share it across origins.
    Vary: "Origin",
  };
}

export function hostnamesOf(origins: string[]): string[] {
  return origins.map((origin) => new URL(origin).hostname);
}

export function onlyLocalOrigins(origins: string[]): boolean {
  return origins.every((origin) => ["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
}
