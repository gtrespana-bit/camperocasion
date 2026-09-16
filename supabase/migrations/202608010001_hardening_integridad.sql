-- ============================================================================
-- VendeT — Hardening de permisos e integridad
-- Fecha: 2026-08-01
--
-- Esta migración va DESPUÉS de las migraciones existentes. No elimina datos.
-- Antes de ejecutarla en producción:
--   1. aplicar en staging,
--   2. comprobar que todos los consumidores usan las APIs nuevas,
--   3. verificar los permisos con un usuario anon y uno authenticated.
--
-- Objetivos:
--   - limitar columnas que el navegador puede leer/modificar;
--   - hacer que publicación, créditos, reseñas y archivos sensibles pasen por
--     operaciones de servidor;
--   - corregir operaciones de créditos no atómicas;
--   - permitir solo administradores reales en solicitudes de verificación y
--     denuncias.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Asegurar columnas que esta migración usa
-- ────────────────────────────────────────────────────────────────────────────

alter table public.productos
  add column if not exists especificaciones jsonb,
  add column if not exists metodos_contacto jsonb,
  add column if not exists vendido boolean default false,
  add column if not exists vendido_en text,
  add column if not exists comprador_id uuid references auth.users(id);

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Admins: función segura para reutilizar en RLS
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.admins (
  email text primary key,
  creado_en timestamptz default now()
);

insert into public.admins (email)
values ('gtrespana@gmail.com')
on conflict (email) do nothing;

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Perfiles: columnas públicas separadas de columnas privadas/de negocio
-- ────────────────────────────────────────────────────────────────────────────

 drop policy if exists "Ver perfiles" on public.perfiles;
 drop policy if exists "Editar propio perfil" on public.perfiles;
 drop policy if exists "Insert propio" on public.perfiles;

create policy "Ver perfiles públicos" on public.perfiles
  for select using (true);

create policy "Editar campos propios" on public.perfiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- El cliente solo necesita estos campos para cards, perfiles públicos y avatar.
-- Los campos privados se leen mediante /api/perfil o endpoints admin.
revoke all on table public.perfiles from anon, authenticated;
grant select (
  id,
  nombre,
  estado,
  ciudad,
  whatsapp_disponible,
  verificado,
  verificado_desde,
  nivel_confianza,
  badges_automaticos,
  ultima_actividad,
  creado_en,
  actualizado_en,
  foto_perfil_url
) on table public.perfiles to anon, authenticated;

grant update (nombre, telefono, estado, ciudad)
on table public.perfiles to authenticated;

-- El perfil lo crea el trigger SECURITY DEFINER de auth.users o la API privada.
-- No se permite INSERT directo desde el navegador.
revoke insert on table public.perfiles from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Productos: publicación y campos de sistema pasan por servidor
-- ────────────────────────────────────────────────────────────────────────────

-- El navegador no debe poder insertar productos saltándose moderación ni
-- alterar columnas de promoción, venta o auditoría.
revoke insert, delete, update on table public.productos from anon, authenticated;

grant update (
  titulo,
  descripcion,
  categoria_id,
  subcategoria,
  marca,
  modelo,
  especificaciones,
  estado,
  precio_usd,
  ubicacion_estado,
  ubicacion_ciudad,
  imagen_url,
  imagenes,
  metodos_contacto,
  activo
) on table public.productos to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Créditos y reseñas: solo APIs/RPCs de servidor escriben
-- ────────────────────────────────────────────────────────────────────────────

alter table public.transacciones_creditos
  add column if not exists precio_usd numeric(12,2);

alter table public.transacciones_creditos
  drop constraint if exists transacciones_creditos_tipo_check;

alter table public.transacciones_creditos
  add constraint transacciones_creditos_tipo_check
  check (tipo in ('compra', 'gasto', 'reembolso', 'bienvenida', 'emprendedor', 'admin_manual'));

revoke insert, update, delete on table public.transacciones_creditos from anon, authenticated;

revoke insert, update, delete on table public.resenas from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Denuncias: el reportante debe ser la sesión; admin real puede moderar
-- ────────────────────────────────────────────────────────────────────────────

 drop policy if exists "Admin ve todas las denuncias" on public.denuncias;
 drop policy if exists "Usuarios pueden denunciar" on public.denuncias;
 drop policy if exists "Usuarios ven sus denuncias" on public.denuncias;

create policy "Denuncias visibles para reportante o admin" on public.denuncias
  for select using (auth.uid() = reportante_id or public.is_admin());

create policy "Usuarios denuncian con su propia identidad" on public.denuncias
  for insert
  with check (auth.uid() = reportante_id);

create policy "Admin actualiza denuncias" on public.denuncias
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Verificación: solicitud propia o administrador real
-- ────────────────────────────────────────────────────────────────────────────

 drop policy if exists "Usuarios ven sus solicitudes" on public.solicitudes_verificacion;
 drop policy if exists "Usuarios crean solicitudes" on public.solicitudes_verificacion;
 drop policy if exists "Admin ve todas las solicitudes" on public.solicitudes_verificacion;
 drop policy if exists "Admin actualiza solicitudes" on public.solicitudes_verificacion;

create policy "Usuario ve su solicitud o admin" on public.solicitudes_verificacion
  for select using (auth.uid() = user_id or public.is_admin());

create policy "Usuario crea su propia solicitud" on public.solicitudes_verificacion
  for insert
  with check (auth.uid() = user_id);

create policy "Admin actualiza solicitudes de verificación" on public.solicitudes_verificacion
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin elimina solicitudes de verificación" on public.solicitudes_verificacion
  for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Storage sensible: comprobantes privados y cédulas solo para dueño/admin
-- ────────────────────────────────────────────────────────────────────────────

update storage.buckets
set public = false
where id = 'comprobantes';

 drop policy if exists "Usuarios pueden subir comprobantes" on storage.objects;
 drop policy if exists "Cualquiera puede ver comprobantes" on storage.objects;
 drop policy if exists "Ver comprobantes propios" on storage.objects;

create policy "Usuarios suben sus comprobantes"
on storage.objects for insert
with check (
  bucket_id = 'comprobantes'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Usuarios ven sus comprobantes"
on storage.objects for select
using (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Admin ve comprobantes"
on storage.objects for select
using (bucket_id = 'comprobantes' and public.is_admin());

 drop policy if exists "Admin ve todas las cedulas" on storage.objects;
create policy "Admin ve todas las cedulas"
on storage.objects for select
using (bucket_id = 'cedulas' and public.is_admin());

-- Estas tablas solo se escriben desde APIs con service_role.
revoke all on table public.rate_limit from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;

alter table if exists public.notificaciones_push enable row level security;
revoke all on table public.notificaciones_push from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Visitas atómicas
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.incrementar_visitas(p_producto_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visitas integer;
begin
  update public.productos
  set visitas = coalesce(visitas, 0) + 1
  where id = p_producto_id
    and activo = true
    and (estado_moderacion is null or estado_moderacion in ('aprobado', 'pendiente'))
  returning visitas into v_visitas;

  return coalesce(v_visitas, 0);
end;
$$;

grant execute on function public.incrementar_visitas(uuid) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Créditos atómicos e idempotentes
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.aprobar_transaccion(
  p_transaccion_id uuid,
  p_admin_id uuid default null
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
  v_balance integer;
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'No autorizado: solo administradores');
  end if;

  select user_id, monto, estado, tipo
    into v_user_id, v_monto, v_estado, v_tipo
  from public.transacciones_creditos
  where id = p_transaccion_id
  for update;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Transacción no encontrada');
  end if;
  if v_estado <> 'pendiente' then
    return jsonb_build_object('ok', false, 'error', 'Transacción ya procesada');
  end if;
  if v_tipo <> 'compra' then
    return jsonb_build_object('ok', false, 'error', 'Solo se pueden aprobar compras');
  end if;

  update public.transacciones_creditos
  set estado = 'aprobado'
  where id = p_transaccion_id and estado = 'pendiente';

  update public.perfiles
  set credito_balance = coalesce(credito_balance, 0) + v_monto
  where id = v_user_id
  returning credito_balance into v_balance;

  return jsonb_build_object(
    'ok', true,
    'creditos_anadidos', v_monto,
    'balance', v_balance
  );
end;
$$;

grant execute on function public.aprobar_transaccion(uuid, uuid) to authenticated;
revoke execute on function public.aprobar_transaccion(uuid, uuid) from anon;

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
  v_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  select user_id into v_owner
  from public.productos
  where id = p_producto_id;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
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

  return jsonb_build_object('ok', true, 'balance', v_balance);
end;
$$;

create or replace function public.usar_destacado(
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
  v_owner uuid;
  v_costo integer;
  v_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  v_costo := case p_horas when 12 then 4 when 24 then 6 when 48 then 10 else 0 end;
  if v_costo = 0 then
    return jsonb_build_object('ok', false, 'error', 'Duración no válida');
  end if;

  select user_id into v_owner
  from public.productos
  where id = p_producto_id;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  update public.perfiles
  set credito_balance = credito_balance - v_costo
  where id = auth.uid() and coalesce(credito_balance, 0) >= v_costo
  returning credito_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes');
  end if;

  update public.productos
  set destacado = true,
      destacado_hasta = now() + make_interval(hours => p_horas)
  where id = p_producto_id and user_id = auth.uid();

  insert into public.transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (auth.uid(), 'gasto', v_costo, 'destacado_' || p_horas || 'h', 'aprobado');

  return jsonb_build_object(
    'ok', true,
    'balance', v_balance,
    'hasta', now() + make_interval(hours => p_horas)
  );
end;
$$;

grant execute on function public.usar_boost(uuid, uuid) to authenticated;
grant execute on function public.usar_destacado(uuid, uuid, integer) to authenticated;
revoke execute on function public.usar_boost(uuid, uuid) from anon;
revoke execute on function public.usar_destacado(uuid, uuid, integer) from anon;

create or replace function public.agregar_creditos_admin(
  p_user_id uuid,
  p_cantidad integer,
  p_motivo text default 'Manual admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 10000 then
    return jsonb_build_object('ok', false, 'error', 'Cantidad inválida');
  end if;

  update public.perfiles
  set credito_balance = coalesce(credito_balance, 0) + p_cantidad
  where id = p_user_id
  returning credito_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'Perfil no encontrado');
  end if;

  insert into public.transacciones_creditos (
    user_id, tipo, monto, estado, motivo_registro
  ) values (
    p_user_id, 'admin_manual', p_cantidad, 'aprobado', left(coalesce(p_motivo, 'Manual admin'), 500)
  );

  return jsonb_build_object('ok', true, 'nuevoBalance', v_balance);
end;
$$;

grant execute on function public.agregar_creditos_admin(uuid, integer, text) to authenticated;
revoke execute on function public.agregar_creditos_admin(uuid, integer, text) from anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Evitar que el cálculo de reputación se dispare por sus propios campos
-- ────────────────────────────────────────────────────────────────────────────

 drop trigger if exists trg_calc_reputacion on public.perfiles;
create trigger trg_calc_reputacion
  after insert or update of verificado, verificado_desde on public.perfiles
  for each row execute function public.fn_calcular_reputacion();

-- El trigger de productos sigue recalculando reputación cuando cambia la
-- actividad/moderación, pero la actualización de los campos derivados del
-- perfil ya no vuelve a disparar trg_calc_reputacion.

-- El historial se escribe desde un trigger, no desde el cliente.
create or replace function public.registrar_cambio_precio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.precio_usd is distinct from new.precio_usd
     and old.precio_usd is not null
     and new.precio_usd is not null then
    insert into public.historial_precios (producto_id, precio_anterior, precio_nuevo)
    values (new.id, old.precio_usd, new.precio_usd);
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. Detalle de producto: no filtrar teléfono ni favoritos de otro usuario
-- ────────────────────────────────────────────────────────────────────────────

-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE.
-- Algunas instalaciones antiguas tienen esta función con una firma/retorno
-- diferente, así que se elimina solo la sobrecarga exacta antes de recrearla.
drop function if exists public.obtener_detalle_producto(uuid, uuid);

create function public.obtener_detalle_producto(
  p_producto_id uuid,
  p_user_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_user_id uuid;
  v_vendedor json;
  v_vendidas integer;
  v_activas integer;
  v_resenas_data json;
  v_resenas_count integer;
  v_es_favorito boolean := false;
  v_historial json;
  v_effective_user uuid;
begin
  select user_id into v_producto_user_id
  from public.productos
  where id = p_producto_id
    and activo = true
    and (estado_moderacion is null or estado_moderacion in ('aprobado', 'pendiente'));

  if v_producto_user_id is null then
    return null;
  end if;

  v_effective_user := auth.uid();
  if p_user_id is not null and p_user_id = v_effective_user then
    v_effective_user := p_user_id;
  end if;

  select json_build_object(
    'id', id,
    'nombre', nombre,
    'telefono', case when coalesce(telefono_visible, false) then telefono else null end,
    'ciudad', ciudad,
    'estado', estado,
    'whatsapp_disponible', whatsapp_disponible,
    'telefono_visible', coalesce(telefono_visible, false),
    'email_visible', coalesce(email_visible, false),
    'foto_perfil_url', foto_perfil_url,
    'verificado', verificado,
    'verificado_desde', verificado_desde,
    'nivel_confianza', nivel_confianza,
    'badges_automaticos', badges_automaticos,
    'ultima_actividad', ultima_actividad,
    'creado_en', creado_en
  ) into v_vendedor
  from public.perfiles
  where id = v_producto_user_id;

  select count(*) into v_vendidas
  from public.productos
  where user_id = v_producto_user_id
    and activo = false
    and vendido = true
    and (estado_moderacion is null or estado_moderacion <> 'rechazado');

  select count(*) into v_activas
  from public.productos
  where user_id = v_producto_user_id and activo = true;

  select coalesce(json_agg(json_build_object('puntuacion', puntuacion)), '[]'::json), count(*)
    into v_resenas_data, v_resenas_count
  from public.resenas
  where vendedor_id = v_producto_user_id;

  if v_effective_user is not null then
    select exists(
      select 1 from public.favoritos
      where user_id = v_effective_user and producto_id = p_producto_id
    ) into v_es_favorito;
  end if;

  select coalesce(json_agg(row_data order by row_data->>'creado_en' desc), '[]'::json)
    into v_historial
  from (
    select json_build_object(
      'id', id,
      'precio_anterior', precio_anterior,
      'precio_nuevo', precio_nuevo,
      'creado_en', creado_en
    ) as row_data
    from public.historial_precios
    where producto_id = p_producto_id
    order by creado_en desc
    limit 10
  ) history;

  return json_build_object(
    'vendedor', v_vendedor,
    'stats', json_build_object(
      'vendidas', v_vendidas,
      'activas', v_activas,
      'resenasCount', v_resenas_count,
      'resenasAvg', coalesce((select avg(puntuacion) from public.resenas where vendedor_id = v_producto_user_id), 0)
    ),
    'totalResenas', v_resenas_count,
    'esFavorito', v_es_favorito,
    'historial', v_historial
  );
end;
$$;

grant execute on function public.obtener_detalle_producto(uuid, uuid) to anon, authenticated;
