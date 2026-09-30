# ADR 0002 — El modelo se usa a través de una interfaz

Fecha: 2026-09-30 · Estado: aceptada

## Contexto

Se empieza con un modelo abierto gratuito, cuya calidad y resistencia a la manipulación son
inciertas. Puede hacer falta cambiar a otro modelo o a otro proveedor.

## Decisión

El resto del código solo conoce la interfaz `ModelProvider`, con un método
`generate(system, messages)`. `WorkersAiProvider` es la única implementación.

## Consecuencias

- Cambiar de proveedor es escribir otra implementación; `chat.ts` no cambia.
- Las pruebas usan un modelo doble y no gastan cuota.
- Las funciones propias de un proveedor quedan fuera de la interfaz hasta que hagan falta.
