// Prints the day's metrics and the stored conversations in a readable form.
// Usage: npm run conversaciones -- [--remote] [--dia AAAA-MM-DD] [--tipo ok|refused|canary] [--limite N]
import { dayReport, isDay, KINDS, METRIC_NAMES } from "./d1.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const remote = args.includes("--remote");
const day = option("--dia") ?? new Date().toISOString().slice(0, 10);
const kind = option("--tipo");
const limit = Number(option("--limite") ?? 50);

if (!isDay(day)) fail("--dia debe ser AAAA-MM-DD");
if (kind !== undefined && !KINDS.includes(kind)) fail("--tipo debe ser ok, refused o canary");
if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail("--limite debe ser un número entre 1 y 500");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const KIND_LABELS = { ok: "respondida", refused: "rechazada por el filtro", canary: "SEÑUELO" };

const { metrics, exchanges: rows } = await dayReport(day, { remote, kind, limit });

console.log(`\n== ${day} (${remote ? "producción" : "local"}, horas en UTC) ==\n`);
if (metrics.length === 0) console.log("Sin actividad.");
for (const { name, count } of metrics) console.log(`  ${String(count).padStart(5)}  ${METRIC_NAMES[name] ?? name}`);

// Group by conversation, oldest message first inside each one, so a talk reads top to bottom.
const conversations = new Map();
for (const row of rows.reverse()) {
  if (!conversations.has(row.conversation_id)) conversations.set(row.conversation_id, []);
  conversations.get(row.conversation_id).push(row);
}

console.log(`\n${rows.length} mensajes en ${conversations.size} conversaciones${kind ? ` (solo ${kind})` : ""}\n`);
for (const [id, messages] of conversations) {
  console.log(`── conversación ${id.slice(0, 8)} ─────────────────────────────`);
  for (const message of messages) {
    console.log(`  ${message.created_at.slice(11, 19)}  [${KIND_LABELS[message.kind] ?? message.kind}]`);
    console.log(`    visitante: ${message.user_message}`);
    console.log(`    Patu:      ${message.model_reply}\n`);
  }
}
