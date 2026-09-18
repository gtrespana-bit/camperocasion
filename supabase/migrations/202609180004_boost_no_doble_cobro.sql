/**
 * Cobrar dos veces por el mismo boost.
 *
 * `usar_boost` (definida en `202608010001_hardening_integridad.sql`) descontaba
 * 1 crédito y ponía `boosteado_en = now()` sin mirar si el anuncio ya estaba
 * subido. Con la caducidad de `BOOST_DIAS = 7` día que ahora aplica la web, un
 * vendedor podía pulsar «Subir al nº 1» dos veces seguidas y pagar 2 créditos
 * por un solo efecto: la segunda pulsación solo reescribía la fecha.
 *
 * La regla nueva no cambia el precio ni la duración; solo impide el cobro
 * inútil: si la subida sigue vigente, la RPC devuelve `ok: false` con un
 * mensaje claro y **no toca el saldo**. Cuando caduca (o si nunca se subió),
 * funciona igual que antes.
 *
 * `BOOST_DIAS` debe coincidir con `src/lib/catalog-consulta.ts`; si algún día
 * cambia allí, hay que cambiarlo también aquí (y en ese caso conviene moverlo a
 * una tabla de configuración).
 */
create or replace function public.usar_boost(
  p_producto_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_boosteado timestamptz;
  v_balance integer;
  v_boost_dias constant integer := 7;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  select user_id, boosteado_en
    into v_owner, v_boosteado
  from public.productos
  where id = p_producto_id
  for update;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;
  if v_boosteado is not null
     and v_boosteado > now() - (v_boost_dias || ' days')::interval then
    return jsonb_build_object(
      'ok', false,
      'error', 'Tu publicación ya está en el nº 1 con la subida actual',
      'ya_activo', true,
      'vigente_hasta', v_boosteado + (v_boost_dias || ' days')::interval
    );
  end if;

  update public.perfiles
  set credito_balance = credito_balance - 1
  where id = auth.uid() and coalesce(credito_balance, 0) >= 1
  returning credito_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes');
  end if;

  update public.productos
  set boosteado_en = now()
  where id = p_producto_id and user_id = auth.uid();

  insert into public.transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (auth.uid(), 'gasto', 1, 'boost', 'aprobado');

  return jsonb_build_object(
    'ok', true,
    'balance', v_balance,
    'vigente_hasta', now() + (v_boost_dias || ' days')::interval
  );
end;
$$;

grant execute on function public.usar_boost(uuid, uuid) to authenticated;
revoke execute on function public.usar_boost(uuid, uuid) from anon;
