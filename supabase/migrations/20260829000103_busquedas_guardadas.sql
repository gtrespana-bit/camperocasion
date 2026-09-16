-- ============================================================
-- busquedas_guardadas: búsquedas guardadas + alertas de nuevos
-- anuncios ("avísame cuando aparezca").
--
-- Es el mecanismo #1 de retención de compradores: quien no
-- encuentra su artículo hoy deja un "sensor" y vuelve cuando
-- aparece. `ultima_revision` permite al cron procesar cada
-- búsqueda solo desde su última novedad.
-- ============================================================

create table if not exists busquedas_guardadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  q text,
  categoria text,
  subcategoria text,
  marca text,
  condicion text,
  ubicacion_estado text,
  ubicacion_ciudad text,
  precio_min numeric,
  precio_max numeric,
  creada_en timestamptz not null default now(),
  ultima_revision timestamptz not null default now(),
  constraint busquedas_guardadas_tiene_filtro check (
    q is not null or categoria is not null or subcategoria is not null
    or marca is not null or ubicacion_estado is not null or ubicacion_ciudad is not null
  )
);

create index if not exists idx_busquedas_guardadas_user
  on busquedas_guardadas (user_id);

alter table busquedas_guardadas enable row level security;

drop policy if exists "Ver búsquedas propias" on busquedas_guardadas;
create policy "Ver búsquedas propias" on busquedas_guardadas
  for select using (auth.uid() = user_id);

drop policy if exists "Crear búsquedas propias" on busquedas_guardadas;
create policy "Crear búsquedas propias" on busquedas_guardadas
  for insert with check (auth.uid() = user_id);

drop policy if exists "Eliminar búsquedas propias" on busquedas_guardadas;
create policy "Eliminar búsquedas propias" on busquedas_guardadas
  for delete using (auth.uid() = user_id);
