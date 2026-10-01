import { CONFIG } from "./config";

export interface Limits {
  visitor: number;
  global: number;
}

export type LimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: "visitor_limit" | "daily_limit" };

// Insert-or-increment in a single statement. When the counter is already at the limit,
// the WHERE clause skips the update and RETURNING yields no row. Reading and then writing
// in two steps would let simultaneous requests all read "below the limit" and all pass.
const BUMP_VISITOR = `
  INSERT INTO rate_limit (day, visitor, count) VALUES (?1, ?2, 1)
  ON CONFLICT (day, visitor) DO UPDATE SET count = count + 1 WHERE count < ?3
  RETURNING count`;

const BUMP_GLOBAL = `
  INSERT INTO metrics (day, name, count) VALUES (?1, 'messages', 1)
  ON CONFLICT (day, name) DO UPDATE SET count = count + 1 WHERE count < ?2
  RETURNING count`;

export async function checkAndCount(
  db: D1Database,
  day: string,
  visitor: string,
  limits: Limits,
): Promise<LimitResult> {
  // Visitor first: someone over their own limit must not eat into the global budget.
  const own = await db.prepare(BUMP_VISITOR).bind(day, visitor, limits.visitor).first<{ count: number }>();
  if (own === null) return { allowed: false, reason: "visitor_limit" };

  const total = await db.prepare(BUMP_GLOBAL).bind(day, limits.global).first<{ count: number }>();
  if (total === null) return { allowed: false, reason: "daily_limit" };

  return { allowed: true, remaining: limits.visitor - own.count };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

// A missing or malformed setting falls back to the safe default instead of disabling the limit.
export function limitsFromEnv(env: { VISITOR_DAILY_LIMIT?: string; GLOBAL_DAILY_LIMIT?: string }): Limits {
  return {
    visitor: positiveInt(env.VISITOR_DAILY_LIMIT, CONFIG.visitorDailyLimit),
    global: positiveInt(env.GLOBAL_DAILY_LIMIT, CONFIG.globalDailyLimit),
  };
}
