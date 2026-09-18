# Documentación de CamperOcasión

Índice del directorio `docs/`. Los documentos están marcados como **vigente**
(describe cómo funciona el proyecto hoy) o **histórico** (análisis de una fecha
concreta, se conserva como traza de las decisiones).

## Estado y planes (vigentes)

| Documento | Qué contiene |
|---|---|
| [`ANALISIS-COMPLETO-2026-09-18.md`](./ANALISIS-COMPLETO-2026-09-18.md) | **Auditoría técnica y de producto del 2026-09-18**: verificación completa (tipos, lint, tests, build, rutas), correcciones aplicadas y las mejoras de alto impacto pendientes. Empieza por aquí. |
| [`ESTADO-IMPLEMENTACION.md`](./ESTADO-IMPLEMENTACION.md) | Estado de implementación y seguridad. Conserva el histórico de auditorías del proyecto base (referencias a "VendeT"/"BCV"/"Bs" como traza; el proyecto activo es CamperOcasión). |
| [`plan-confianza-marketplace.md`](./plan-confianza-marketplace.md) | Los 6 pilares de confianza: homologación verificada, inspección, filtros, gestoría, escrow. Qué está hecho y qué falta, por fases. |
| [`PENDIENTES-DESPLIEGUE.md`](./PENDIENTES-DESPLIEGUE.md) | Checklist de despliegue: variables de entorno, dominios, DNS, SMTP, crons. |
| [`PANEL-ADMIN.md`](./PANEL-ADMIN.md) | Manual del panel de administración. |
| [`rls-policies.md`](./rls-policies.md) | Políticas de seguridad de base de datos (RLS). |

## Diagnósticos puntuales (vigentes, de consulta)

| Documento | Qué contiene |
|---|---|
| [`diagnostico-supabase-401.md`](./diagnostico-supabase-401.md) | El `401 Invalid API key` y cómo se arregló (URL/clave de proyectos distintos). |
| [`estimacion-costos-agencia.md`](./estimacion-costos-agencia.md) | Estimación de lo que costaría construir esto con una agencia. |

## Histórico (fechas concretas, no actualizar)

| Documento | Fecha |
|---|---|
| [`PLAN-AUDITORIA-2026-08.md`](./PLAN-AUDITORIA-2026-08.md) | 2026-08 |
| [`analisis-completo-errores.md`](./analisis-completo-errores.md) | 2026-08 |
| [`security-enhancements.md`](./security-enhancements.md) | 2026-08 |
| [`analisis-2026-07-31-fase2.md`](./analisis-2026-07-31-fase2.md) | 2026-07-31 |
| [`analisis-rendimiento-2026-08-01.md`](./analisis-rendimiento-2026-08-01.md) | 2026-08-01 |
| [`seo-fixes-2026-08-01.md`](./seo-fixes-2026-08-01.md) | 2026-08-01 |

## Rendimiento (histórico, cinco documentos solapados)

`README-performance.md`, `performance-optimization.md`, `performance-optimizations.md`,
`performance-summary.md` e `investigacion-lighthouse-2026-08-02.md` describen la
misma campaña de optimización de agosto de 2026 desde ángulos distintos. Se
conservan tal cual; si vas a hacer una nueva campaña de rendimiento, escribe un
único documento nuevo en vez de añadir otro a esta lista.

## Cómo se usa el directorio

- Un documento por tema, con fecha en el nombre si es un análisis puntual.
- Si algo cambió, se actualiza el documento vigente en lugar de crear otro.
- Las decisiones importantes se explican **con el motivo** (el "por qué"), no
  solo el qué: es lo que evita que se deshagan seis meses después.
