-- ============================================================================
-- VendeT — Fix: fn_calcular_reputacion como SECURITY DEFINER
-- Fecha: 2026-08-01
--
-- Contexto
-- --------
-- La migración 202608010001_hardening_integridad.sql revocó a `authenticated`
-- el UPDATE de las columnas de negocio de `perfiles`
-- (nivel_confianza, badges_automaticos, ultima_actividad), dejando únicamente
-- (nombre, telefono, estado, ciudad).
--
-- Sin embargo, fn_calcular_reputacion() (migración 012_reputacion.sql) sigue
-- siendo una función normal (SECURITY INVOKER). Se dispara desde triggers sobre
-- `productos` (trg_calc_reputacion_prod) y `resenas`, además de `perfiles`.
--
-- Cuando un usuario edita un producto (el UPDATE incluye `activo`), el trigger
-- de productos ejecuta fn_calcular_reputacion(), que intenta:
--     UPDATE perfiles SET nivel_confianza, badges_automaticos, ultima_actividad
-- y eso queda DENEGADO por la restricción de columnas → 403
-- "permission denied for table perfiles", rompiendo el guardado.
--
-- Solución
-- --------
-- Convertir fn_calcular_reputacion() en SECURITY DEFINER con search_path fijo,
-- para que el recálculo de reputación corra como el propietario de la tabla y
-- pueda escribir los campos derivados pese a la restricción de columnas del
-- navegador. La reputación es un campo calculado por el servidor, no debe
-- depender de los privilegios del usuario que dispara el trigger.
--
-- Esta migración va DESPUÉS de 202608010001_hardening_integridad.sql.
-- Probar en staging antes de producción.
-- ============================================================================

-- Configura el contexto de ejecución como definer con search_path fijo a public
-- (mismo patrón hardened usado en el resto de RPCs de la migración de integridad).
alter function public.fn_calcular_reputacion() security definer;
alter function public.fn_calcular_reputacion() set search_path = public;

-- El propietario por defecto ya tiene los privilegios necesarios sobre public.perfiles
-- para escribir nivel_confianza, badges_automaticos y ultima_actividad.
