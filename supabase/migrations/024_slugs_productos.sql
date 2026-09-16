-- ============================================
-- MIGRACIÓN: Slugs SEO para productos
-- URLs /producto/iphone-13-pro-caracas-550e8400 en vez de UUIDs
-- Ejecutar en el Supabase SQL Editor
-- ============================================

-- 1. Función slugify sin dependencia de la extensión unaccent.
--    minúsculas, sin acentos, separadores '-', solo [a-z0-9].
--    Devuelve NULL si el resultado queda vacío (todo símbolos).
create or replace function public.slugify(input text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      translate(lower($1),
        'áàäâãéèëêíìïîóòöôõúùüûñç',
        'aaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', '-', 'g')),
    '')
$$;

-- 2. Nueva columna
alter table public.productos
  add column if not exists slug text;

-- 3. Generador: título slugificado (máx. 60 chars) + 8 hex del UUID.
--    El sufijo del UUID garantiza unicidad sin consultas extra.
create or replace function public.generar_slug_producto(p_titulo text, p_id uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select concat(
    left(coalesce(public.slugify(nullif(btrim(coalesce(p_titulo, '')), '')), 'producto'), 60),
    '-',
    substr(replace(p_id::text, '-', ''), 1, 8)
  )
$$;

-- 4. Backfill de productos existentes
update public.productos
set slug = public.generar_slug_producto(titulo, id)
where slug is null or btrim(slug) = '';

-- 5. Restricciones (not null + único)
alter table public.productos alter column slug set not null;

create unique index if not exists productos_slug_key on public.productos (slug);

-- 6. Trigger: genera el slug en inserts futuros.
--    Solo si viene vacío — si el cliente envía slug explícito se respeta.
--    NEW.id ya existe aquí porque el default gen_random_uuid() se evalúa
--    antes de los triggers BEFORE INSERT.
create or replace function public.productos_set_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.generar_slug_producto(new.titulo, new.id);
  end if;
  return new;
end
$$;

drop trigger if exists trg_productos_slug on public.productos;

create trigger trg_productos_slug
  before insert on public.productos
  for each row execute function public.productos_set_slug();

comment on column public.productos.slug is
  'Slug SEO único generado desde el título + sufijo del UUID. No cambiar tras la creación (afectaría URLs indexadas).';

-- 7. Actualizar RPCs que la app usa para listar productos, incluyendo slug.
--    (create or replace con cambio de returns table requiere drop previo)
drop function if exists public.obtener_destacados_home(integer);

create or replace function public.obtener_destacados_home(
  p_limite integer default 8
)
returns table (
  id uuid,
  slug text,
  user_id uuid,
  titulo text,
  descripcion text,
  categoria_id integer,
  subcategoria text,
  marca text,
  modelo text,
  estado text,
  precio_usd decimal,
  ubicacion_estado text,
  ubicacion_ciudad text,
  imagen_url text,
  imagenes text[],
  activo boolean,
  destacado boolean,
  destacado_hasta timestamp with time zone,
  visitas integer,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  boosteado_en timestamp with time zone
)
language plpgsql
stable
set search_path = public
as $$
begin
  return query
  select
    p.id, p.slug, p.user_id, p.titulo, p.descripcion, p.categoria_id,
    p.subcategoria, p.marca, p.modelo, p.estado, p.precio_usd,
    p.ubicacion_estado, p.ubicacion_ciudad, p.imagen_url,
    p.imagenes, p.activo, p.destacado, p.destacado_hasta,
    p.visitas, p.creado_en, p.actualizado_en, p.boosteado_en
  from productos p
  where p.activo = true
    and p.destacado = true
    and p.destacado_hasta > now()
  order by p.destacado_hasta desc
  limit p_limite;
end;
$$;

grant execute on function public.obtener_destacados_home(integer) to anon, authenticated;
