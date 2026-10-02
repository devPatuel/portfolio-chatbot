# Arranque en local

## Requisitos

- Node 26.
- Una cuenta de Cloudflare (plan gratuito, no pide tarjeta).

## Pasos

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Crea `.dev.vars` con un señuelo, una sal y un secreto del pase aleatorios, y la clave secreta de prueba de Turnstile. El archivo está en `.gitignore`: nunca se sube.

   ```bash
   printf 'CANARY=ZX-%s\nVISITOR_SALT=%s\nPASS_SECRET=%s\nTURNSTILE_SECRET=1x0000000000000000000000000000000AA\nALLOWED_ORIGINS=http://localhost:8788\nVISITOR_DAILY_LIMIT=20\nGLOBAL_DAILY_LIMIT=100\n' \
     "$(openssl rand -hex 8 | tr 'a-f' 'A-F')" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .dev.vars
   ```

   `.dev.vars.example` muestra la forma del archivo con valores falsos. En local, `.dev.vars` sustituye a los `vars` de `wrangler.jsonc`. `PASS_SECRET` necesita al menos 32 caracteres; con uno más corto, `/session` y `/chat` responden 500 `server_misconfigured`.

3. Inicia sesión en Cloudflare (necesario porque el binding de IA siempre es remoto):

   ```bash
   npx wrangler login
   ```

4. Crea las tablas en la base D1 local:

   ```bash
   npx wrangler d1 migrations apply portfolio-chatbot --local
   ```

5. Arranca el Worker y la página de pruebas, cada uno en su terminal:

   ```bash
   npm run dev
   python3 -m http.server 8788 --directory dev
   ```

   Abre `http://localhost:8788`. El Worker escucha en `http://localhost:8787/chat`.

## Probar el chat completo

1. En `portfolio-chatbot`: `npm run dev` (Worker en `http://localhost:8787`).
2. En `~/dev/portfolio` (rama `chat-flotante`): `python3 -m http.server 8788`.
3. Abre `http://localhost:8788` y pulsa el lanzador del chat. Al abrirlo por primera vez, el widget carga Turnstile, pide un pase a `/session` y ya puede enviar mensajes.

Notas:

- `evals` y la página `dev/index.html` no usan Turnstile real: piden su propio pase enviando a `/session` el token de prueba `XXXX.DUMMY.TOKEN.XXXX`, que el secreto de prueba acepta siempre.
- Las claves de prueba de Turnstile (site key `1x00000000000000000000BB`, secret `1x0000000000000000000000000000000AA`) funcionan en `localhost`. La site key de prueba ya está en `js/chat-config.js` del portfolio.
- **Nunca** va una clave real de Turnstile a un archivo versionado: la secret real se define con `wrangler secret put` y la site key real se cambia en `chat-config.js` solo en la fase de publicación.
- El pase está atado al visitante, que sale de tu IP: si cambias de red con la página abierta, el widget renueva el pase solo.

## Pruebas

```bash
npm test
npm run typecheck
```

## Rondas de ataques

```bash
npm run evals -- <etiqueta>
```

Escribe `evals/results/<etiqueta>.md` con 5 intentos por ataque de `evals/attacks.json`. Una ronda envía unas 55 peticiones desde la misma IP, así que con los límites normales se cortaría a los 20 mensajes:

1. Antes: sube `VISITOR_DAILY_LIMIT` y `GLOBAL_DAILY_LIMIT` a 1000 en `.dev.vars` y reinicia `npm run dev`.
2. Después: devuélvelos a 20 y 100.

## Ver las conversaciones

```bash
npm run conversaciones                          # hoy, en local
npm run conversaciones -- --dia 2026-10-01 --tipo canary
npm run conversaciones -- --remote              # producción, cuando esté publicada
```

Muestra las métricas del día y los mensajes agrupados por conversación (horas en UTC).

## Ver las neuronas gastadas

Panel de Cloudflare → **AI → Workers AI → Usage** (`dash.cloudflare.com/<cuenta>/ai/workers-ai/usage`): «Neurons used today: X/10k». Es la cuota gratuita diaria, se reinicia a las 00:00 UTC y el panel tarda unos minutos en reflejar las llamadas. Es la misma cuota en local y en producción.

## Consultas útiles de D1 (local)

```bash
npx wrangler d1 execute portfolio-chatbot --local \
  --command "SELECT id, kind, substr(user_message, 1, 50) AS pregunta, substr(model_reply, 1, 60) AS respuesta FROM exchanges ORDER BY id DESC LIMIT 5"
npx wrangler d1 execute portfolio-chatbot --local --command "SELECT * FROM metrics ORDER BY day DESC, name"
curl -s "http://localhost:8787/cdn-cgi/local/scheduled"
```

La última dispara la tarea programada de limpieza.

## Aviso

Las llamadas al modelo en local van a Cloudflare y gastan la cuota diaria gratuita de Workers AI (10.000 neuronas). Una ronda de ataques entera consume una parte apreciable.
