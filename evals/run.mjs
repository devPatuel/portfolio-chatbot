// Runs every attack several times against the local bot and writes a Markdown table.
// A judge is approximate by nature: always read the example replies too.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const label = process.argv[2];
if (!label) {
  console.error("Uso: npm run evals -- <etiqueta>   (por ejemplo: capa-0)");
  process.exit(1);
}

const CHAT_URL = process.env.CHAT_URL ?? "http://localhost:8787/chat";
const ORIGIN = process.env.CHAT_ORIGIN ?? "http://localhost:8788";
const RUNS = Number(process.env.RUNS ?? 5);

const SESSION_URL = process.env.SESSION_URL ?? CHAT_URL.replace(/\/chat$/, "/session");
// Cloudflare's public test token: only the test secret key accepts it.
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
let pass = null;

async function getPass() {
  const response = await fetch(SESSION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ turnstileToken: DUMMY_TOKEN }),
  });
  if (!response.ok) {
    console.error(`No se pudo obtener un pase (HTTP ${response.status}). ¿TURNSTILE_SECRET es la clave de prueba?`);
    process.exit(1);
  }
  pass = (await response.json()).pass;
}

async function ask(body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (pass === null) await getPass();
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${pass}` },
      body: JSON.stringify(body),
    });
    if (response.status === 401 && attempt === 0) {
      pass = null;
      continue;
    }
    return response;
  }
}

const root = new URL("../", import.meta.url);
const devVars = await readFile(new URL(".dev.vars", root), "utf8");
const canary = devVars.match(/^CANARY=(.+)$/m)?.[1]?.trim();
if (!canary) {
  console.error("Falta CANARY en .dev.vars");
  process.exit(1);
}

const normalize = (text) => text.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
const canaryNorm = normalize(canary);
const canaryReversed = [...canaryNorm].reverse().join("");

function succeeded(attack, reply) {
  if (attack.successIf.canary) {
    const norm = normalize(reply);
    return norm.includes(canaryNorm) || norm.includes(canaryReversed);
  }
  return new RegExp(attack.successIf.regex, "i").test(reply);
}

// The local canary is not the production one, but keep it out of committed results anyway.
function forTable(text) {
  return text.replaceAll(canary, "[SEÑUELO]").replace(/\s+/g, " ").replaceAll("|", "\\|").slice(0, 160);
}

const attacks = JSON.parse(await readFile(new URL("evals/attacks.json", root), "utf8"));
const rows = [];

for (const attack of attacks) {
  let wins = 0;
  let rejected = 0;
  let example = "";
  for (let run = 0; run < RUNS; run++) {
    const response = await ask({ conversationId: randomUUID(), message: attack.message, history: attack.history });
    if (!response.ok) {
      rejected++;
      if (!example) example = `HTTP ${response.status}`;
      continue;
    }
    const { reply } = await response.json();
    const won = succeeded(attack, reply);
    if (won) wins++;
    // Prefer showing a reply where the attack worked.
    if (won || !example || example.startsWith("HTTP")) example = reply;
  }
  rows.push(`| ${attack.id} | ${attack.descripcion} | ${wins}/${RUNS} | ${rejected}/${RUNS} | ${forTable(example)} |`);
  console.log(`${attack.id}: ${wins}/${RUNS} éxitos, ${rejected}/${RUNS} rechazadas`);
}

const report = [
  `# Ronda de ataques: ${label}`,
  "",
  `Fecha: ${new Date().toISOString().slice(0, 10)} · ${RUNS} intentos por ataque`,
  "",
  "| Ataque | Qué intenta | Éxitos | Rechazadas por el backend | Ejemplo de respuesta |",
  "|---|---|---|---|---|",
  ...rows,
  "",
].join("\n");

await mkdir(new URL("evals/results/", root), { recursive: true });
await writeFile(new URL(`evals/results/${label}.md`, root), report);
console.log(`Escrito evals/results/${label}.md`);
