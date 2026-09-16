-- ============================================================================
-- VendeT — Bonus emprendedor idempotente
-- Fecha: 2026-08-01
--
-- El trigger histórico de 011_credito_sistema.sql ponía emprendedor_dado=false
-- al bajar de 10 publicaciones y no revertía los créditos ya entregados.
-- Crear publicaciones después permitía cobrar el bonus varias veces.
--
-- Esta migración conserva los créditos existentes, registra los usuarios que ya
-- recibieron el bonus y hace que el hito de 10 publicaciones solo pueda
-- concederse una vez por usuario.
-- ============================================================================

alter table public.perfiles
  add column if not exists emprendedor_dado boolean not null default false;

alter table public.transacciones_creditos
  add column if not exists motivo_registro text;

-- La migración 011 histórica intentaba usar estos tipos antes de ampliar el
-- constraint original. Dejamos el esquema consistente de forma idempotente.
alter table public.transacciones_creditos
  drop constraint if exists transacciones_creditos_tipo_check;

alter table public.transacciones_creditos
  add constraint transacciones_creditos_tipo_check
  check (tipo in ('compra', 'gasto', 'reembolso', 'bienvenida', 'emprendedor', 'admin_manual'));

create table if not exists public.creditos_bonificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  hito text not null,
  creditos integer not null check (creditos > 0),
  creado_en timestamptz not null default now(),
  unique (user_id, tipo, hito)
);

alter table public.creditos_bonificaciones enable row level security;
revoke all on public.creditos_bonificaciones from anon, authenticated;

-- Reconstruir el ledger mínimo para usuarios que ya tienen evidencia de haber
-- recibido el bonus. No se modifican balances ni se borran transacciones aquí.
insert into public.creditos_bonificaciones (user_id, tipo, hito, creditos)
select distinct user_id, 'emprendedor', '10_publicaciones', 5
from public.transacciones_creditos
where tipo = 'emprendedor'
on conflict (user_id, tipo, hito) do nothing;

update public.perfiles p
set emprendedor_dado = true
where exists (
  select 1
  from public.creditos_bonificaciones b
  where b.user_id = p.id
    and b.tipo = 'emprendedor'
    and b.hito = '10_publicaciones'
);

-- El trigger que reseteaba el flag permitía volver a cobrar. Se elimina.
drop trigger if exists trg_recalc_emprendedor on public.productos;
drop function if exists public.trg_recalcular_emprendedor();

create or replace function public.trg_empaque_emprendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub_count integer;
  v_grant_id uuid;
begin
  select count(*)
    into v_pub_count
  from public.productos
  where user_id = new.user_id
    and activo = true;

  if v_pub_count >= 10 then
    -- La unique constraint y ON CONFLICT hacen que dos publicaciones
    -- simultáneas solo puedan crear un grant.
    insert into public.creditos_bonificaciones (user_id, tipo, hito, creditos)
    values (new.user_id, 'emprendedor', '10_publicaciones', 5)
    on conflict (user_id, tipo, hito) do nothing
    returning id into v_grant_id;

    if v_grant_id is not null then
      update public.perfiles
      set credito_balance = coalesce(credito_balance, 0) + 5,
          emprendedor_dado = true
      where id = new.user_id;

      if not found then
        raise exception 'No existe el perfil del usuario que recibe el bonus';
      end if;

      insert into public.transacciones_creditos (
        user_id, tipo, monto, estado, motivo_registro, creado_en
      ) values (
        new.user_id,
        'emprendedor',
        5,
        'aprobado',
        'Bonus emprendedor - 10 publicaciones',
        now()
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pack_emprendedor on public.productos;
create trigger trg_pack_emprendedor
  after insert on public.productos
  for each row execute function public.trg_empaque_emprendedor();
