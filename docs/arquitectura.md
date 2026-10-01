# Arquitectura

Backend del chatbot del portfolio: un Worker de Cloudflare con D1 y Workers AI. Estado: capas 0 a 4 construidas (todavía no existe `/session`, ni Turnstile, ni el chat flotante).

## Diagrama

```
Navegador (jordipatuel.com)         Cloudflare
┌──────────────────┐  POST /chat   ┌──────────────────────────────┐
│ Cliente          │ ────────────▶ │ Worker                       │
│ (historial en    │               │  1. origen                   │
│  memoria)        │               │  2. validación               │
│                  │ ◀──────────── │  3. límites                  │──▶ D1
└──────────────────┘   respuesta   │  4. modelo                   │──▶ Workers AI
                                   │  5. filtro de salida         │
                                   │  6. registro                 │──▶ D1
                                   └──────────────────────────────┘
                                   Tarea programada (03:00 UTC) ──▶ D1 (limpieza)
```

El backend no guarda el historial: el cliente lo reenvía en cada mensaje y se trata como entrada no fiable.

## Archivos de `src/`

| Archivo | Qué hace | Depende de |
|---|---|---|
| `index.ts` | Punto de entrada: enruta `/chat`, responde al preflight CORS, atrapa errores no controlados y lanza la limpieza programada. | `chat`, `cleanup`, `config`, `http`, `model`, `origin` |
| `chat.ts` | Orquesta los seis pasos de un mensaje. | todos los módulos de abajo |
| `config.ts` | Valores ajustables en un solo sitio (límites, modelo, frase de rechazo). | nada |
| `types.ts` | Tipos de la petición y de los mensajes. | nada |
| `http.ts` | Helper para respuestas JSON. | nada |
| `origin.ts` | Lista de orígenes permitidos (coincidencia exacta) y cabeceras CORS. | nada |
| `body.ts` | Lee el cuerpo por trozos y lo descarta al pasar el tope de bytes. | nada |
| `validate.ts` | Valida y reconstruye la petición campo a campo. | `config`, `types` |
| `visitor.ts` | Día UTC e identificador del visitante (SHA-256 de sal, día e IP). | nada |
| `rateLimit.ts` | Contadores por visitante y globales en una sola sentencia SQL. | `config` |
| `prompt.ts` | Monta el mensaje de sistema con reglas, señuelo y conocimiento. | `config` |
| `knowledge.ts` | Texto público sobre Jordi que el bot puede usar. | nada |
| `model.ts` | Interfaz `ModelProvider` y su implementación con Workers AI. | `types` |
| `outputFilter.ts` | Detecta el señuelo en la respuesta, clasifica y trunca. | nada |
| `log.ts` | Métricas diarias y registro de intercambios. | `outputFilter` |
| `cleanup.ts` | Borra límites antiguos e intercambios de más de 30 días. | `visitor` |

## Recorrido de un mensaje (`POST /chat`)

| Paso | Qué hace | Si falla |
|---|---|---|
| 1. Origen | La cabecera `Origin` debe estar en `ALLOWED_ORIGINS`. | 403 `forbidden_origin` |
| (secretos) | `CANARY` utilizable (al menos 12 caracteres alfanuméricos) y `VISITOR_SALT` presentes. | 500 `server_misconfigured` |
| 2. Validación | Cuerpo de hasta 128 KiB, `conversationId` UUID, mensaje de 1 a 500 caracteres, historial de hasta 20 entradas (pares usuario/asistente alternados, de hasta 2000 caracteres). | 400 `invalid_request` (un único mensaje para todas las reglas) |
| 3. Límites | 20 mensajes por visitante y 100 globales al día. El visitante se comprueba primero. | 429 `visitor_limit` / 503 `daily_limit` |
| 4. Modelo | Reglas en el mensaje `system`; el texto del visitante solo viaja como `user`. Hasta 400 tokens de salida. | 502 `model_error` (también con respuesta vacía) |
| 5. Filtro de salida | Si la respuesta contiene el señuelo se sustituye por la frase de rechazo; si no, se trunca a 2000 caracteres. | 200 con la frase de rechazo |
| 6. Registro | Guarda mensaje y respuesta original. Si falla, solo se anota en el log. | 200 igualmente |

Éxito: 200 `{ reply, remaining }`. Cualquier excepción no prevista: 500 `internal_error`. Rutas distintas de `/chat`: 404; métodos distintos de POST y OPTIONS: 405.

## Base de datos (D1)

Migración: `migrations/0001_init.sql`.

| Tabla | Columnas | Quién escribe |
|---|---|---|
| `rate_limit` | `day`, `visitor`, `count` (clave `day`+`visitor`) | `rateLimit.ts` (paso 3); `cleanup.ts` borra días anteriores |
| `metrics` | `day`, `name`, `count` (clave `day`+`name`) | `rateLimit.ts` (contador `messages`, el tope global) y `log.ts` (rechazos, límites, `canary_hits`, `model_errors`) |
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
| `AI`, `DB` | Bindings a Workers AI y a D1. | `wrangler.jsonc` |

El `database_id` de `wrangler.jsonc` es un marcador: el real se pone al crear la base de producción.

## Decisiones (ADR)

- [0001 — Backend en Cloudflare Workers, plan gratuito](adr/0001-cloudflare-workers-gratis.md)
- [0002 — El modelo se usa a través de una interfaz](adr/0002-modelo-tras-interfaz.md)
- [0003 — Se guardan todos los intercambios 30 días, sin identificador](adr/0003-registro-de-intercambios.md)
