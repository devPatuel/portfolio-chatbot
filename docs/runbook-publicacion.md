# Runbook: publicar el chatbot

Pasos para pasar de «funciona en local» a «vivo en jordipatuel.com», en este orden. Cada paso
que publica algo está marcado con 🌐: a partir de ahí hay cosas visibles en internet.

Antes de empezar, en local:

```bash
npx vitest run && npx tsc --noEmit -p .        # backend: todo en verde
(cd ../portfolio && npm test && npm run verificar)  # widget: todo en verde
gitleaks git . --no-banner --redact              # "no leaks found"
```

## 1. Cuenta de Cloudflare

- Verificación en dos pasos activada en la cuenta (panel → My Profile → Authentication).
- `npx wrangler whoami` muestra la cuenta correcta.

## 2. Base de datos D1

```bash
npx wrangler d1 create portfolio-chatbot
```

Copiar el `database_id` que devuelve a `wrangler.jsonc` (sustituye el `00000000-…`) y aplicar las
migraciones en remoto:

```bash
npx wrangler d1 migrations apply portfolio-chatbot --remote
```

## 3. Turnstile con claves reales

Panel → Turnstile → Add widget: hostname `jordipatuel.com` (y `www.jordipatuel.com`), modo
*Managed*. Da una **site key** (pública, va en el widget) y un **secret** (privado, va al Worker).

## 4. Secretos del Worker

Ninguno va a un archivo. Cada comando pide el valor por la terminal:

```bash
openssl rand -hex 32 | npx wrangler secret put PASS_SECRET
openssl rand -hex 32 | npx wrangler secret put VISITOR_SALT
echo "ZX-$(openssl rand -hex 8 | tr a-f A-F)" | npx wrangler secret put CANARY
npx wrangler secret put TURNSTILE_SECRET   # pegar el secret REAL del paso 3
```

Si `TURNSTILE_SECRET` fuera un secreto de prueba (`1x…`, `2x…`, `3x…`), `/session` responde 500:
el Worker se niega a repartir pases con un captcha que deja pasar a todos.

`ALLOWED_ORIGINS` y los límites diarios no son secretos: ya están en `vars` de `wrangler.jsonc`.

## 5. 🌐 Desplegar el Worker

```bash
npx wrangler deploy
```

Apuntar la URL que imprime (`https://portfolio-chatbot.<subdominio>.workers.dev`). Comprobar que
responde y rechaza lo que debe:

```bash
URL=https://portfolio-chatbot.<subdominio>.workers.dev
curl -s -o /dev/null -w "%{http_code}\n" "$URL/"                                   # 404
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/chat" -H "Origin: https://evil.example"  # 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/chat" -H "Origin: https://jordipatuel.com"  # 401 (sin pase)
```

## 6. Límite de peticiones en el WAF

Panel → el dominio → Security → WAF → Rate limiting rules (el plan gratuito incluye una regla).
Si el Worker va por `workers.dev`, la regla no le aplica: entonces conviene una ruta propia
(`chat.jordipatuel.com`) para que el WAF la vea. Regla: rutas `/chat` y `/session`, por IP,
p. ej. 30 peticiones cada 10 s → bloquear 10 s. Cubre las escrituras gratuitas a D1 de
`rejected_pass`, `rejected_origin` y `captcha_failed`, y el abuso de `/session`.

## 7. Widget del portfolio (rama `chat-flotante`)

Cambiar la dirección local por la real en los **cuatro** sitios, con la misma URL exacta:

| Archivo | Qué cambia |
| --- | --- |
| `js/chat-config.js` | `backendUrl` y `turnstileSiteKey` (la site key real del paso 3) |
| **Todas** las páginas `.html` | `connect-src` de la CSP: `http://localhost:8787` → URL del Worker (la misma línea en todas; una prueba exige que sean idénticas) |
| `scripts/verificar.mjs` | `DIRECCIONES_CHAT`: la misma URL |
| `tests/seguridad-estatica.test.js` | la prueba de `connect-src`, con la directiva exacta |

Luego `npm test && npm run verificar` y probar con `npx serve` contra el Worker real (el origen
`localhost` no está permitido en producción, así que esta prueba se hace ya desde el dominio, en el
paso 8, o añadiendo temporalmente el origen local a `ALLOWED_ORIGINS`).

Releer `privacidad.html` contra lo desplegado: 30 días de retención, observability activada en
`wrangler.jsonc`, y D1 Time Travel: Cloudflare guarda el historial de la base de datos 7 días en el plan gratuito,
así que un borrado tarda hasta 7 días más en desaparecer del todo (`privacidad.html` ya lo dice).

## 8. 🌐 Fusionar `chat-flotante` a `main` del portfolio

Hacer push a `main` publica la web (GitHub Pages). Después, en `https://jordipatuel.com`, desde el
móvil y el escritorio:

- El chat abre, el reto de Turnstile pasa y Patu responde.
- La consola del navegador no muestra violaciones de CSP (sobre todo `style-src` del iframe de
  Turnstile con la clave real).
- Con el teclado: Tab recorre el panel y, en el móvil, no se escapa por detrás; Escape cierra.

## 9. Después

- `npx wrangler tail` mientras se prueba; métricas y conversaciones con
  `npx wrangler d1 execute portfolio-chatbot --remote --command "SELECT …"`.
- Panel → Workers AI: neuronas gastadas (el plan gratuito da 10.000 al día).

## Volver atrás

- Apagar el chat sin tocar la web: `npx wrangler delete` (el widget mostrará «Algo ha fallado»).
- Quitar el chat de la web: `git revert` del merge de `chat-flotante` en el portfolio y push.
