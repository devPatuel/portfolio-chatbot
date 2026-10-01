import { dayOf } from "./visitor";

const DAY_MS = 86_400_000;

export async function cleanup(db: D1Database, now: Date, retentionDays: number): Promise<void> {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS).toISOString();
  await db.batch([
    db.prepare("DELETE FROM rate_limit WHERE day < ?1").bind(dayOf(now)),
    // ISO timestamps sort alphabetically in chronological order, so a text comparison is enough.
    db.prepare("DELETE FROM exchanges WHERE created_at < ?1").bind(cutoff),
  ]);
}
