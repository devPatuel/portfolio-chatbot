# Ronda manual de la capa 5: el widget en el navegador

Fecha: 2026-10-01 · Chrome, `http://localhost:8788` (portfolio, rama `chat-flotante`) contra `http://localhost:8787` (backend, rama `plan-2-capas-5-7`), claves de prueba de Turnstile.

## Hallazgo de la ronda

- **Fallo encontrado solo en el navegador:** el panel se creó como `<section>` y `css/style.css` tiene una regla para todo el sitio (`section { padding: …80px 48px }`). El panel se veía con un hueco enorme, la cabecera estrecha y el registro de mensajes aplastado (24 px, el saludo no se veía). Ninguna prueba automática podía verlo. Arreglo: el panel pasa a `<div>` y una prueba de regresión impide volver a crear `section` o `footer` en `js/chat.js` (commits `cf9e7a2`…`ba4dc67` del portfolio).

## Resultados

| Comprobación | Resultado |
|---|---|
| Al cargar la página no hay peticiones a Cloudflare ni al backend | ✅ solo se crea el lanzador |
| Al abrir por primera vez: carga Turnstile y llama a `/session` (200) | ✅ una sola vez |
| Saludo de Patu, tres sugerencias, aviso de privacidad visibles antes de escribir | ✅ |
| Pregunta real al bot (sugerencia) | ✅ respuesta correcta; «Te quedan 933 mensajes hoy.»; el modelo tardó unos 10 s |
| Consola | ✅ sin violaciones de CSP; solo un aviso interno de Turnstile («Ignored message from unexpected source…») |
| **Pintado seguro:** respuesta simulada con `<img onerror>`, `<script>`, `<b>` y un enlace `javascript:` | ✅ se muestra como texto literal; 0 elementos creados en el registro; `document.title` no cambia |
| Estados de error: `model_error`, `captcha_failed`, respuesta desconocida | ✅ mensajes correctos, el campo sigue activo |
| `visitor_limit` (429) | ✅ mensaje con enlace `mailto:chatbot.info@jordipatuel.com` y campo bloqueado |
| Conversación larga (14 mensajes) | ✅ el historial enviado crece 4, 6… 20 y se queda en 20; siempre par y empezando por `user` |
| Renovación silenciosa: `/chat` 401 `invalid_pass` | ✅ `/session` nuevo (token de captcha nuevo) y reintento; el visitante solo ve la respuesta |
| Almacenamiento | ✅ `localStorage` sin claves; el acceso a cookies y `sessionStorage` lo bloquea la herramienta del navegador, pendiente de comprobar a mano |
| Modo oscuro | ✅ sigue los colores del sitio |
| Móvil (390 px) | ✅ el panel ocupa toda la pantalla |

## Pendiente de comprobar a mano (no se pudo desde la herramienta)

- Cookies y almacenamiento del iframe de Turnstile (DevTools → Aplicación). Con las claves de prueba, Turnstile no pidió nada visible.
- Navegación solo con teclado (Tab, Intro, Escape) y foco visible.
