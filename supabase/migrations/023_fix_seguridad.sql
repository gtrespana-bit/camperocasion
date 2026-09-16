-- ============================================================
-- 023_fix_seguridad.sql
-- Fase 1 de seguridad (2026-07-31)
--
-- Cierra 3 vectores de abuso de créditos/verificación:
--   1. Crea tabla `admins` (emails con permisos de administrador).
--   2. aprobar_transaccion: solo puede ejecutarla un admin real
--      (auth.uid() debe estar en `admins`). Antes, cualquier usuario
--      autenticado podía auto-aprobarse una compra de créditos.
--   3. usar_boost / usar_destacado: exigen que auth.uid() coincida
--      con p_user_id. Antes, un atacante podía drenar los créditos
--      de otro usuario pasando su user_id.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 1. Tabla de administradores
create table if not exists admins (
  email text primary key,
  creado_en timestamp with time zone default now()
);

insert into admins (email) values ('gtrespana@gmail.com')
on conflict (email) do nothing;

-- 2. aprobar_transaccion: SOLO admins (según sesión JWT, no el parámetro)
create or replace function aprobar_transaccion(
  p_transaccion_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_monto integer;
  v_estado text;
  v_tipo text;
  v_es_admin boolean;
begin
  -- Verificar sesión autenticada
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'No autenticado');
  end if;

  -- Verificar que el llamador está en la tabla admins (vía su email en auth.users)
  select exists (
    select 1
    from auth.users u
    join admins a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
  ) into v_es_admin;

  if not v_es_admin then
    return jsonb_build_object('ok', false, 'error', 'No autorizado: solo administradores');
  end if;

  select user_id, monto, estado, tipo
  into v_user_id, v_monto, v_estado, v_tipo
  from transacciones_creditos
  where id = p_transaccion_id;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Transacción no encontrada');
  end if;
  if v_estado != 'pendiente' then
    return jsonb_build_object('ok', false, 'error', 'Transacción ya procesada');
  end if;
  if v_tipo != 'compra' then
    return jsonb_build_object('ok', false, 'error', 'Solo se pueden aprobar compras');
  end if;

  -- Actualizar transacción
  update transacciones_creditos set estado = 'aprobado' where id = p_transaccion_id;

  -- Añadir créditos
  update perfiles set credito_balance = credito_balance + v_monto where id = v_user_id;

  return jsonb_build_object('ok', true, 'creditos_anadidos', v_monto);
end;
$$;

-- 3. usar_boost: el llamador debe ser el dueño del producto
create or replace function usar_boost(
  p_producto_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_owner uuid;
begin
  -- La sesión debe coincidir con p_user_id (evita drenar créditos ajenos)
  if auth.uid() is null or auth.uid() != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado: la sesión no coincide con el usuario');
  end if;

  select user_id into v_owner from productos where id = p_producto_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  select credito_balance into v_balance from perfiles where id = p_user_id;
  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes');
  end if;

  update productos set boosteado_en = now() where id = p_producto_id;
  update perfiles set credito_balance = credito_balance - 1 where id = p_user_id;
  insert into transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (p_user_id, 'gasto', 1, 'boost', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance - 1);
end;
$$;

-- 4. usar_destacado: igual que usar_boost
create or replace function usar_destacado(
  p_producto_id uuid,
  p_user_id uuid,
  p_horas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_owner uuid;
  v_costo integer;
begin
  -- La sesión debe coincidir con p_user_id
  if auth.uid() is null or auth.uid() != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado: la sesión no coincide con el usuario');
  end if;

  select user_id into v_owner from productos where id = p_producto_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  v_costo := case
    when p_horas <= 12 then 4
    when p_horas <= 24 then 6
    else 10
  end;

  select credito_balance into v_balance from perfiles where id = p_user_id;
  if v_balance < v_costo then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes (necesitas ' || v_costo || ')');
  end if;

  update productos
  set destacado = true,
      destacado_hasta = now() + (p_horas || ' hours')::interval
  where id = p_producto_id;

  update perfiles set credito_balance = credito_balance - v_costo where id = p_user_id;

  insert into transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (p_user_id, 'gasto', v_costo, 'destacado_' || p_horas || 'h', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance - v_costo, 'hasta', now() + (p_horas || ' hours')::interval);
end;
$$;

-- 5. Reforzar: revocar ejecución a anon en las funciones sensibles
revoke execute on function aprobar_transaccion(uuid, uuid) from anon;
revoke execute on function usar_boost(uuid, uuid) from anon;
revoke execute on function usar_destacado(uuid, uuid, integer) from anon;
