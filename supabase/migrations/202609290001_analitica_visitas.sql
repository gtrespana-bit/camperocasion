-- Audiencia propia (visitas) + regalos de plan desde el panel admin.
--
-- 1) `visitas_pagina` — una fila por página vista. Sin IP, sin user-agent
--    completo y sin datos personales: el visitante es un id aleatorio que el
--    navegador genera (`crypto.randomUUID()`) y guarda en localStorage. Solo se
--    escribe cuando el usuario ha pulsado «Aceptar» en el aviso de cookies
--    (ver src/components/AnaliticaVisitas.tsx y docs/PANEL-ADMIN.md).
-- 2) `planes_regalos` — bitácora de los packs regalados a mano por el admin:
--    quién, qué pack, cuántos días, desde cuándo y por qué. Es el justificante
--    de «regalar tiempo gratis»; no se toca nunca desde el panel.
-- 3) `analitica_visitas(...)` — agregados en Postgres. El panel pide series de
--    hasta un año; traerse las filas al servidor de Next para contarlas en
--    JavaScript no escala, así que Día/Semana/Mes se agrupan aquí.
-- 4) `limpiar_visitas_antiguas(...)` — retención (por defecto 400 días), la
--    llama el cron diario `clean-rate-limits`.

-- ── 1. Visitas ────────────────────────────────────────────────────────────
create table if not exists public.visitas_pagina (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  -- `dia` en hora peninsular: el panel agrupa por días españoles, no UTC.
  dia date not null default ((now() at time zone 'Europe/Madrid')::date),
  visitante_id text not null,
  sesion_id text,
  user_id uuid references public.perfiles(id) on delete set null,
  ruta text not null,
  -- home | catalogo | producto | buscar | categoria | provincia | tienda |
  -- publicar | blog | otro
  tipo text not null default 'otro',
  slug text,
  producto_id uuid references public.productos(id) on delete set null,
  -- Solo el host de la web de origen (www.google.com, instagram.com…) o
  -- 'directo' si no hay referrer. Nunca la URL completa.
  referrer_host text,
  -- movil | tablet | escritorio
  dispositivo text,
  -- es | en
  idioma text,
  -- Segundos que el visitante estuvo en esa página. Se rellena con la señal
  -- de la página siguiente (o al cerrar la pestaña) porque al entrar aún no
  -- se sabe: por eso puede quedar a null.
  duracion_segundos integer,
  constraint visitas_pagina_duracion_check
    check (duracion_segundos is null or (duracion_segundos >= 0 and duracion_segundos <= 86400))
);

comment on table public.visitas_pagina is
  'Analítica propia: una fila por página vista por visitantes anónimos que han aceptado la medición.';

create index if not exists visitas_pagina_dia_idx
  on public.visitas_pagina (dia desc);
create index if not exists visitas_pagina_creado_idx
  on public.visitas_pagina (creado_en desc);
create index if not exists visitas_pagina_visitante_idx
  on public.visitas_pagina (visitante_id, creado_en desc);
create index if not exists visitas_pagina_sesion_idx
  on public.visitas_pagina (sesion_id);
create index if not exists visitas_pagina_producto_idx
  on public.visitas_pagina (producto_id, creado_en desc)
  where producto_id is not null;
create index if not exists visitas_pagina_tipo_idx
  on public.visitas_pagina (tipo, creado_en desc);

alter table public.visitas_pagina enable row level security;
-- Sin políticas: solo service_role (las API del servidor) lee y escribe.

-- ── 2. Regalos de plan (bitácora del admin) ───────────────────────────────
create table if not exists public.planes_regalos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  plan text not null,
  dias integer not null,
  -- extender = suma los días al final del periodo vigente;
  -- reemplazar = empieza a contar desde ahora.
  modo text not null default 'extender',
  motivo text,
  plan_hasta_resultante timestamptz,
  admin_email text,
  creado_en timestamptz not null default now(),
  constraint planes_regalos_plan_check
    check (plan in ('starter', 'plus', 'unlimited', 'gratis')),
  constraint planes_regalos_modo_check
    check (modo in ('extender', 'reemplazar')),
  constraint planes_regalos_dias_check
    check (dias >= 0 and dias <= 3650)
);

comment on table public.planes_regalos is
  'Bitácora de packs regalados a mano desde /admin (quién, qué plan, cuántos días y por qué).';

create index if not exists planes_regalos_user_idx
  on public.planes_regalos (user_id, creado_en desc);
create index if not exists planes_regalos_creado_idx
  on public.planes_regalos (creado_en desc);

alter table public.planes_regalos enable row level security;
-- Sin políticas: solo service_role.

-- ── 3. Agregados de visitas ───────────────────────────────────────────────
create or replace function public.analitica_visitas(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_granularidad text default 'dia'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_gran text;
begin
  v_gran := case
    when p_granularidad in ('dia', 'semana', 'mes') then p_granularidad
    else 'dia'
  end;

  return (
    with base as (
      select
        v.visitante_id,
        v.sesion_id,
        v.duracion_segundos,
        v.dispositivo,
        v.idioma,
        v.referrer_host,
        v.ruta,
        v.tipo,
        v.producto_id,
        (v.creado_en at time zone 'Europe/Madrid') as local,
        case v_gran
          when 'mes' then to_char(v.creado_en at time zone 'Europe/Madrid', 'YYYY-MM')
          when 'semana' then to_char(
            date_trunc('week', v.creado_en at time zone 'Europe/Madrid')::date,
            'YYYY-MM-DD'
          )
          else to_char(v.creado_en at time zone 'Europe/Madrid', 'YYYY-MM-DD')
        end as clave
      from public.visitas_pagina v
      where v.creado_en >= p_desde and v.creado_en < p_hasta
    )
    select jsonb_build_object(
      'visitas', (select count(*) from base),
      'visitantes', (select count(distinct visitante_id) from base),
      'sesiones', (select count(distinct sesion_id) from base where sesion_id is not null),
      'nuevos', (
        select count(distinct b.visitante_id)
        from base b
        where not exists (
          select 1 from public.visitas_pagina prev
          where prev.visitante_id = b.visitante_id
            and prev.creado_en < p_desde
        )
      ),
      'duracionTotal', (select coalesce(sum(duracion_segundos), 0) from base),
      'duracionMuestras', (select count(*) from base where duracion_segundos is not null),
      'serie', (
        select coalesce(jsonb_agg(to_jsonb(s) order by s.clave), '[]'::jsonb)
        from (
          select
            clave,
            count(*)::int as visitas,
            count(distinct visitante_id)::int as visitantes,
            count(distinct sesion_id)::int as sesiones
          from base
          group by clave
        ) s
      ),
      'dispositivos', (
        select coalesce(jsonb_agg(to_jsonb(d) order by d.visitas desc), '[]'::jsonb)
        from (
          select
            coalesce(dispositivo, 'desconocido') as clave,
            count(*)::int as visitas,
            count(distinct visitante_id)::int as visitantes
          from base
          group by 1
        ) d
      ),
      'idiomas', (
        select coalesce(jsonb_agg(to_jsonb(i) order by i.visitas desc), '[]'::jsonb)
        from (
          select
            coalesce(idioma, 'es') as clave,
            count(*)::int as visitas,
            count(distinct visitante_id)::int as visitantes
          from base
          group by 1
        ) i
      ),
      'fuentes', (
        select coalesce(jsonb_agg(to_jsonb(f) order by f.visitas desc), '[]'::jsonb)
        from (
          select
            coalesce(referrer_host, 'directo') as clave,
            count(*)::int as visitas,
            count(distinct visitante_id)::int as visitantes
          from base
          group by 1
          order by count(*) desc
          limit 25
        ) f
      ),
      'topPaginas', (
        select coalesce(jsonb_agg(to_jsonb(p) order by p.visitas desc), '[]'::jsonb)
        from (
          select
            ruta as clave,
            max(tipo) as tipo,
            count(*)::int as visitas,
            count(distinct visitante_id)::int as visitantes
          from base
          group by ruta
          order by count(*) desc
          limit 20
        ) p
      ),
      'horas', (
        select coalesce(jsonb_agg(to_jsonb(h) order by h.hora), '[]'::jsonb)
        from (
          select extract(hour from local)::int as hora, count(*)::int as visitas
          from base
          group by 1
        ) h
      ),
      'diasSemana', (
        select coalesce(jsonb_agg(to_jsonb(w) order by w.dow), '[]'::jsonb)
        from (
          select extract(isodow from local)::int as dow, count(*)::int as visitas
          from base
          group by 1
        ) w
      ),
      'topProductos', (
        select coalesce(jsonb_agg(to_jsonb(tp) order by tp.visitas desc), '[]'::jsonb)
        from (
          select
            b.producto_id as "productoId",
            p.titulo,
            p.slug,
            p.precio_usd,
            p.imagen_url,
            p.activo,
            count(*)::int as visitas,
            count(distinct b.visitante_id)::int as visitantes
          from base b
          join public.productos p on p.id = b.producto_id
          where b.producto_id is not null
          group by 1, 2, 3, 4, 5, 6
          order by count(*) desc
          limit 20
        ) tp
      ),
      'productosSinVisitas', (
        select coalesce(jsonb_agg(to_jsonb(sv) order by sv."creadoEn" asc), '[]'::jsonb)
        from (
          select p.id, p.titulo, p.slug, p.creado_en as "creadoEn"
          from public.productos p
          where coalesce(p.activo, false) = true
            and coalesce(p.vendido, false) = false
            and not exists (
              select 1 from public.visitas_pagina v
              where v.producto_id = p.id
                and v.creado_en >= p_desde
                and v.creado_en < p_hasta
            )
          order by p.creado_en asc
          limit 20
        ) sv
      )
    )
  );
end $$;

comment on function public.analitica_visitas(timestamptz, timestamptz, text) is
  'Agregados de visitas (totales, serie por día/semana/mes, dispositivos, fuentes, top páginas y anuncios) para el panel admin.';

-- ── 4. Retención ──────────────────────────────────────────────────────────
create or replace function public.limpiar_visitas_antiguas(p_dias integer default 400)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas integer;
begin
  delete from public.visitas_pagina
  where creado_en < now() - make_interval(days => greatest(coalesce(p_dias, 400), 30));
  get diagnostics v_borradas = row_count;
  return v_borradas;
end $$;

comment on function public.limpiar_visitas_antiguas(integer) is
  'Borra las visitas más antiguas que N días (por defecto 400). La llama el cron diario.';

-- Solo el service_role (las API) puede llamar a estas funciones: ni anon ni
-- authenticated deben poder leer la audiencia del sitio desde el navegador.
revoke all on function public.analitica_visitas(timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.limpiar_visitas_antiguas(integer)
  from public, anon, authenticated;
