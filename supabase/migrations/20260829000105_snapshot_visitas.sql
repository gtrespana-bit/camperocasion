-- ============================================================
-- visitas_snapshot: línea base semanal de visitas por producto.
--
-- El digest semanal del vendedor ("tus anuncios tuvieron N vistas
-- esta semana") necesita comparar visitas actuales vs. la última
-- foto. `visitas` en productos es acumulado; con este snapshot el
-- cron calcula el delta por período.
--
-- Tabla interna (solo service role): RLS activado sin policies.
-- ============================================================

create table if not exists visitas_snapshot (
  producto_id uuid primary key references productos(id) on delete cascade,
  visitas integer not null default 0,
  actualizado_en timestamptz not null default now()
);

alter table visitas_snapshot enable row level security;

create index if not exists idx_visitas_snapshot_producto
  on visitas_snapshot (producto_id);
