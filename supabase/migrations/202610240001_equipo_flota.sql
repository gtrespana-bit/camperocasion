-- Equipo de Unlimited Flota: varios comerciales con una sola cuota.
--
-- El caso real: un compraventa paga 39 €/mes y tiene tres comerciales. Hoy
-- comparten el login (y con él la contraseña, la sesión y el historial) o
-- publican desde una sola cuenta. Aquí cada comercial tiene su usuario, sus
-- anuncios siguen siendo suyos, pero el pack, el cupo y los destacados son de
-- la cuenta: una factura, un escaparate y un límite común.
--
-- Decisiones:
--  · La pertenencia se guarda por email y se confirma con un token, porque el
--    comercial puede no tener cuenta todavía cuando se le invita.
--  · `fn_cuenta_titular()` es la única fuente de la relación: si un usuario
--    tiene una membresía activa, su «cuenta» es la del titular. Así el resto
--    de la app no necesita saber si alguien es miembro o titular.
--  · Un miembro solo puede estar en un equipo a la vez (índice único parcial).
--  · El tope de asientos se impone también en la base, no solo en la API: un
--    bug en el servidor no debe regalar un pack de equipo ilimitado.
--  · RLS activado sin políticas: solo el service_role toca esta tabla.

create table if not exists public.equipo_miembros (
  id uuid primary key default gen_random_uuid(),
  titular_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  miembro_id uuid references auth.users(id) on delete set null,
  nombre text,
  rol text not null default 'comercial',
  estado text not null default 'invitado',
  token uuid not null default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  aceptado_en timestamptz,
  ultimo_acceso_en timestamptz,
  constraint equipo_miembros_rol_check check (rol in ('comercial', 'admin')),
  constraint equipo_miembros_estado_check check (estado in ('invitado', 'activo', 'revocado')),
  constraint equipo_miembros_no_self check (miembro_id is null or miembro_id <> titular_id)
);

comment on table public.equipo_miembros is
  'Comerciales invitados a la cuenta Flota. El plan y el cupo son del titular.';

-- Parcial: un acceso revocado no debe impedir volver a invitar a la misma
-- persona más adelante.
create unique index if not exists equipo_miembros_email_unico
  on public.equipo_miembros (titular_id, lower(email))
  where estado <> 'revocado';
create unique index if not exists equipo_miembros_token_unico
  on public.equipo_miembros (token);
-- Un usuario no puede ser comercial de dos cuentas a la vez.
create unique index if not exists equipo_miembros_miembro_unico
  on public.equipo_miembros (miembro_id)
  where miembro_id is not null and estado = 'activo';
create index if not exists equipo_miembros_titular_idx
  on public.equipo_miembros (titular_id, estado);
create index if not exists equipo_miembros_miembro_idx
  on public.equipo_miembros (miembro_id)
  where miembro_id is not null;

alter table public.equipo_miembros enable row level security;

-- ── Cuenta efectiva ────────────────────────────────────────────────────────
-- Devuelve el titular de la cuenta a la que pertenece `p_user`. Si no es
-- miembro activo de nadie, es su propia cuenta.
create or replace function public.fn_cuenta_titular(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.titular_id
        from public.equipo_miembros m
       where m.miembro_id = p_user
         and m.estado = 'activo'
       limit 1
    ),
    p_user
  );
$$;

revoke all on function public.fn_cuenta_titular(uuid) from public;
grant execute on function public.fn_cuenta_titular(uuid) to service_role;

-- ── Tope de asientos ───────────────────────────────────────────────────────
-- 3 comerciales además del titular. Se cuenta invitados y activos: una
-- invitación pendiente ya reserva asiento, para no aceptar 20 y descubrirlo
-- al final.
create or replace function public.fn_equipo_limite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ocupados integer;
begin
  if new.estado in ('invitado', 'activo') then
    select count(*) into ocupados
      from public.equipo_miembros m
     where m.titular_id = new.titular_id
       and m.estado in ('invitado', 'activo')
       and m.id <> new.id;

    if ocupados >= 3 then
      raise exception 'El equipo admite como máximo 3 comerciales'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipo_limite on public.equipo_miembros;
create trigger trg_equipo_limite
  before insert or update of estado, titular_id on public.equipo_miembros
  for each row execute function public.fn_equipo_limite();
