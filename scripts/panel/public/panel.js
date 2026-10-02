// Everything stored in D1 was written by strangers, many of them attacking the bot. It is painted
// only with textContent: innerHTML here would turn a stored attack into code running in this panel.
const $ = (selector) => document.querySelector(selector);

const KIND_LABELS = { ok: "respondida", refused: "rechazada", canary: "señuelo" };
const ALERT_METRICS = new Set(["canary_hits", "model_errors", "captcha_unavailable"]);
const WARN_PREFIXES = ["rejected_", "limited_", "captcha_failed"];

const state = { remote: false, day: null, kind: "", search: "", data: null };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(path) {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body;
}

function status(text) {
  $(".estado").textContent = text;
}

async function loadDays() {
  status("Cargando días…");
  const { days } = await api(`/api/dias?remote=${state.remote ? 1 : 0}`);
  const list = $(".lista-dias");
  list.replaceChildren();
  for (const day of days) {
    const button = element("button");
    button.type = "button";
    const label = element("span", "", day.day);
    if (day.canary > 0) label.append(element("span", "punto-canario"));
    button.append(label, element("span", "num", `${day.messages} msg`));
    button.addEventListener("click", () => selectDay(day.day));
    button.dataset.day = day.day;
    const item = element("li");
    item.append(button);
    list.append(item);
  }
  status(days.length === 0 ? "Todavía no hay actividad en esta base de datos." : "");
  if (days.length > 0) await selectDay(days.some((d) => d.day === state.day) ? state.day : days[0].day);
}

async function selectDay(day) {
  state.day = day;
  for (const button of document.querySelectorAll(".lista-dias button")) {
    if (button.dataset.day === day) button.setAttribute("aria-current", "date");
    else button.removeAttribute("aria-current");
  }
  status("Cargando conversaciones…");
  state.data = await api(`/api/dia?d=${encodeURIComponent(day)}&remote=${state.remote ? 1 : 0}`);
  status("");
  renderMetrics();
  renderConversations();
}

function renderMetrics() {
  $(".titulo-dia").textContent = `${state.day} · ${state.remote ? "producción" : "local"}`;
  const box = $(".metricas");
  box.replaceChildren();
  for (const { name, count } of state.data.metrics) {
    const card = element("div", "metrica");
    if (ALERT_METRICS.has(name) && count > 0) card.classList.add("alerta");
    else if (WARN_PREFIXES.some((prefix) => name.startsWith(prefix))) card.classList.add("aviso");
    card.append(element("div", "valor", String(count)), element("div", "nombre", state.data.names[name] ?? name));
    box.append(card);
  }
}

function renderConversations() {
  const needle = state.search.trim().toLowerCase();
  const rows = state.data.exchanges
    .filter((row) => !state.kind || row.kind === state.kind)
    .filter((row) => !needle || `${row.user_message}\n${row.model_reply}`.toLowerCase().includes(needle));

  // Oldest message first inside a conversation, newest conversation first on the page.
  const conversations = new Map();
  for (const row of [...rows].reverse()) {
    if (!conversations.has(row.conversation_id)) conversations.set(row.conversation_id, []);
    conversations.get(row.conversation_id).push(row);
  }
  const ordered = [...conversations].reverse();

  $(".resumen").textContent = `${rows.length} mensajes en ${conversations.size} conversaciones · horas en UTC`;
  const box = $(".conversaciones");
  box.replaceChildren();
  for (const [id, messages] of ordered) {
    const card = element("details", "conversacion");
    card.open = ordered.length <= 8 || messages.some((m) => m.kind === "canary");
    if (messages.some((m) => m.kind === "canary")) card.classList.add("con-canario");
    const summary = element("summary");
    const first = messages[0].created_at.slice(11, 19), last = messages.at(-1).created_at.slice(11, 19);
    summary.append(
      element("span", "id", id.slice(0, 8)),
      element("span", "", messages[0].user_message.slice(0, 70)),
      element("span", "meta", `${messages.length} msg · ${first}${first === last ? "" : `–${last}`}`),
    );
    const list = element("div", "mensajes");
    for (const message of messages) {
      const turn = element("div", "turno");
      turn.append(element("div", "burbuja visitante", message.user_message));
      turn.append(element("div", `burbuja patu ${message.kind}`, message.model_reply));
      const foot = element("div", "pie");
      foot.append(element("span", `etiqueta ${message.kind}`, KIND_LABELS[message.kind] ?? message.kind));
      foot.append(element("span", "", message.created_at.slice(11, 19)));
      if (message.kind === "canary") {
        foot.append(element("span", "nota", "Arriba, la respuesta original del modelo. El visitante solo recibió la frase de rechazo."));
      }
      turn.append(foot);
      list.append(turn);
    }
    card.append(summary, list);
    box.append(card);
  }
}

function pressOne(groupSelector, pressed) {
  for (const button of document.querySelectorAll(`${groupSelector} button`)) {
    button.setAttribute("aria-pressed", String(button === pressed));
  }
}

for (const button of document.querySelectorAll(".entorno button")) {
  button.addEventListener("click", () => {
    state.remote = button.dataset.remote === "1";
    pressOne(".entorno", button);
    loadDays().catch((error) => status(error.message));
  });
}
for (const button of document.querySelectorAll(".tipos button")) {
  button.addEventListener("click", () => {
    state.kind = button.dataset.kind;
    pressOne(".tipos", button);
    if (state.data) renderConversations();
  });
}
$(".buscar").addEventListener("input", (event) => {
  state.search = event.target.value;
  if (state.data) renderConversations();
});
$(".recargar").addEventListener("click", () => loadDays().catch((error) => status(error.message)));

loadDays().catch((error) => status(error.message));
