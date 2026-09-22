-- ═══════════════════════════════════════════════════════════════════════════
-- 202609220002 — Tienda para camperizadores y profesionales (2026-09-22)
--
-- Por qué: los vendedores profesionales son los únicos que repiten (5-15
-- vehículos al año). Hoy su perfil es una página más, con una URL de UUID que
-- nadie puede pegar en su web ni en Instagram. Darles un escaparate propio
-- con dirección legible es lo que convierte a un camperizador en un proveedor
-- recurrente de inventario.
--
-- Qué añade:
--   · `perfiles.slug`         → /tienda/furgocamper-valencia (único, estable)
--   · campos de escaparate    → descripción, web, portada, horario, dirección
--   · `perfiles.tienda_activa`→ solo se publica cuando el vendedor lo decide
--   · generación automática de slug a partir del nombre, sin colisiones
--
-- Idempotente: se puede ejecutar varias veces.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas del escaparate ─────────────────────────────────────────────

alter table public.perfiles
  add column if not exists slug text,
  add column if not exists tienda_activa boolean not null default false,
  add column if not exists descripcion text,
  add column if not exists web text,
  add column if not exists portada_url text,
  add column if not exists horario text,
  add column if not exists direccion text;

comment on column public.perfiles.slug is
  'Identificador legible para /tienda/[slug]. Único entre todos los perfiles.';
comment on column public.perfiles.tienda_activa is
  'El escaparate público solo existe si el vendedor lo activa. Por defecto, no.';
comment on column public.perfiles.descripcion is
  'Texto de presentación del taller o concesionario (máx. 1500 caracteres en la app).';

-- El slug tiene que ser único: es la URL pública. Índice parcial porque la
-- inmensa mayoría de perfiles (particulares) no tendrán slug.
create unique index if not exists perfiles_slug_key
  on public.perfiles (slug)
  where slug is not null;

-- Listado de tiendas: solo las activas, ordenadas por nombre.
create index if not exists perfiles_tienda_activa_idx
  on public.perfiles (tipo_vendedor, nombre)
  where tienda_activa = true;

-- ── 2. Generación de slug ──────────────────────────────────────────────────

-- Normaliza un texto a slug: sin acentos, minúsculas, guiones.
create or replace function public.fn_slugify(p_texto text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(translate(
          coalesce(p_texto, ''),
          'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
          'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
        )),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- Devuelve un slug libre a partir de un texto, añadiendo sufijo si hace falta.
-- Sin esto, dos "Camper Center" se pisarían y el segundo no podría abrir tienda.
create or replace function public.fn_slug_disponible(p_texto text, p_perfil uuid)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_i integer := 1;
begin
  v_base := public.fn_slugify(p_texto);

  -- Un slug vacío o numérico daría URLs absurdas o chocaría con rutas futuras.
  if v_base is null or length(v_base) < 3 then
    v_base := 'tienda';
  end if;
  v_base := left(v_base, 60);

  v_slug := v_base;
  while exists (
    select 1 from public.perfiles
    where slug = v_slug and (p_perfil is null or id <> p_perfil)
  ) loop
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  end loop;

  return v_slug;
end;
$$;

grant execute on function public.fn_slugify(text) to anon, authenticated;
grant execute on function public.fn_slug_disponible(text, uuid) to authenticated;

-- ── 3. Asignar slug automáticamente al activar la tienda ───────────────────

create or replace function public.fn_asignar_slug_tienda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo generamos slug cuando hace falta: al activar la tienda y no tenerlo.
  -- No se regenera al cambiar el nombre, a propósito: una URL publicada que
  -- cambia sola rompe los enlaces que el vendedor ya repartió.
  if new.tienda_activa and (new.slug is null or length(trim(new.slug)) = 0) then
    new.slug := public.fn_slug_disponible(coalesce(new.nombre, 'tienda'), new.id);
  end if;

  if new.slug is not null then
    new.slug := public.fn_slugify(new.slug);
    if length(new.slug) < 3 then
      new.slug := public.fn_slug_disponible(coalesce(new.nombre, 'tienda'), new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_asignar_slug_tienda on public.perfiles;
create trigger trg_asignar_slug_tienda
  before insert or update of tienda_activa, slug, nombre on public.perfiles
  for each row execute function public.fn_asignar_slug_tienda();

-- ── 4. Solo profesionales y camperizadores pueden tener tienda ─────────────
-- Un particular con escaparate confundiría al comprador sobre con quién trata
-- (y es justo la distinción que vende este marketplace).

create or replace function public.fn_validar_tienda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tienda_activa and coalesce(new.tipo_vendedor, 'particular') = 'particular' then
    raise exception 'Solo los camperizadores y profesionales pueden abrir tienda';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_tienda on public.perfiles;
create trigger trg_validar_tienda
  before insert or update of tienda_activa, tipo_vendedor on public.perfiles
  for each row execute function public.fn_validar_tienda();

-- Si un profesional se pasa a particular, su tienda se cierra sola en vez de
-- dejar el trigger anterior bloqueando cualquier edición de su perfil.
create or replace function public.fn_cerrar_tienda_si_particular()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.tipo_vendedor, 'particular') = 'particular' then
    new.tienda_activa := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cerrar_tienda_si_particular on public.perfiles;
create trigger trg_cerrar_tienda_si_particular
  before update of tipo_vendedor on public.perfiles
  for each row
  when (coalesce(new.tipo_vendedor, 'particular') = 'particular'
        and coalesce(old.tipo_vendedor, 'particular') <> 'particular')
  execute function public.fn_cerrar_tienda_si_particular();

-- ── 5. Backfill: slug para los profesionales que ya existen ────────────────
-- No activa ninguna tienda; solo reserva la URL para que al activarla sea la
-- esperada y no una con sufijo numérico por haber llegado tarde.

do $$
declare
  r record;
begin
  for r in
    select id, nombre from public.perfiles
    where slug is null
      and coalesce(tipo_vendedor, 'particular') in ('camperizador', 'profesional')
    order by creado_en nulls last
  loop
    update public.perfiles
    set slug = public.fn_slug_disponible(coalesce(r.nombre, 'tienda'), r.id)
    where id = r.id;
  end loop;
end $$;
