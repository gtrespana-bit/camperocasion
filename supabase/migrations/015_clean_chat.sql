-- Eliminar TODOS los mensajes y conversaciones (desde cero)
-- Ejecutar en Supabase SQL Editor

DELETE FROM mensajes;
ALTER SEQUENCE IF EXISTS mensajes_id_seq RESTART WITH 1;

DELETE FROM conversaciones;
ALTER SEQUENCE IF EXISTS conversaciones_id_seq RESTART WITH 1;
