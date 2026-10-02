// Prints the day's metrics and the stored conversations in a readable form.
// Usage: npm run conversaciones -- [--remote] [--dia AAAA-MM-DD] [--tipo ok|refused|canary] [--limite N]
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const remote = args.includes("--remote");
const day = option("--dia") ?? new Date().toISOString().slice(0, 10);
const kind = option("--tipo");
const limit = Number(option("--limite") ?? 50);

// The values end up inside SQL, so they are checked against strict shapes first: this script
// must not be the injection hole of a project about injection.
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail("--dia debe ser AAAA-MM-DD");
if (kind !== undefined && !["ok", "refused", "canary"].includes(kind)) fail("--tipo debe ser ok, refused o canary");
if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail("--limite debe ser un número entre 1 y 500");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function query(sql) {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "portfolio-chatbot", remote ? "--remote" : "--local", "--json", "--command", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(output)[0].results;
}

const METRIC_NAMES = {
  messages: "mensajes respondidos",
  rejected_origin: "rechazados por origen",
  rejected_pass: "rechazados sin pase válido",
  rejected_invalid: "rechazados por formato",
  limited_visitor: "cortados por el límite del visitante",
  limited_global: "cortados por el límite global",
  model_errors: "errores del modelo",
  captcha_failed: "captcha fallido",
  captcha_unavailable: "captcha sin respuesta de Cloudflare",
  canary_hits: "señuelo filtrado (ataque con éxito parcial)",
};

const KIND_LABELS = { ok: "respondida", refused: "rechazada por el filtro", canary: "SEÑUELO" };

console.log(`\n== ${day} (${remote ? "producción" : "local"}, horas en UTC) ==\n`);
const metrics = query(`SELECT name, count FROM metrics WHERE day = '${day}' ORDER BY name`);
if (metrics.length === 0) console.log("Sin actividad.");
for (const { name, count } of metrics) console.log(`  ${String(count).padStart(5)}  ${METRIC_NAMES[name] ?? name}`);

const kindFilter = kind ? `AND kind = '${kind}'` : "";
const rows = query(
  `SELECT created_at, conversation_id, kind, user_message, model_reply FROM exchanges
   WHERE substr(created_at, 1, 10) = '${day}' ${kindFilter}
   ORDER BY created_at DESC LIMIT ${limit}`,
);

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
