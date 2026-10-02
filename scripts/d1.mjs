// Read-only access to the bot's D1 database, shared by `npm run conversaciones` and `npm run panel`.
// Values end up inside SQL, so every one is checked against a strict shape first: the tools that
// read the attacks must not be an injection hole themselves.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export const KINDS = ["ok", "refused", "canary"];

export const METRIC_NAMES = {
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

export function isDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// One wrangler call can run several statements; it returns one result set per statement.
export async function query(sql, { remote = false } = {}) {
  const { stdout } = await run(
    "npx",
    ["wrangler", "d1", "execute", "portfolio-chatbot", remote ? "--remote" : "--local", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(stdout).map((statement) => statement.results);
}

export async function dayReport(day, { remote = false, kind, limit = 500 } = {}) {
  if (!isDay(day)) throw new Error("día inválido");
  if (kind !== undefined && !KINDS.includes(kind)) throw new Error("tipo inválido");
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("límite inválido");
  const kindFilter = kind ? `AND kind = '${kind}'` : "";
  const [metrics, exchanges] = await query(
    `SELECT name, count FROM metrics WHERE day = '${day}' ORDER BY name;
     SELECT created_at, conversation_id, kind, user_message, model_reply FROM exchanges
     WHERE substr(created_at, 1, 10) = '${day}' ${kindFilter}
     ORDER BY created_at DESC LIMIT ${limit}`,
    { remote },
  );
  return { metrics, exchanges };
}

export async function recentDays({ remote = false } = {}) {
  const [days] = await query(
    `SELECT day,
       SUM(CASE WHEN name = 'messages' THEN count ELSE 0 END) AS messages,
       SUM(CASE WHEN name = 'canary_hits' THEN count ELSE 0 END) AS canary,
       SUM(CASE WHEN name LIKE 'rejected_%' OR name LIKE 'limited_%' OR name LIKE 'captcha_%' THEN count ELSE 0 END) AS rejected
     FROM metrics GROUP BY day ORDER BY day DESC LIMIT 60`,
    { remote },
  );
  return days;
}
