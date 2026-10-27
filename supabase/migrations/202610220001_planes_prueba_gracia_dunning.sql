-- ============================================================================
-- CamperOcasión — Fase 2 de planes: prueba por usuario, gracia, dunning y
-- pausa de anuncios que exceden el cupo.
-- Fecha: 2026-10-22
--
-- Por qué:
--   · La prueba se calculaba desde `creado_en` con un interruptor global. Si
--     el admin apagaba el mes gratis, los usuarios que ya estaban dentro la
--     perdían a mitad; y no se podía dar una prueba distinta a una cuenta.
--   · Al terminar la prueba el cupo caía de golpe de 15 a 1 sin avisar y sin
--     una salida digna: el vendedor veía desaparecer sus anuncios.
--   · Un cobro fallido no dejaba rastro en la base: no había forma de avisar
--     ni de saber a quién había que reclamar.
--
-- Qué hace (sin borrar datos):
--   1. Guarda fechas reales de prueba por perfil y las rellena para los
--      profesionales que ya estaban dentro (respetando su antigüedad).
--   2. Marca anuncios pausados por cupo (`pausado_por_plan`) para poder
--      reactivarlos con un clic y distinguirlos de los que pausó el usuario.
--   3. Añade `plan_avisos`: registro idempotente de emails/push enviados, para
--      que un cron diario no repita el mismo aviso.
--   4. Añade `aplicar_cupo_planes()`: pausa en una sola pasada los anuncios
--      que sobran, dando prioridad a los destacados y a los que menos visitas
--      tienen. No borra nada.
--
-- Tras aplicarla, los anuncios pausados se reactivan solos al contratar o
-- subir de pack (`reactivarPausadosPorPlan` en `planes-servidor.ts`).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Fechas reales de prueba y estado de cobro
-- ────────────────────────────────────────────────────────────────────────────

alter table public.perfiles
  add column if not exists trial_iniciado_en timestamptz,
  add column if not exists trial_hasta timestamptz,
  add column if not exists trial_plan text,
  add column if not exists pago_pendiente_desde timestamptz;

comment on column public.perfiles.trial_iniciado_en is
  'Inicio real de la prueba. NULL = nunca la ha empezado. No se reinicia al cambiar de pack.';
comment on column public.perfiles.trial_hasta is
  'Fin real de la prueba. Se guarda al iniciarla para que el fin no dependa de un ajuste global.';
comment on column public.perfiles.trial_plan is
  'Pack que se prueba (por defecto plus).';
comment on column public.perfiles.pago_pendiente_desde is
  'Primer fallo de cobro de la suscripción. NULL = al corriente. Lo limpia invoice.paid.';

-- Avisos que ya se han enviado: (user_id, clave) único hace el cron idempotente.
create table if not exists public.plan_avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  clave text not null,
  tipo text not null,
  canal text not null default 'email',
  enviado_en timestamptz not null default now(),
  unique (user_id, clave)
);

create index if not exists idx_plan_avisos_user on public.plan_avisos(user_id);

alter table public.plan_avisos enable row level security;
-- Solo service_role (cron y APIs de servidor). Sin políticas = nadie más.
revoke all on public.plan_avisos from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Anuncios pausados por cupo (no por el usuario)
-- ────────────────────────────────────────────────────────────────────────────

alter table public.productos
  add column if not exists pausado_por_plan boolean not null default false,
  add column if not exists pausado_en timestamptz;

comment on column public.productos.pausado_por_plan is
  'true = lo pausó el sistema al bajar el cupo, no el vendedor. Se reactiva al ampliar el pack.';

create index if not exists idx_productos_pausados_plan
  on public.productos(user_id)
  where pausado_por_plan = true;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Relleno para quien ya estaba dentro
--    Se respeta la antigüedad: la prueba empieza en su fecha de alta. Quien ya
--    la había agotado sigue agotada; nadie gana ni pierde días por la migración.
-- ────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_dias integer := 30;
  v_activo boolean := true;
begin
  select
    coalesce((valor ->> 'dias_gratis')::integer, v_dias),
    coalesce((valor ->> 'mes_gratis_activo')::boolean, v_activo)
  into v_dias, v_activo
  from public.plataforma_ajustes
  where clave = 'planes';

  v_dias := coalesce(nullif(v_dias, 0), 30);

  update public.perfiles
     set trial_iniciado_en = creado_en,
         trial_hasta = creado_en + make_interval(days => v_dias),
         trial_plan = coalesce(trial_plan, 'plus')
   where tipo_vendedor in ('camperizador', 'profesional')
     and trial_iniciado_en is null
     and creado_en is not null
     and coalesce(plan_anuncios, 'gratis') = 'gratis';
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. La prueba arranca sola al profesionalizarse
--    · En el alta como camperizador/profesional.
--    · Cuando un particular cambia su tipo a profesional (una sola vez).
--    · NUNCA al caer de un pack de pago a gratis: si no, quien paga un mes
--      recibiría una prueba nueva al terminar y sería explotable.
--    El interruptor global `mes_gratis_activo` decide si se concede una
--    prueba NUEVA; no corta las que ya están en curso.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_iniciar_trial_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias integer := 30;
  v_activo boolean := true;
begin
  if new.tipo_vendedor not in ('camperizador', 'profesional') then
    return new;
  end if;

  -- Solo en el alta o en un cambio real de tipo a profesional.
  if tg_op = 'UPDATE' and new.tipo_vendedor is not distinct from old.tipo_vendedor then
    return new;
  end if;

  if new.trial_iniciado_en is not null then
    return new; -- ya la usó (o la está usando)
  end if;

  if coalesce(new.plan_anuncios, 'gratis') <> 'gratis' then
    return new; -- acaba de contratar un pack: no es una prueba
  end if;

  -- Si la tabla de ajustes no existiera, el alta no debe fallar: se usa la
  -- configuración por defecto.
  begin
    select
      coalesce((valor ->> 'dias_gratis')::integer, v_dias),
      coalesce((valor ->> 'mes_gratis_activo')::boolean, v_activo)
    into v_dias, v_activo
    from public.plataforma_ajustes
    where clave = 'planes';
  exception when others then
    v_dias := 30;
    v_activo := true;
  end;

  if not coalesce(v_activo, true) then
    return new;
  end if;

  new.trial_iniciado_en := now();
  new.trial_hasta := now() + make_interval(days => coalesce(nullif(v_dias, 0), 30));
  new.trial_plan := coalesce(new.trial_plan, 'plus');

  return new;
end $$;

drop trigger if exists trg_iniciar_trial_perfil on public.perfiles;
create trigger trg_iniciar_trial_perfil
  before insert or update of tipo_vendedor
  on public.perfiles
  for each row
  execute function public.fn_iniciar_trial_perfil();

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Pausa masiva de anuncios que exceden el cupo
--
-- Reglas:
--   · Pack vigente > prueba/gracia > gratis.
--   · La gracia son 7 días después de `trial_hasta` (mismo número que
--     `DIAS_GRACIA_TRIAL` en `src/lib/planes-prueba.ts`).
--   · Se conservan, en este orden: destacados vigentes, más visitas, más
--     recientes. Se pausan los que menos valor generan.
--   · Idempotente: una segunda pasada no encuentra nada que pausar.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.aplicar_cupo_planes(p_ahora timestamptz default now())
returns table (vendedor_id uuid, producto_id uuid, titulo text, cupo integer)
language plpgsql
security definer
set search_path = public
as $$
begin
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
    where pr.activo is true
      and coalesce(pr.vendido, false) = false
      -- Los anuncios de demostración no son stock del vendedor.
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

-- PostgreSQL da EXECUTE a PUBLIC por defecto, PERO Supabase además concede
-- privilegios por defecto explícitos a anon/authenticated/service_role sobre
-- las funciones del esquema public. Un `revoke ... from public` NO retira esos
-- grants explícitos: hay que nombrar los tres roles (convención usada en
-- 202608010006, 202609220001, 202609290001 y 202610230001).
-- Ver también 202610270001_permisos_aplicar_cupo_planes.sql (parche para las
-- bases donde esta migración ya estaba aplicada).
revoke all on function public.aplicar_cupo_planes(timestamptz) from public, anon, authenticated;
grant execute on function public.aplicar_cupo_planes(timestamptz) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Consultas rápidas para el cron
-- ────────────────────────────────────────────────────────────────────────────

create index if not exists idx_perfiles_trial_hasta
  on public.perfiles(trial_hasta)
  where trial_hasta is not null;

create index if not exists idx_perfiles_pago_pendiente
  on public.perfiles(pago_pendiente_desde)
  where pago_pendiente_desde is not null;
