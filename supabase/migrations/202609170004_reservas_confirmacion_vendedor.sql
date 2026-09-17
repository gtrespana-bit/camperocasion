-- ============================================================================
-- CamperOcasión — Reserva con señal: confirmación por el VENDEDOR (202609170004)
--
-- Por qué
--   La reserva con señal anterior (202609160001) simulaba una verificación de
--   pago que la plataforma NO puede hacer: el comprador subía un comprobante y
--   un admin lo revisaba, sobre un dinero que la plataforma no custodia ni ve.
--   El resultado era un proceso de 8 estados que solo añadía fricción y trabajo
--   manual sin valor.
--
--   Nuevo modelo: quien recibe el dinero es el VENDEDOR, así que es él quien
--   confirma. El comprador envía la SOLICITUD (no bloquea el anuncio); el
--   vendedor la CONFIRMA cuando recibe la señal y solo entonces el anuncio
--   queda reservado. Sin comprobantes, sin bucket y sin revisión del admin.
--
--   Estados: solicitada → activa → completada
--            solicitada → rechazada / cancelada / expirada
--
-- Aditiva e idempotente: migra los datos existentes y solo una reserva ACTIVA
-- por anuncio bloquea el anuncio. Se aplica DESPUÉS de 202609160001.
-- ============================================================================

-- ── 1. Estados: admitir 'solicitada', retirar los que desaparecen ──────────
--    Antes de estrechar el CHECK, se migran las filas existentes.
alter table public.reservas
  drop constraint if exists reservas_estado_check;

-- pendiente_pago / en_revision pasan a solicitada (a la espera del vendedor).
update public.reservas
   set estado = 'solicitada', actualizado_en = now()
 where estado in ('pendiente_pago', 'en_revision');

-- reembolsada desaparece: queda como cancelada con el motivo de devolución.
update public.reservas
   set estado = 'cancelada', actualizado_en = now()
 where estado = 'reembolsada';

-- Por si hubiera dos activas del mismo anuncio, se cancela la más antigua.
update public.reservas r
   set estado = 'cancelada', actualizado_en = now()
 where r.estado = 'activa'
   and r.id <> (
     select rr.id
       from public.reservas rr
      where rr.producto_id = r.producto_id
        and rr.estado = 'activa'
      order by rr.creado_en desc
      limit 1
   );

alter table public.reservas
  add constraint reservas_estado_check
  check (estado in ('solicitada', 'activa', 'completada', 'rechazada', 'cancelada', 'expirada'));

alter table public.reservas
  alter column estado set default 'solicitada';

-- ── 2. Índices de unicidad ─────────────────────────────────────────────────
--    Una solicitud no bloquea el anuncio, y un anuncio solo puede tener UNA
--    reserva ACTIVA. Se guarda además que un comprador no duplique solicitudes
--    sobre el mismo anuncio.
drop index if exists public.reservas_producto_viva_key;

create unique index if not exists reservas_producto_activa_key
  on public.reservas (producto_id)
  where estado = 'activa';

create unique index if not exists reservas_solicitud_unica_key
  on public.reservas (producto_id, comprador_id)
  where estado = 'solicitada';

-- ── 3. Propagación a productos ──────────────────────────────────────────────
--    Solo una reserva ACTIVA (confirmada) y sin caducar marca el anuncio como
--    reservado. Una solicitud pendiente NO lo bloquea.
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
     and r.estado = 'activa'
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

-- ── 4. Vender cierra las solicitudes y reservas vivas ───────────────────────
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
       and estado in ('solicitada', 'activa');
  end if;
  return new;
end $$;

drop trigger if exists trg_completar_reservas_al_vender on public.productos;
create trigger trg_completar_reservas_al_vender
  after update on public.productos
  for each row execute function public.fn_completar_reservas_al_vender();

-- ── 5. El comprobante ya no se usa: se retiran sus políticas ───────────────
--    (el dinero se ve en la cuenta del vendedor, no en una captura subida).
--    NOTA: NO se borra la fila del bucket `comprobantes-reserva` con SQL: el
--    trigger storage.protect_delete() de Supabase lo prohíbe (solo Storage API
--    o el dashboard). El bucket vacío es inofensivo; lo relevante es que la
--    app ya no escribe ni lee ahí.
drop policy if exists "comprobantes-reserva: owner upload" on storage.objects;
drop policy if exists "comprobantes-reserva: owner read" on storage.objects;
drop policy if exists "comprobantes-reserva: owner delete" on storage.objects;
drop policy if exists "comprobantes-reserva: seller read" on storage.objects;
drop policy if exists "comprobantes-reserva: admin read" on storage.objects;

drop function if exists public.fn_soy_parte_de_la_reserva(uuid);
