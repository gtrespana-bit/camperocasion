-- ============================================================================
-- CamperOcasión — Reserva con señal (Fase 1.2 del plan de confianza)
-- Fecha: 2026-09-16
--
-- Qué resuelve
--   El dolor nº1 del vendedor son los "pisos": compradores que dicen que van en
--   camino, que el vendedor espera y que nunca aparecen. La reserva con señal
--   (300-500 €, muy por debajo del precio del vehículo) resuelve eso sin
--   custodia de fondos: el comprador paga DIRECTAMENTE al vendedor
--   (Bizum/transferencia), sube el comprobante y nuestro equipo lo verifica
--   antes de marcar el anuncio como reservado.
--
-- Decisión de diseño importante (para no inventar un escrow que no toca):
--   La plataforma NO mueve el dinero. Por eso aquí se registra el importe, la
--   comisión prevista (`comision_pct`, 0 por ahora) y el comprobante, pero no hay
--   saldos ni custodia. Cuando se conecte la pasarela (Stripe) no hará falta otra
--   migración: las columnas ya están.
--
-- Aditiva e idempotente: el sitio funciona sin ella (los anuncios simplemente no
-- se pueden reservar y el botón no aparece).
-- ============================================================================

-- ── 1. Estado de reserva en productos (denormalizado para listados) ─────────
-- La verdad vive en `reservas`; estas dos columnas son el cache que necesitan el
-- catálogo y las tarjetas para pintar "Reservado" sin joins. Un trigger las
-- mantiene (ver más abajo).

alter table public.productos
  add column if not exists reservado boolean not null default false,
  add column if not exists reservado_hasta timestamptz;

create index if not exists productos_reservado_idx
  on public.productos (reservado)
  where reservado;

comment on column public.productos.reservado is
  'Cache de "hay una reserva con señal vigente". La fuente es la tabla reservas; '
  'lo mantiene el trigger trg_propagar_reserva.';


-- ── 2. Tabla de reservas ────────────────────────────────────────────────────

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  comprador_id uuid not null references auth.users(id) on delete cascade,
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  -- Importe de la señal acordado (se descuenta del precio en la reunión).
  importe numeric(10,2) not null check (importe > 0 and importe <= 5000),
  -- Comisión prevista de la plataforma. 0 mientras el pago sea directo entre
  -- las partes: no cobramos por un dinero que no movemos.
  comision_pct numeric(4,2) not null default 0 check (comision_pct >= 0 and comision_pct <= 20),
  -- Importe de comisión resultante (0 mientras el pago sea directo).
  comision numeric(10,2) not null default 0 check (comision >= 0),
  metodo_pago text not null default 'bizum'
    check (metodo_pago in ('bizum', 'transferencia', 'efectivo', 'otro')),
  estado text not null default 'pendiente_pago'
    check (estado in (
      'pendiente_pago', 'en_revision', 'activa', 'completada',
      'rechazada', 'cancelada', 'reembolsada', 'expirada'
    )),
  -- Ruta del comprobante en el bucket privado `comprobantes-reserva`.
  comprobante_url text,
  mensaje text,
  motivo_cancelacion text,
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_en timestamptz,
  -- Hasta cuándo bloquea el anuncio. Se renueva al activar la reserva.
  expira_en timestamptz not null default (now() + interval '7 days'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists reservas_producto_idx on public.reservas (producto_id);
create index if not exists reservas_comprador_idx on public.reservas (comprador_id);
create index if not exists reservas_vendedor_idx on public.reservas (vendedor_id);
create index if not exists reservas_estado_idx on public.reservas (estado);

-- Un anuncio no puede tener dos reservas vivas a la vez: es la garantía de que
-- "reservado" significa algo. Los estados terminales no entran en el índice.
create unique index if not exists reservas_producto_viva_key
  on public.reservas (producto_id)
  where estado in ('pendiente_pago', 'en_revision', 'activa');

comment on table public.reservas is
  'Reservas con señal de un anuncio. El comprador paga directamente al vendedor '
  '(Bizum/transferencia) y sube el comprobante; el equipo lo verifica y el '
  'anuncio se marca como reservado. La plataforma no custodia fondos.';

alter table public.reservas enable row level security;

-- Lectura: comprador y vendedor de la reserva, y el admin. Nadie más.
drop policy if exists "reservas: partes" on public.reservas;
create policy "reservas: partes" on public.reservas
  for select to authenticated
  using (auth.uid() = comprador_id or auth.uid() = vendedor_id);

drop policy if exists "reservas: admin" on public.reservas;
create policy "reservas: admin" on public.reservas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Escrituras SOLO con service_role (la API comprueba propiedad, estado y
-- transiciones): el navegador no puede crearse una reserva activa solo.
revoke all on public.reservas from anon;
grant select on public.reservas to authenticated;
grant all on public.reservas to service_role;


-- ── 3. Propagación a productos ──────────────────────────────────────────────
-- Reserva vigente = pendiente_pago / en_revision / activa y sin caducar.

create or replace function public.fn_propagar_reserva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto uuid := coalesce(new.producto_id, old.producto_id);
  v_hasta timestamptz;
begin
  select r.expira_en into v_hasta
    from public.reservas r
   where r.producto_id = v_producto
     and r.estado in ('pendiente_pago', 'en_revision', 'activa')
     and r.expira_en > now()
   order by r.creado_en desc
   limit 1;

  update public.productos
     set reservado = (v_hasta is not null),
         reservado_hasta = v_hasta
   where id = v_producto;

  return null;
end $$;

drop trigger if exists trg_propagar_reserva on public.reservas;
create trigger trg_propagar_reserva
  after insert or update or delete on public.reservas
  for each row execute function public.fn_propagar_reserva();


-- ── 4. Vender cierra las reservas vivas ─────────────────────────────────────
-- Si el anuncio se marca como vendido, las reservas dejan de bloquear nada.

create or replace function public.fn_completar_reservas_al_vender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vendido is true and coalesce(old.vendido, false) is false then
    update public.reservas
       set estado = 'completada',
           actualizado_en = now()
     where producto_id = new.id
       and estado in ('pendiente_pago', 'en_revision', 'activa');
  end if;
  return new;
end $$;

drop trigger if exists trg_completar_reservas_al_vender on public.productos;
create trigger trg_completar_reservas_al_vender
  after update on public.productos
  for each row execute function public.fn_completar_reservas_al_vender();


-- ── 5. Bucket privado para los comprobantes ─────────────────────────────────
-- Ruta: <comprador_id>/<reserva_id>/<archivo>. El comprobante puede ser una
-- captura de Bizum, un justificante de transferencia o un PDF del banco.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-reserva',
  'comprobantes-reserva',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "comprobantes-reserva: owner upload" on storage.objects;
create policy "comprobantes-reserva: owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes-reserva'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprobantes-reserva: owner read" on storage.objects;
create policy "comprobantes-reserva: owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes-reserva'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprobantes-reserva: owner delete" on storage.objects;
create policy "comprobantes-reserva: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes-reserva'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- El vendedor necesita ver el comprobante de la señal de SU anuncio: se
-- autoriza por pertenencia del segundo nivel (la reserva) contra la tabla.
-- Se hace con un helper SECURITY DEFINER para no depender de la RLS de reservas.
create or replace function public.fn_soy_parte_de_la_reserva(p_reserva_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reservas r
    where r.id = p_reserva_id
      and (r.comprador_id = auth.uid() or r.vendedor_id = auth.uid())
  );
$$;

grant execute on function public.fn_soy_parte_de_la_reserva(uuid) to authenticated;

drop policy if exists "comprobantes-reserva: seller read" on storage.objects;
create policy "comprobantes-reserva: seller read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes-reserva'
    and public.fn_soy_parte_de_la_reserva(
      nullif((storage.foldername(name))[2], '')::uuid
    )
  );

drop policy if exists "comprobantes-reserva: admin read" on storage.objects;
create policy "comprobantes-reserva: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes-reserva' and public.is_admin());
