-- ────────────────────────────────────────────────────────────────────────────
-- Stripe: cobro automático de paquetes de créditos (2026-09-22)
--
-- Hasta ahora la compra era manual: el usuario pagaba por Bizum/transferencia,
-- subía una captura y un admin aprobaba a mano (`aprobar_transaccion`). Eso no
-- escala, no emite factura y obliga a revisar comprobantes uno a uno.
--
-- Esta migración añade lo mínimo para que Stripe acredite solo:
--   · columnas de trazabilidad en `transacciones_creditos`
--   · unicidad por sesión de Stripe → el webhook es IDEMPOTENTE
--   · RPC `acreditar_pago_stripe`, que crea la transacción y suma el saldo en
--     una sola operación atómica, sin poder pagar dos veces lo mismo
--
-- Es idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Trazabilidad del pago ---------------------------------------------------

alter table public.transacciones_creditos
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text,
  add column if not exists importe_eur numeric(10,2),
  add column if not exists factura_url text;

comment on column public.transacciones_creditos.stripe_session_id is
  'ID de la Checkout Session (cs_…). Único: garantiza que un pago se acredita una sola vez.';
comment on column public.transacciones_creditos.stripe_payment_intent is
  'ID del PaymentIntent (pi_…), para conciliar con el dashboard de Stripe.';
comment on column public.transacciones_creditos.importe_eur is
  'Importe realmente cobrado por Stripe, en euros.';
comment on column public.transacciones_creditos.factura_url is
  'Enlace al recibo/factura de Stripe que se enseña al usuario en su historial.';

-- La unicidad es la defensa real contra el doble abono: Stripe reintenta los
-- webhooks, y sin esto un reintento sumaría créditos dos veces.
create unique index if not exists transacciones_creditos_stripe_session_key
  on public.transacciones_creditos (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists transacciones_creditos_user_creado_idx
  on public.transacciones_creditos (user_id, creado_en desc);

-- 2. Acreditación atómica e idempotente --------------------------------------

create or replace function public.acreditar_pago_stripe(
  p_user_id uuid,
  p_creditos integer,
  p_session_id text,
  p_payment_intent text default null,
  p_importe_eur numeric default null,
  p_factura_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente uuid;
  v_tx_id uuid;
  v_balance integer;
begin
  -- Solo el webhook (service_role) o un admin pueden acreditar. Nunca el
  -- usuario: si pudiera llamarla, se regalaría créditos.
  if auth.role() <> 'service_role' and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Falta el usuario');
  end if;
  if p_creditos is null or p_creditos <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Créditos no válidos');
  end if;
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Falta la sesión de Stripe');
  end if;

  -- ¿Ya acreditado? Stripe reintenta los webhooks: esto no es un error,
  -- es el camino normal de un reintento. Devolvemos ok con `duplicado`.
  select id into v_existente
  from public.transacciones_creditos
  where stripe_session_id = p_session_id;

  if v_existente is not null then
    select coalesce(credito_balance, 0) into v_balance
    from public.perfiles where id = p_user_id;
    return jsonb_build_object(
      'ok', true, 'duplicado', true,
      'transaccion_id', v_existente, 'balance', v_balance
    );
  end if;

  insert into public.transacciones_creditos (
    user_id, tipo, monto, metodo_pago, estado,
    stripe_session_id, stripe_payment_intent, importe_eur, factura_url
  ) values (
    p_user_id, 'compra', p_creditos, 'stripe', 'aprobado',
    p_session_id, p_payment_intent, p_importe_eur, p_factura_url
  )
  returning id into v_tx_id;

  update public.perfiles
  set credito_balance = coalesce(credito_balance, 0) + p_creditos
  where id = p_user_id
  returning credito_balance into v_balance;

  if v_balance is null then
    -- Perfil inexistente: deshacemos para no dejar una transacción huérfana
    -- que cuadre en la contabilidad pero no haya dado créditos a nadie.
    raise exception 'Perfil % no encontrado', p_user_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'duplicado', false,
    'transaccion_id', v_tx_id, 'creditos_anadidos', p_creditos, 'balance', v_balance
  );
end;
$$;

-- OJO: en PostgreSQL toda funcion nueva nace con EXECUTE concedido a PUBLIC, y
-- `revoke ... from anon, authenticated` NO quita ese permiso heredado. Hay que
-- revocar de PUBLIC explicitamente. El cuerpo ya rechaza a quien no sea
-- service_role/admin, pero dejar el grant abierto es una capa de menos: si
-- manana alguien relaja esa comprobacion, cualquier usuario logueado podria
-- regalarse creditos.
revoke execute on function public.acreditar_pago_stripe(uuid, integer, text, text, numeric, text) from public;
revoke execute on function public.acreditar_pago_stripe(uuid, integer, text, text, numeric, text) from anon, authenticated;
grant execute on function public.acreditar_pago_stripe(uuid, integer, text, text, numeric, text) to service_role;

-- 3. El usuario puede ver sus propias transacciones (historial/recibos) -------

alter table public.transacciones_creditos enable row level security;

drop policy if exists "Ver mis transacciones" on public.transacciones_creditos;
create policy "Ver mis transacciones"
  on public.transacciones_creditos for select
  using (auth.uid() = user_id);
