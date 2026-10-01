# Arranque en local

## Requisitos

- Node 26.
- Una cuenta de Cloudflare (plan gratuito, no pide tarjeta).

## Pasos

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Crea `.dev.vars` con un señuelo y una sal aleatorios. El archivo está en `.gitignore`: nunca se sube.

   ```bash
   printf 'CANARY=ZX-%s\nVISITOR_SALT=%s\nALLOWED_ORIGINS=http://localhost:8788\nVISITOR_DAILY_LIMIT=20\nGLOBAL_DAILY_LIMIT=100\n' \
     "$(openssl rand -hex 8 | tr 'a-f' 'A-F')" "$(openssl rand -hex 32)" > .dev.vars
   ```

   `.dev.vars.example` muestra la forma del archivo con valores falsos. En local, `.dev.vars` sustituye a los `vars` de `wrangler.jsonc`.

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
