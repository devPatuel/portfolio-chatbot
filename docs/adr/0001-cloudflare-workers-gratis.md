# ADR 0001 — Backend en Cloudflare Workers, plan gratuito

Fecha: 2026-09-30 · Estado: aceptada

## Contexto

El portfolio es HTML estático en GitHub Pages. El chat necesita un backend para que la
credencial del modelo no llegue al navegador y para aplicar límites. No se quiere mantener un
servidor ni asumir ningún coste.

## Decisión

Un Cloudflare Worker en TypeScript, con Workers AI como modelo y D1 como base de datos, todo
en el plan gratuito.

## Consecuencias

- Al superar una cuota gratuita las operaciones fallan con error; no se cobra. El tope de
  gasto es cero por diseño.
- El backend no puede escribirse en Java. La alternativa, AWS Lambda, no tiene tope de gasto
  real, solo alarmas.
- Todo el tratamiento de datos queda en un único proveedor.
