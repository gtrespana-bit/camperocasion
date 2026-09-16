-- ============================================================================
-- VendeT — Las modificaciones de productos pasan por API server-side
-- Fecha: 2026-08-01
--
-- El editor web ya no debe escribir productos directamente con la anon key.
-- La API aplica ownership, validación, sanitización y moderación.
-- Service role y triggers siguen pudiendo actualizar el sistema.
-- ============================================================================

-- Revocar tanto privilegios de tabla como los grants por columna concedidos por
-- la migración de hardening anterior.
revoke update on table public.productos from anon, authenticated;
revoke update (
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
) on table public.productos from anon, authenticated;

-- Un producto vendido no puede volver a estar activo por una escritura directa
-- o por un bug del cliente. Se marca NOT VALID para no bloquear la migración si
-- existen filas históricas incoherentes; sí protege las filas nuevas y futuras.
alter table public.productos
  drop constraint if exists productos_vendido_activo_check;

alter table public.productos
  add constraint productos_vendido_activo_check
  check (vendido is not true or activo is not true)
  not valid;
