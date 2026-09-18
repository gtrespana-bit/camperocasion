-- ═══════════════════════════════════════════════════════════════════════════
-- 202609180001 — Tipo de vendedor: particulares, camperizadores y profesionales
--
-- Fase 2 del posicionamiento "abierto a todos": cada perfil declara QUÉ tipo
-- de vendedor es y ese dato se muestra en las tarjetas y fichas de anuncio,
-- para que el comprador sepa de un vistazo quién le vende.
--
--   · perfiles.tipo_vendedor   → fuente de verdad (lo elige el usuario).
--   · productos.vendedor_tipo  → copia denormalizada para pintar el chip en
--     las cards SIN joins (mismo patrón que `vendedor_verificado`, migración
--     010), con triggers que la mantienen sincronizada en ambas direcciones.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columna en perfiles (fuente de verdad) ──────────────────────────────
alter table public.perfiles
  add column if not exists tipo_vendedor text not null default 'particular';

do $$
begin
  alter table public.perfiles
    add constraint perfiles_tipo_vendedor_check
    check (tipo_vendedor in ('particular', 'camperizador', 'profesional'));
exception
  when duplicate_object then null;
end $$;

-- ── 2. Columna denormalizada en productos (para cards sin joins) ───────────
alter table public.productos
  add column if not exists vendedor_tipo text not null default 'particular';

do $$
begin
  alter table public.productos
    add constraint productos_vendedor_tipo_check
    check (vendedor_tipo in ('particular', 'camperizador', 'profesional'));
exception
  when duplicate_object then null;
end $$;

-- ── 3. Sincronizar anuncios existentes ─────────────────────────────────────
update public.productos p
set vendedor_tipo = coalesce(pr.tipo_vendedor, 'particular')
from public.perfiles pr
where p.user_id = pr.id
  and p.vendedor_tipo is distinct from coalesce(pr.tipo_vendedor, 'particular');

-- ── 4. Triggers de sincronización ──────────────────────────────────────────
-- 4a. Si el usuario cambia su tipo en el perfil, sus anuncios lo heredan.
create or replace function public.fn_propagar_tipo_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_vendedor is distinct from old.tipo_vendedor then
    update public.productos
    set vendedor_tipo = new.tipo_vendedor
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propagar_tipo_vendedor on public.perfiles;
create trigger trg_propagar_tipo_vendedor
  after update of tipo_vendedor on public.perfiles
  for each row
  execute function public.fn_propagar_tipo_vendedor();

-- 4b. Un anuncio nuevo hereda el tipo del perfil de su vendedor.
create or replace function public.fn_producto_hereda_tipo_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.vendedor_tipo := coalesce(
    (select tipo_vendedor from public.perfiles where id = new.user_id),
    'particular'
  );
  return new;
end;
$$;

drop trigger if exists trg_producto_hereda_tipo_vendedor on public.productos;
create trigger trg_producto_hereda_tipo_vendedor
  before insert on public.productos
  for each row
  execute function public.fn_producto_hereda_tipo_vendedor();

-- ── 5. RPC del detalle: el objeto `vendedor` incluye el tipo ───────────────
-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE; se
-- elimina la sobrecarga exacta antes de recrearla (mismo patrón que el
-- hardening 202608010001).
drop function if exists public.obtener_detalle_producto(uuid, uuid) cascade;
create or replace function public.obtener_detalle_producto(
  p_producto_id uuid,
  p_user_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_user_id uuid;
  v_vendedor json;
  v_vendidas integer;
  v_activas integer;
  v_resenas_data json;
  v_resenas_count integer;
  v_es_favorito boolean := false;
  v_historial json;
  v_effective_user uuid;
begin
  select user_id into v_producto_user_id
  from public.productos
  where id = p_producto_id
    and activo = true
    and (estado_moderacion is null or estado_moderacion in ('aprobado', 'pendiente'));

  if v_producto_user_id is null then
    return null;
  end if;

  v_effective_user := auth.uid();
  if p_user_id is not null and p_user_id = v_effective_user then
    v_effective_user := p_user_id;
  end if;

  select json_build_object(
    'id', id,
    'nombre', nombre,
    'telefono', case when coalesce(telefono_visible, false) then telefono else null end,
    'ciudad', ciudad,
    'estado', estado,
    'whatsapp_disponible', whatsapp_disponible,
    'telefono_visible', coalesce(telefono_visible, false),
    'email_visible', coalesce(email_visible, false),
    'foto_perfil_url', foto_perfil_url,
    'verificado', verificado,
    'verificado_desde', verificado_desde,
    'tipo_vendedor', coalesce(tipo_vendedor, 'particular'),
    'nivel_confianza', nivel_confianza,
    'badges_automaticos', badges_automaticos,
    'ultima_actividad', ultima_actividad,
    'creado_en', creado_en
  ) into v_vendedor
  from public.perfiles
  where id = v_producto_user_id;

  select count(*) into v_vendidas
  from public.productos
  where user_id = v_producto_user_id
    and activo = false
    and vendido = true
    and (estado_moderacion is null or estado_moderacion <> 'rechazado');

  select count(*) into v_activas
  from public.productos
  where user_id = v_producto_user_id and activo = true;

  select coalesce(json_agg(json_build_object('puntuacion', puntuacion)), '[]'::json), count(*)
    into v_resenas_data, v_resenas_count
  from public.resenas
  where vendedor_id = v_producto_user_id;

  if v_effective_user is not null then
    select exists(
      select 1 from public.favoritos
      where user_id = v_effective_user and producto_id = p_producto_id
    ) into v_es_favorito;
  end if;

  select coalesce(json_agg(row_data order by row_data->>'creado_en' desc), '[]'::json)
    into v_historial
  from (
    select json_build_object(
      'id', id,
      'precio_anterior', precio_anterior,
      'precio_nuevo', precio_nuevo,
      'creado_en', creado_en
    ) as row_data
    from public.historial_precios
    where producto_id = p_producto_id
    order by creado_en desc
    limit 10
  ) history;

  return json_build_object(
    'vendedor', v_vendedor,
    'stats', json_build_object(
      'vendidas', v_vendidas,
      'activas', v_activas,
      'resenasCount', v_resenas_count,
      'resenasAvg', coalesce((select avg(puntuacion) from public.resenas where vendedor_id = v_producto_user_id), 0)
    ),
    'totalResenas', v_resenas_count,
    'esFavorito', v_es_favorito,
    'historial', v_historial
  );
end;
$$;

grant execute on function public.obtener_detalle_producto(uuid, uuid) to anon, authenticated;
