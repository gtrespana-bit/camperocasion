-- ============================================================================
-- VendeT — Fase 2: chat y reseñas
--
-- Aplicar después de 202608010001_hardening_integridad.sql.
-- Las escrituras del navegador se trasladan a APIs autenticadas; las políticas
-- dejan de confiar en remitente/destinatario enviados por el cliente.
-- ============================================================================

-- Conversaciones: el navegador solo lee las conversaciones propias. Las crea,
-- modifica y elimina la API después de comprobar la relación con el producto.
revoke insert, update, delete on table public.conversaciones from anon, authenticated;

drop policy if exists "Ver conversaciones propias" on public.conversaciones;
drop policy if exists "Crear conversaciones" on public.conversaciones;
drop policy if exists "conv_insert" on public.conversaciones;
 drop policy if exists "Actualizar conversaciones" on public.conversaciones;
 drop policy if exists "conv_update" on public.conversaciones;
 drop policy if exists "Eliminar conversaciones propias" on public.conversaciones;
 drop policy if exists "conv_delete" on public.conversaciones;

create policy "Ver conversaciones propias" on public.conversaciones
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);

-- Índices únicos con usuarios normalizados. Las migraciones anteriores ya
-- normalizan user1/user2 en el trigger, pero estos índices protegen también las
-- inserciones directas antiguas.
create unique index if not exists uq_conversaciones_par_producto_202608
  on public.conversaciones (user1_id, user2_id, producto_id)
  where producto_id is not null;

create unique index if not exists uq_conversaciones_par_sin_producto_202608
  on public.conversaciones (user1_id, user2_id)
  where producto_id is null;

-- Mensajes: las inserciones y cambios pasan por APIs. La política de inserción
-- conserva una defensa secundaria para clientes antiguos.
revoke insert, update, delete on table public.mensajes from anon, authenticated;

drop policy if exists "Enviar mensajes dentro de conversación propia" on public.mensajes;
drop policy if exists "Ver mensajes de conversaciones propias" on public.mensajes;
drop policy if exists "Enviar mensajes" on public.mensajes;
drop policy if exists "msg_insert" on public.mensajes;
drop policy if exists "Ver mensajes" on public.mensajes;
drop policy if exists "msg_select" on public.mensajes;
drop policy if exists "msg_update" on public.mensajes;
drop policy if exists "Actualizar mensajes" on public.mensajes;

create policy "Ver mensajes de conversaciones propias" on public.mensajes
  for select using (
    exists (
      select 1
      from public.conversaciones c
      where c.id = mensajes.conversacion_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

create policy "Enviar mensajes dentro de conversación propia" on public.mensajes
  for insert with check (
    auth.uid() = remitente_id
    and exists (
      select 1
      from public.conversaciones c
      where c.id = mensajes.conversacion_id
        and (
          (c.user1_id = auth.uid() and c.user2_id = mensajes.destinatario_id)
          or (c.user2_id = auth.uid() and c.user1_id = mensajes.destinatario_id)
        )
    )
  );

-- Reseñas: solo las APIs que validan venta/comprador/vendedor escriben.
revoke insert, update, delete on table public.resenas from anon, authenticated;

-- Mensajes leídos y reseñas requieren un producto vendido real. No se cambia
-- aquí el esquema de datos existentes para evitar borrar histórico.

-- Asegurar que la cola de push no sea una tabla escribible desde el navegador.
alter table if exists public.notificaciones_push enable row level security;
revoke all on table public.notificaciones_push from anon, authenticated;
