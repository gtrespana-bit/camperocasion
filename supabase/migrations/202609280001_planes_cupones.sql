-- Planes profesionales, mes de prueba configurable y cupones.

alter table public.perfiles
  add column if not exists plan_anuncios text not null default 'gratis';
alter table public.perfiles
  add column if not exists plan_hasta timestamptz;
alter table public.perfiles
  add column if not exists stripe_customer_id text;
alter table public.perfiles
  add column if not exists stripe_subscription_id text;
alter table public.perfiles
  add column if not exists destacados_mes_usados integer not null default 0;
alter table public.perfiles
  add column if not exists destacados_mes_periodo text;

do $$
begin
  alter table public.perfiles
    add constraint perfiles_plan_anuncios_check
    check (plan_anuncios in ('gratis', 'starter', 'plus', 'unlimited'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.plataforma_ajustes (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

insert into public.plataforma_ajustes (clave, valor)
values ('planes', '{"mes_gratis_activo": true, "dias_gratis": 30}'::jsonb)
on conflict (clave) do nothing;

create table if not exists public.cupones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null,
  activo boolean not null default true,
  max_usos integer,
  usos integer not null default 0,
  valido_desde timestamptz,
  valido_hasta timestamptz,
  dias integer,
  plan text,
  porcentaje numeric,
  meses_descuento integer,
  stripe_coupon_id text,
  notas text,
  creado_en timestamptz not null default now()
);

do $$
begin
  alter table public.cupones
    add constraint cupones_tipo_check
    check (tipo in ('regalo_dias', 'descuento'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.cupones_usos (
  id uuid primary key default gen_random_uuid(),
  cupon_id uuid not null references public.cupones(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  usado_en timestamptz not null default now(),
  unique (cupon_id, user_id)
);

alter table public.plataforma_ajustes enable row level security;
alter table public.cupones enable row level security;
alter table public.cupones_usos enable row level security;

-- Solo service_role (el API admin). Sin políticas = nadie con anon/authenticated.
