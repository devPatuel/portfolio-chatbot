# Arquitectura

Backend del chatbot del portfolio: un Worker de Cloudflare con D1 y Workers AI. Estado: capas 0 a 7 construidas (`/session` con Turnstile, pase firmado y chat flotante en el repo del portfolio). Pendiente: publicación (Plan 3).

## Diagrama

```
Navegador (jordipatuel.com)         Cloudflare
┌──────────────────┐  POST /session ┌──────────────────────────────┐
│ Widget           │ ─────────────▶ │ Worker                       │
│ (pase e historial│  token Turnstile  1. origen, secretos, cuerpo  │
│  solo en memoria)│               │  2. siteverify ──────────────│──▶ Turnstile
│                  │ ◀───────────── │  3. emite el pase (30 min)   │
│                  │   pase         │                              │
│                  │  POST /chat    │                              │
│                  │ ─────────────▶ │  1. origen                   │
│                  │  Bearer pase   │  2. pase (401 si no vale)    │
│                  │               │  3. validación               │
│                  │ ◀───────────── │  4. límites                  │──▶ D1
└──────────────────┘   respuesta   │  5. modelo                   │──▶ Workers AI
                                   │  6. filtro de salida         │
                                   │  7. registro                 │──▶ D1
                                   └──────────────────────────────┘
                                   Tarea programada (03:00 UTC) ──▶ D1 (limpieza)
```

El backend no guarda el historial: el cliente lo reenvía en cada mensaje y se trata como entrada no fiable. Tampoco guarda pases: el pase se verifica con su firma.

## Archivos de `src/`

| Archivo | Qué hace | Depende de |
|---|---|---|
| `index.ts` | Punto de entrada: enruta `/chat` y `/session`, responde al preflight CORS, atrapa errores no controlados y lanza la limpieza programada. | `chat`, `session`, `turnstile`, `cleanup`, `config`, `http`, `model`, `origin` |
| `chat.ts` | Orquesta los pasos de un mensaje, incluida la comprobación del pase. | todos los módulos de abajo |
| `session.ts` | `POST /session`: valida el token de Turnstile y emite el pase. | `body`, `config`, `http`, `log`, `origin`, `pass`, `turnstile`, `visitor` |
| `pass.ts` | Emite y verifica el pase (`payload.firma`, HMAC-SHA256, comparación en tiempo constante), lee el `Bearer` y valida que `PASS_SECRET` sea utilizable. | nada |
| `turnstile.ts` | Interfaz `TurnstileVerifier` y su implementación con `siteverify` (el `fetch` es inyectable para las pruebas). | nada |
| `config.ts` | Valores ajustables en un solo sitio (límites, modelo, frase de rechazo). | nada |
| `types.ts` | Tipos de la petición y de los mensajes. | nada |
| `http.ts` | Helper para respuestas JSON. | nada |
| `origin.ts` | Lista de orígenes permitidos (coincidencia exacta) y cabeceras CORS. | nada |
| `body.ts` | Lee el cuerpo por trozos y lo descarta al pasar el tope de bytes. | nada |
| `validate.ts` | Valida y reconstruye la petición campo a campo. | `config`, `types` |
| `visitor.ts` | Día UTC, `networkKey` (IPv4 entera, IPv6 por prefijo /64) e identificador del visitante (SHA-256 de sal, día y `networkKey`). | nada |
| `rateLimit.ts` | Contadores por visitante y globales en una sola sentencia SQL. | `config` |
| `prompt.ts` | Monta el mensaje de sistema con reglas, señuelo y conocimiento. | `config` |
| `knowledge.ts` | Texto público sobre Jordi que el bot puede usar. | nada |
| `model.ts` | Interfaz `ModelProvider` y su implementación con Workers AI. | `types` |
| `outputFilter.ts` | Detecta el señuelo en la respuesta, clasifica y trunca. | nada |
| `log.ts` | Métricas diarias (`bumpMetric`; `countMetric` no deja que un fallo del contador cambie la respuesta) y registro de intercambios. | `outputFilter` |
| `cleanup.ts` | Borra límites antiguos e intercambios de más de 30 días. | `visitor` |

## Recorrido de un mensaje (`POST /chat`)

| Paso | Qué hace | Si falla |
|---|---|---|
| 1. Origen | La cabecera `Origin` debe estar en `ALLOWED_ORIGINS`. | 403 `forbidden_origin` |
| (secretos) | `CANARY` utilizable (al menos 12 caracteres alfanuméricos), `VISITOR_SALT` presente y `PASS_SECRET` de al menos 32 caracteres. | 500 `server_misconfigured` |
| 2. Pase | `Authorization: Bearer <pase>`: firma válida, no caducado y atado al visitante que llama (se recalcula su identificador). Va antes de leer el cuerpo y de gastar cupo. | 401 `invalid_pass` (cuenta `rejected_pass`) |
| 3. Validación | Cuerpo de hasta 128 KiB, `conversationId` UUID, mensaje de 1 a 500 caracteres, historial de hasta 20 entradas (pares usuario/asistente alternados, de hasta 2000 caracteres). | 400 `invalid_request` (un único mensaje para todas las reglas) |
| 4. Límites | 20 mensajes por visitante y 100 globales al día. El visitante se comprueba primero. | 429 `visitor_limit` / 503 `daily_limit` |
| 5. Modelo | Reglas en el mensaje `system`; el texto del visitante solo viaja como `user`. Hasta 400 tokens de salida. | 502 `model_error` (también con respuesta vacía) |
| 6. Filtro de salida | Si la respuesta contiene el señuelo se sustituye por la frase de rechazo; si no, se trunca a 2000 caracteres. | 200 con la frase de rechazo |
| 7. Registro | Guarda mensaje y respuesta original. Si falla, solo se anota en el log. | 200 igualmente |

Éxito: 200 `{ reply, remaining }`. Cualquier excepción no prevista: 500 `internal_error`. Rutas distintas de `/chat` y `/session`: 404; métodos distintos de POST y OPTIONS: 405.

## Recorrido de una sesión (`POST /session`)

El widget llama aquí una vez al abrir el chat por primera vez, y de nuevo si `/chat` contesta 401.

| Paso | Qué hace | Si falla |
|---|---|---|
| 1. Origen | Igual que en `/chat`. | 403 `forbidden_origin` |
| (secretos) | `PASS_SECRET` (al menos 32 caracteres), `TURNSTILE_SECRET` y `VISITOR_SALT` presentes. La comprobación de `PASS_SECRET` va antes de cualquier función criptográfica porque `importKey` lanza error con una clave vacía. | 500 `server_misconfigured` |
| 2. Cuerpo | Hasta 4096 bytes; `turnstileToken` de 1 a 2048 caracteres. | 400 `invalid_request` |
| 3. Turnstile | `siteverify` con el token y la IP. | Rechazado: 403 `captcha_failed`. Sin respuesta o error HTTP: 503 `captcha_unavailable` (falla cerrado, no hay pase) |
| 4. Pase | Firma `{ exp, vid }` con HMAC-SHA256 y `PASS_SECRET`; `vid` es el identificador del visitante. | (cualquier excepción no prevista: 500 `internal_error`) |

Éxito: 200 `{ pass, expiresIn: 1800 }`. Métricas nuevas en D1: `rejected_pass`, `captcha_failed`, `captcha_unavailable`.

## El widget

Vive en el repo del portfolio (`~/dev/portfolio`, rama `chat-flotante`), no en este.

| Archivo | Qué hace |
|---|---|
| `js/chat-config.js` | Único sitio con las direcciones externas: URL del backend, script y site key de Turnstile, correo de contacto. `scripts/verificar.mjs` solo permite esas dos direcciones y la CSP de `index.html` debe coincidir. |
| `js/chat-core.js` | Lógica pura sin DOM (estado, recorte del historial, llamadas a `/session` y `/chat`), probada con `tests/chat-core.test.js`. |
| `js/chat.js` | Interfaz: lanzador, panel, Turnstile. Pinta todo texto con `textContent`; una prueba estática (`tests/seguridad-estatica.test.js`) prohíbe `innerHTML` y similares. |
| `privacidad.html` | Qué se guarda y durante cuánto, contrastado frase a frase con este código. |

Contrato con el backend:

- El pase vive solo en memoria. Se pide al abrir el chat (la petición en curso se comparte entre `prepare()` y `send()`) y se renueva **una vez** ante un 401, con un token de Turnstile **nuevo** (son de un solo uso y duran 5 minutos).
- El historial se recorta a las últimas 20 entradas (par, empezando por `user`), que es lo máximo que acepta el backend.
- Errores conocidos (`visitor_limit`, `daily_limit`, `captcha_failed`, `model_error`…) se traducen a mensajes de Patu; un código desconocido muestra un mensaje genérico.
- La URL del backend de `chat-config.js` y de `connect-src` es la **local**; se cambia en la publicación junto con la site key.

## Base de datos (D1)

Migración: `migrations/0001_init.sql`.

| Tabla | Columnas | Quién escribe |
|---|---|---|
| `rate_limit` | `day`, `visitor`, `count` (clave `day`+`visitor`) | `rateLimit.ts` (paso 3); `cleanup.ts` borra días anteriores |
| `metrics` | `day`, `name`, `count` (clave `day`+`name`) | `rateLimit.ts` (contador `messages`, el tope global), `log.ts` y `session.ts` (rechazos, `rejected_pass`, `captcha_failed`, `captcha_unavailable`, límites, `canary_hits`, `model_errors`) |
| `exchanges` | `id`, `created_at`, `conversation_id`, `kind` (`ok`/`refused`/`canary`), `user_message`, `model_reply` | `log.ts` (paso 6); `cleanup.ts` borra los de más de 30 días |

`exchanges` no guarda IP ni identificador de visitante.

## Variables y secretos

| Nombre | Para qué sirve | Dónde se define |
|---|---|---|
| `ALLOWED_ORIGINS` | Orígenes que pueden llamar al bot (separados por comas). | `vars` en `wrangler.jsonc`; en local, `.dev.vars` |
| `VISITOR_DAILY_LIMIT` | Mensajes por visitante y día (20). | igual |
| `GLOBAL_DAILY_LIMIT` | Mensajes totales por día (100). | igual |
| `CANARY` | Señuelo del mensaje de sistema; si sale en una respuesta, hay fuga. Secreto. | `.dev.vars` en local; secreto de Wrangler en producción |
| `VISITOR_SALT` | Sal del hash del visitante. Secreto. | igual |
| `PASS_SECRET` | Clave HMAC con la que se firman y verifican los pases (mínimo 32 caracteres; se genera con `openssl rand -hex 32`). Secreto. | `.dev.vars` en local; secreto de Wrangler en producción |
| `TURNSTILE_SECRET` | Clave secreta de Turnstile para `siteverify`. En local, la de prueba de Cloudflare. Secreto. | igual |
| `AI`, `DB` | Bindings a Workers AI y a D1. | `wrangler.jsonc` |

El `database_id` de `wrangler.jsonc` es un marcador: el real se pone al crear la base de producción.

## Decisiones (ADR)

- [0001 — Backend en Cloudflare Workers, plan gratuito](adr/0001-cloudflare-workers-gratis.md)
- [0002 — El modelo se usa a través de una interfaz](adr/0002-modelo-tras-interfaz.md)
- [0003 — Se guardan todos los intercambios 30 días, sin identificador](adr/0003-registro-de-intercambios.md)
