// Local, read-only panel to read the bot's conversations and metrics: npm run panel.
// The data are attacks written by strangers, so the panel treats them as hostile:
// it only listens on 127.0.0.1, checks the Host header, sends a strict CSP and
// paints every stored text with textContent (panel.js).
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dayReport, isDay, METRIC_NAMES, recentDays } from "../d1.mjs";

const PORT = Number(process.env.PANEL_PORT ?? 8799);
const HOST = "127.0.0.1";
const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const FILES = { "/": "index.html", "/panel.js": "panel.js", "/panel.css": "panel.css" };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
// A web page can point its own domain at 127.0.0.1 (DNS rebinding) and read this panel;
// accepting only our own Host names closes that door.
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, ...SECURITY_HEADERS });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

createServer(async (req, res) => {
  if (!ALLOWED_HOSTS.has(req.headers.host ?? "")) return send(res, 403, { error: "host" });
  if (req.method !== "GET") return send(res, 405, { error: "method" });
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (FILES[url.pathname]) {
    const file = FILES[url.pathname];
    return send(res, 200, await readFile(join(PUBLIC, file), "utf8"), TYPES[extname(file)]);
  }

  // Anything other than exactly "1" means local: production is opt-in, never a default.
  const remote = url.searchParams.get("remote") === "1";
  try {
    if (url.pathname === "/api/dias") return send(res, 200, { days: await recentDays({ remote }) });
    if (url.pathname === "/api/dia") {
      const day = url.searchParams.get("d");
      if (!isDay(day)) return send(res, 400, { error: "día inválido" });
      return send(res, 200, { ...(await dayReport(day, { remote })), names: METRIC_NAMES });
    }
  } catch (error) {
    console.error(error.message);
    return send(res, 502, { error: "No se pudo leer la base de datos. ¿Has hecho wrangler login?" });
  }
  send(res, 404, { error: "not_found" });
}).listen(PORT, HOST, () => console.log(`Panel en http://${HOST}:${PORT}`));
