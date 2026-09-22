-- ═══════════════════════════════════════════════════════════════════════════
-- 202609220003 — Avisos de renovación al vendedor (2026-09-22)
--
-- Registra cuándo se avisó por última vez de cada anuncio, para no repetir el
-- mismo mensaje. Sin esto, el cron mandaría el aviso todos los días al mismo
-- vendedor: la forma más rápida de que silencie las notificaciones y se dé de
-- baja de los correos.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.productos
  add column if not exists ultimo_aviso_en timestamptz;

comment on column public.productos.ultimo_aviso_en is
  'Última vez que se avisó al vendedor de que este anuncio perdió visibilidad. '
  'Lo usa /api/cron/avisos-renovacion para respetar DIAS_ENTRE_AVISOS.';

-- Índice parcial: el cron busca candidatos entre los anuncios vivos, que son
-- una fracción del total.
create index if not exists productos_avisos_idx
  on public.productos (ultimo_aviso_en)
  where activo = true and vendido = false;
