-- ============================================================================
-- CamperOcasión — Cierre de permisos de `aplicar_cupo_planes()` (2026-10-27)
--
-- Por qué (auditoría externa, punto 1):
--   La migración 202610220001 hacía `revoke all ... from public` y concedía
--   EXECUTE a service_role. Eso basta en un Postgres pelado, pero Supabase
--   mantiene `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon,
--   authenticated, service_role` en el esquema public: esos grants EXPLÍCITOS
--   sobreviven al revoke de PUBLIC. Resultado: cualquier usuario autenticado
--   podía llamar a la RPC desde el navegador con un `p_ahora` elegido por él
--   y pausar anuncios de terceros (la función es SECURITY DEFINER).
--
-- Qué hace (idempotente, seguro de re-ejecutar en producción):
--   1. Recrea la función con una comprobación de rol JWT dentro del cuerpo
--      (defensa en profundidad: aunque alguien vuelva a dar un grant, la
--      llamada que llegue por PostgREST con JWT de anon/authenticated falla).
--   2. Revoca de PUBLIC, anon y authenticated y concede solo a service_role.
--
-- El cron `/api/cron/planes` llama con la service key (= rol service_role), y
-- el SQL directo de mantenimiento no lleva JWT, así que ambos siguen válidos.
-- Tras aplicarla, compruébalo con `scripts/verify_cupo_planes_sql.py` o con:
--   select has_function_privilege('authenticated',
--            'public.aplicar_cupo_planes(timestamptz)', 'EXECUTE'); -- debe dar false
-- ============================================================================

create or replace function public.aplicar_cupo_planes(p_ahora timestamptz default now())
returns table (vendedor_id uuid, producto_id uuid, titulo text, cupo integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text;
begin
  -- ── Solo service_role (o SQL directo sin JWT) ────────────────────────────
  -- PostgREST publica `request.jwt.claim.role` (y, en versiones nuevas,
  -- `request.jwt.claims` con la misma información). Un JWT de navegador trae
  -- 'anon' o 'authenticated'. No usamos current_user porque dentro de una
  -- función SECURITY DEFINER es el propietario, no el invocador.
  begin
    v_jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
    if v_jwt_role is null then
      v_jwt_role := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
    end if;
  exception when others then
    v_jwt_role := null; -- GUC ausente o JSON inválido (SQL directo)
  end;

  if v_jwt_role is not null and v_jwt_role <> 'service_role' then
    raise exception 'aplicar_cupo_planes: solo service_role puede ejecutar esta función'
      using errcode = '42501';
  end if;

  if p_ahora is null then
    p_ahora := now();
  end if;

  return query
  with efectivo as (
    select
      p.id,
      case
        when p.tipo_vendedor not in ('camperizador', 'profesional') then 'gratis'
        when p.plan_anuncios in ('starter', 'plus', 'unlimited')
             and (p.plan_hasta is null or p.plan_hasta >= p_ahora) then p.plan_anuncios
        when p.trial_hasta is not null
             and p.tipo_vendedor in ('camperizador', 'profesional')
             and p_ahora <= p.trial_hasta + interval '7 days'
             then coalesce(p.trial_plan, 'plus')
        else 'gratis'
      end as plan
    from public.perfiles p
  ),
  cupos as (
    select
      e.id,
      case e.plan
        when 'starter' then 5
        when 'plus' then 15
        when 'unlimited' then null
        else 1
      end as cupo
    from efectivo e
  ),
  orden as (
    select
      pr.id,
      pr.user_id,
      pr.titulo,
      c.cupo,
      row_number() over (
        partition by pr.user_id
        order by
          (pr.destacado is true and (pr.destacado_hasta is null or pr.destacado_hasta > p_ahora)) desc,
          pr.visitas asc nulls first,
          pr.creado_en desc
      ) as rn
    from public.productos pr
    join cupos c on c.id = pr.user_id
    -- Solo anuncios ACTIVOS entran en el ranking: los que ya pausó una pasada
    -- anterior tienen activo = false y por tanto NO desplazan el row_number().
    -- Es lo que hace idempotente a la función ante un reintento del cron.
    where pr.activo is true
      and coalesce(pr.vendido, false) = false
      and coalesce(pr.es_demo, false) = false
      and c.cupo is not null
  ),
  pausados as (
    update public.productos pr
       set activo = false,
           pausado_por_plan = true,
           pausado_en = p_ahora
      from orden o
     where pr.id = o.id
       and o.rn > o.cupo
    returning pr.user_id, pr.id, pr.titulo, o.cupo
  )
  select p.user_id, p.id, p.titulo, p.cupo
  from pausados p;
end $$;

comment on function public.aplicar_cupo_planes(timestamptz) is
  'Pausa por cupo de plan. Solo service_role (o SQL directo). Idempotente: una segunda pasada no encuentra nada que pausar.';

revoke all on function public.aplicar_cupo_planes(timestamptz)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.aplicar_cupo_planes(timestamptz) to service_role';
  end if;
end $$;
