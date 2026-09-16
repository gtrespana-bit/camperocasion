-- Todo Anuncios: Sistema de créditos — Boost + Destacados
-- Ejecutar en Supabase SQL Editor

-- 1. Columna boosteado_en: cuándo se hizo el último boost (1 crédito)
alter table productos add column if not exists boosteado_en timestamp with time zone;

-- 2. Función RPC: ordenar productos por prioridad
-- boost (reciente) → destacado (vigente) → normales (reciente)
create or replace function obtener_productos_ordenados(
  p_categoria_id integer default null,
  p_subcategoria text default null,
  p_marca text default null,
  p_estado text default null,
  p_ubicacion_estado text default null,
  p_ubicacion_ciudad text default null,
  p_busqueda text default null,
  p_precio_min decimal default null,
  p_precio_max decimal default null,
  p_limite integer default 200,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  titulo text,
  descripcion text,
  categoria_id integer,
  subcategoria text,
  marca text,
  modelo text,
  estado text,
  precio_usd decimal,
  ubicacion_estado text,
  ubicacion_ciudad text,
  imagen_url text,
  imagenes text[],
  activo boolean,
  destacado boolean,
  destacado_hasta timestamp with time zone,
  visitas integer,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  boosteado_en timestamp with time zone
)
language plpgsql
stable
as $$
begin
  return query
  select
    p.id, p.user_id, p.titulo, p.descripcion, p.categoria_id,
    p.subcategoria, p.marca, p.modelo, p.estado, p.precio_usd,
    p.ubicacion_estado, p.ubicacion_ciudad, p.imagen_url,
    p.imagenes, p.activo, p.destacado, p.destacado_hasta,
    p.visitas, p.creado_en, p.actualizado_en, p.boosteado_en
  from productos p
  where p.activo = true
    -- Filtros dinámicos
    and (p_categoria_id is null or p.categoria_id = p_categoria_id)
    and (p_subcategoria is null or p.subcategoria = p_subcategoria)
    and (p_marca is null or p.marca = p_marca)
    and (p_estado is null or p.estado = p_estado)
    and (p_ubicacion_estado is null or p.ubicacion_estado = p_ubicacion_estado)
    and (p_ubicacion_ciudad is null or p.ubicacion_ciudad = p_ubicacion_ciudad)
    and (p_busqueda is null or p.titulo ilike '%' || p_busqueda || '%')
    and (p_precio_min is null or p.precio_usd >= p_precio_min)
    and (p_precio_max is null or p.precio_usd <= p_precio_max)
  order by
    -- 1º Boost activos: ordenados por cuándo se hicieron (más reciente primero)
    case when p.boosteado_en is not null then 0 else 1 end,
    p.boosteado_en desc nulls last,
    -- 2º Destacados vigentes
    case when p.destacado = true and p.destacado_hasta > now() then 0 else 1 end,
    p.destacado_hasta desc nulls last,
    -- 3º Normales por fecha
    p.creado_en desc
  limit p_limite
  offset p_offset;
end;
$$;

-- 3. Función RPC: obtener productos destacados (para home)
create or replace function obtener_destacados_home(
  p_limite integer default 8
)
returns table (
  id uuid,
  user_id uuid,
  titulo text,
  descripcion text,
  categoria_id integer,
  subcategoria text,
  marca text,
  modelo text,
  estado text,
  precio_usd decimal,
  ubicacion_estado text,
  ubicacion_ciudad text,
  imagen_url text,
  imagenes text[],
  activo boolean,
  destacado boolean,
  destacado_hasta timestamp with time zone,
  visitas integer,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  boosteado_en timestamp with time zone
)
language plpgsql
stable
as $$
begin
  return query
  select
    p.id, p.user_id, p.titulo, p.descripcion, p.categoria_id,
    p.subcategoria, p.marca, p.modelo, p.estado, p.precio_usd,
    p.ubicacion_estado, p.ubicacion_ciudad, p.imagen_url,
    p.imagenes, p.activo, p.destacado, p.destacado_hasta,
    p.visitas, p.creado_en, p.actualizado_en, p.boosteado_en
  from productos p
  where p.activo = true
    and p.destacado = true
    and p.destacado_hasta > now()
  order by p.destacado_hasta desc
  limit p_limite;
end;
$$;

-- 4. Función RPC: usar crédito para BOOST (sube al #1)
create or replace function usar_boost(
  p_producto_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_balance integer;
  v_owner uuid;
begin
  -- Verificar que el producto pertenece al usuario
  select user_id into v_owner from productos where id = p_producto_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  -- Verificar balance
  select credito_balance into v_balance from perfiles where id = p_user_id;
  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes');
  end if;

  -- Aplicar boost
  update productos set boosteado_en = now() where id = p_producto_id;

  -- Descontar crédito
  update perfiles set credito_balance = credito_balance - 1 where id = p_user_id;

  -- Registrar transacción
  insert into transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (p_user_id, 'gasto', 1, 'boost', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance - 1);
end;
$$;

-- 5. Función RPC: usar créditos para DESTACADO
create or replace function usar_destacado(
  p_producto_id uuid,
  p_user_id uuid,
  p_horas integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_balance integer;
  v_owner uuid;
  v_costo integer;
begin
  -- Verificar producto
  select user_id into v_owner from productos where id = p_producto_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  -- Calcular costo
  v_costo := case
    when p_horas <= 12 then 4
    when p_horas <= 24 then 6
    else 10
  end;

  -- Verificar balance
  select credito_balance into v_balance from perfiles where id = p_user_id;
  if v_balance < v_costo then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes (necesitas ' || v_costo || ')');
  end if;

  -- Activar destacado
  update productos
  set destacado = true,
      destacado_hasta = now() + (p_horas || ' hours')::interval
  where id = p_producto_id;

  -- Descontar créditos
  update perfiles set credito_balance = credito_balance - v_costo where id = p_user_id;

  -- Registrar transacción
  insert into transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (p_user_id, 'gasto', v_costo, 'destacado_' || p_horas || 'h', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance - v_costo, 'hasta', now() + (p_horas || ' hours')::interval);
end;
$$;

-- 6. Función RPC: aprobar transacción y añadir créditos (admin)
create or replace function aprobar_transaccion(
  p_transaccion_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_monto integer;
  v_estado text;
  v_tipo text;
begin
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

-- 7. Habilitar llamadas RPC al anon (ya están habilitadas por defecto con security definer)
grant execute on function obtener_productos_ordenados to anon, authenticated;
grant execute on function obtener_destacados_home to anon, authenticated;
grant execute on function usar_boost to authenticated;
grant execute on function usar_destacado to authenticated;
grant execute on function aprobar_transaccion to authenticated;
