-- ============================================================================
-- CamperOcasión — Anuncios globales del sitio
-- Fecha: 2026-08-30
--
-- Permite al panel admin publicar un banner informativo visible en toda la
-- aplicación sin tocar código en cada despliegue.
--
-- RLS: el público solo puede LEER anuncios activos; la escritura se hace
-- siempre desde /api/admin/anuncios con service_role (admin autenticado).
-- ============================================================================

create table if not exists public.anuncios_globales (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  mensaje text not null,
  emoji text not null default '📢',
  enlace text,
  enlace_texto text,
  activo boolean not null default true,
  expira_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.anuncios_globales enable row level security;

revoke all on public.anuncios_globales from anon, authenticated;

-- Lectura pública limitada a lo estrictamente visible (escrituras solo admin).
grant select on public.anuncios_globales to anon, authenticated;
grant all on public.anuncios_globales to service_role;
DROP POLICY IF EXISTS "Anuncios activos públicos" ON "public"."anuncios_globales";


create policy "Anuncios activos públicos"
on public.anuncios_globales
for select
using (activo = true);

create index if not exists idx_anuncios_globales_activo
on public.anuncios_globales (activo, expira_en)
where activo = true;
