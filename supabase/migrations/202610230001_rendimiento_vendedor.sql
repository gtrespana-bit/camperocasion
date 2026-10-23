-- ============================================================================
-- Rendimiento del vendedor (fase 4: «Diferenciación real de packs»)
--
-- Hasta ahora el panel enseñaba las visitas ACUMULADAS de cada anuncio
-- (`productos.visitas`) y nada más. Eso no responde a la pregunta que se hace
-- un profesional: «¿esto funciona este mes?».
--
-- Esta migración añade `rendimiento_vendedor()`, que devuelve en una sola
-- llamada:
--   · visitas, favoritos y contactos DEL PERIODO, por anuncio;
--   · la serie diaria de visitas (para dibujar la evolución);
--   · el tiempo mediano que tarda en venderse un anuncio del vendedor;
--   · la comparativa de mercado de sus categorías (anuncios activos, precio
--     mediano y días medianos de venta de los demás vendedores).
--
-- Por qué una función y no cinco consultas desde Next:
--   1. `visitas_pagina` puede tener decenas de miles de filas por vendedor y
--      traérselas al servidor para contarlas en JavaScript no escala.
--   2. Los percentiles (`percentile_cont`) se calculan en la base, que es
--      donde están los datos y donde se pueden aprovechar los índices.
--   3. El navegador nunca toca esto: se ejecuta con `service_role` y RLS no
--      aplica a `security definer`. Los datos son solo los del propio usuario
--      (el id viene de la sesión verificada, nunca del navegador).
--
-- Nota sobre `vendido_en` vs `vendido_fecha`:
--   `vendido_en` es el LUGAR de la venta ('plataforma', 'otra_pagina'…), es
--   texto. La fecha real es `vendido_fecha` (migración 20260829000101). Aquí
--   se usa `vendido_fecha`, que es la única que permite medir días hasta la
--   venta.
-- ============================================================================

-- ── Índices que hacen viable el cálculo por periodo ────────────────────────
-- Sin ellos, cada apertura del panel recorre `favoritos` y `mensajes` enteros.

create index if not exists favoritos_producto_idx
  on public.favoritos (producto_id, creado_en desc);

create index if not exists mensajes_destinatario_idx
  on public.mensajes (destinatario_id, creado_en desc);

create index if not exists productos_categoria_vendido_idx
  on public.productos (categoria_id, vendido_fecha desc)
  where vendido_fecha is not null;

-- ── Función principal ──────────────────────────────────────────────────────

create or replace function public.rendimiento_vendedor(
  p_user_id uuid,
  p_dias integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dias integer;
  v_desde timestamptz;
begin
  -- Ventana acotada: 7/30/90 son las que usa la UI, pero se acepta cualquier
  -- valor entre 1 y 365 para no romper si alguien llama a mano.
  v_dias := greatest(1, least(coalesce(p_dias, 30), 365));
  v_desde := now() - make_interval(days => v_dias);

  return (
    with mis as (
      select
        p.id,
        p.categoria_id,
        coalesce(p.activo, false) as activo,
        coalesce(p.vendido, false) as vendido,
        p.creado_en,
        p.vendido_fecha,
        coalesce(p.precio, p.precio_usd) as precio
      from public.productos p
      where p.user_id = p_user_id
    ),
    visitas as (
      select v.producto_id as producto_id, count(*)::int as visitas
      from public.visitas_pagina v
      join mis m on m.id = v.producto_id
      where v.creado_en >= v_desde
      group by 1
    ),
    favoritos as (
      select f.producto_id as producto_id, count(*)::int as favoritos
      from public.favoritos f
      join mis m on m.id = f.producto_id
      where f.creado_en >= v_desde
      group by 1
    ),
    contactos as (
      -- Un contacto = un comprador distinto que ha escrito por ese anuncio.
      -- Si el mismo comprador manda cinco mensajes, cuenta uno: lo que
      -- interesa es cuánta gente preguntó, no cuánto insistió.
      select
        ms.producto_id as producto_id,
        count(distinct ms.remitente_id)::int as contactos
      from public.mensajes ms
      join mis m on m.id = ms.producto_id
      where ms.destinatario_id = p_user_id
        and ms.creado_en >= v_desde
      group by 1
    ),
    por_anuncio as (
      select
        m.id as "productoId",
        coalesce(v.visitas, 0) as visitas,
        coalesce(f.favoritos, 0) as favoritos,
        coalesce(c.contactos, 0) as contactos
      from mis m
      left join visitas v on v.producto_id = m.id
      left join favoritos f on f.producto_id = m.id
      left join contactos c on c.producto_id = m.id
    ),
    serie as (
      select
        to_char(v.creado_en at time zone 'Europe/Madrid', 'YYYY-MM-DD') as dia,
        count(*)::int as visitas
      from public.visitas_pagina v
      join mis m on m.id = v.producto_id
      where v.creado_en >= v_desde
      group by 1
    ),
    categorias as (
      select distinct categoria_id
      from mis
      where categoria_id is not null
    ),
    mercado as (
      -- Solo anuncios de OTROS vendedores: compararse consigo mismo no dice
      -- nada. Los precios a 0 (anuncios «a consultar») se excluyen de la
      -- mediana para no hundirla.
      select
        c.categoria_id as "categoriaId",
        (count(*) filter (where p.activo and not p.vendido))::int as activos,
        percentile_cont(0.5) within group (order by p.precio)
          filter (where p.precio is not null and p.precio > 0) as "precioMediana",
        (count(*) filter (
          where p.vendido and p.vendido_fecha >= now() - interval '365 days'
        ))::int as vendidos,
        percentile_cont(0.5) within group (
          order by extract(epoch from (p.vendido_fecha - p.creado_en)) / 86400.0
        ) filter (
          where p.vendido
            and p.vendido_fecha is not null
            and p.vendido_fecha > p.creado_en
        ) as "diasMediana"
      from categorias c
      join public.productos p
        on p.categoria_id = c.categoria_id
       and p.user_id <> p_user_id
      group by 1
    ),
    mis_ventas as (
      select
        count(*)::int as vendidos,
        percentile_cont(0.5) within group (
          order by extract(epoch from (vendido_fecha - creado_en)) / 86400.0
        ) filter (where vendido_fecha > creado_en) as "diasMediana"
      from mis
      where vendido
        and vendido_fecha is not null
        and vendido_fecha >= now() - interval '365 days'
    )
    select jsonb_build_object(
      'dias', v_dias,
      'resumen', jsonb_build_object(
        'visitas', coalesce((select sum(visitas) from por_anuncio), 0),
        'favoritos', coalesce((select sum(favoritos) from por_anuncio), 0),
        'contactos', coalesce((select sum(contactos) from por_anuncio), 0),
        'activos', (select count(*) from mis where activo and not vendido),
        'publicados', (select count(*) from mis where creado_en >= v_desde),
        'vendidos', (select coalesce(sum(vendidos), 0) from mis_ventas)
      ),
      'serie', coalesce(
        (select jsonb_agg(to_jsonb(s) order by s.dia) from serie s),
        '[]'::jsonb
      ),
      'anuncios', coalesce(
        (select jsonb_agg(to_jsonb(a)) from por_anuncio a),
        '[]'::jsonb
      ),
      'ventas', (select to_jsonb(mv) from mis_ventas mv),
      'mercado', coalesce(
        (select jsonb_agg(to_jsonb(mc) order by mc."categoriaId") from mercado mc),
        '[]'::jsonb
      )
    )
  );
end $$;

comment on function public.rendimiento_vendedor(uuid, integer) is
  'Métricas por periodo del vendedor: visitas, favoritos y contactos por anuncio, serie diaria, días hasta la venta y comparativa con su categoría. Solo service_role.';

-- ── Permisos: solo el servidor ─────────────────────────────────────────────
-- El id del vendedor llega desde la sesión verificada en la ruta de Next. Si
-- `anon` o `authenticated` pudieran ejecutarla, cualquiera leería las métricas
-- de cualquier taller pasando un uuid ajeno.

revoke all on function public.rendimiento_vendedor(uuid, integer)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.rendimiento_vendedor(uuid, integer) to service_role';
  end if;
end $$;
