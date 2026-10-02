# Chatbot del portfolio

Backend de **Patu**, el asistente de IA de [jordipatuel.com](https://jordipatuel.com): responde preguntas sobre mi perfil profesional y está construido para aguantar a quien intente sacarle lo que no debe. Coste cero, en el plan gratuito de Cloudflare.

El objetivo real era aprender a construir un chatbot **seguro**, así que se hizo por capas: un bot ingenuo, catorce ataques reales contra él, una defensa, y otra vez los ataques. Los resultados de cada ronda están en [`evals/results/`](evals/results/).

## Cómo funciona

Un Worker de Cloudflare con dos rutas:

- `POST /session`: comprueba el captcha (Turnstile) en el servidor y entrega un pase firmado con HMAC, de 30 minutos y atado al visitante.
- `POST /chat`: siete pasos en orden, de lo barato a lo caro: origen, pase, validación, límites diarios, modelo (Llama 3.1 8B en Workers AI), filtro de salida con señuelo y registro en D1.

Antes de todo, un límite de ráfagas por red corta los abusos sin tocar la base de datos. El widget del chat vive en el [repo del portfolio](https://github.com/devPatuel/devPatuel.github.io).

## Documentación

| Documento | Qué cuenta |
|---|---|
| [Arquitectura](docs/arquitectura.md) | Diagrama, archivos de `src/`, recorrido de un mensaje y de una sesión, base de datos y variables |
| [Seguridad](docs/seguridad.md) | Principios, tabla de ataques ronda a ronda, agujeros conocidos y auditoría previa a la publicación |
| [Decisiones (ADR)](docs/adr/) | Por qué Cloudflare Workers gratis, por qué el modelo va tras una interfaz y qué se registra |
| [Arranque en local](docs/setup-local.md) | Cómo levantarlo, ver las conversaciones y lanzar las rondas de ataques |
| [Runbook de publicación](docs/runbook-publicacion.md) | Los pasos para desplegarlo y cómo volver atrás |

## Probarlo

```bash
npm install
npm test          # 222 pruebas
npm run typecheck
```

Para arrancarlo en local hace falta una cuenta de Cloudflare (gratis): ver [Arranque en local](docs/setup-local.md).

## Stack

TypeScript · Cloudflare Workers · Workers AI · D1 (SQLite) · Turnstile · Vitest

## Licencia

El código es [Apache 2.0](LICENSE): úsalo, modifícalo y redistribúyelo, también con fines comerciales. **No** se licencian los nombres «Jordi Patuel», «Patu» y «devPatuel» ni el personaje de Patu, ni mi información personal de `src/knowledge.ts`: detalles en [NOTICE](NOTICE).

