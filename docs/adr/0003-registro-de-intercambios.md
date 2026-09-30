# ADR 0003 — Se guardan todos los intercambios 30 días, sin identificador

Fecha: 2026-09-30 · Estado: aceptada

## Contexto

El proyecto existe para aprender de los ataques. Guardar solo las respuestas bloqueadas
dejaría fuera los intentos fallidos y los ataques que funcionan sin tocar el señuelo.

## Decisión

Cada mensaje del visitante se guarda con la respuesta original del modelo, una etiqueta
(`ok`, `refused`, `canary`) y un identificador aleatorio de conversación. No se guarda la IP
ni el identificador del visitante. Una tarea diaria borra lo que tiene más de 30 días.

## Consecuencias

- Un visitante puede escribir datos personales: hace falta un aviso visible antes del primer
  mensaje y una página de privacidad (Plan 2).
- La etiqueta es una ayuda para filtrar, no una clasificación exacta.
- El identificador del visitante usado para los límites vive en otra tabla y no se puede
  cruzar con los intercambios.
