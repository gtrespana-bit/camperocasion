-- ============================================
-- FIX: Conversaciones duplicadas + performance
-- ============================================

-- 1. Migrar columnas existentes de texto a UUID typed
-- (conversaciones.user1_id y user2_id ya son uuid en el schema original)

-- 2. Unique constraint para evitar duplicados
-- Una conversacion por par de usuarios + producto (mismo par + null producto = 1 sola)
-- NOTA: una CONSTRAINT UNIQUE de tabla no admite expresiones (COALESCE), por eso
-- se usan dos indices unicos parciales, soportados en todos los PostgreSQL:
ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS uq_conversaciones;
DROP INDEX IF EXISTS uq_conversaciones;
DROP INDEX IF EXISTS uq_conversaciones_null;
-- Limpieza del intento anterior con columna generada
ALTER TABLE conversaciones DROP COLUMN IF EXISTS _producto_normalized;
CREATE UNIQUE INDEX uq_conversaciones      ON conversaciones (user1_id, user2_id, producto_id) WHERE producto_id IS NOT NULL;
CREATE UNIQUE INDEX uq_conversaciones_null ON conversaciones (user1_id, user2_id)               WHERE producto_id IS NULL;

-- 3. Índices para queries mas rapidas
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuarios ON conversaciones (user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_user2_user1 ON conversaciones (user2_id, user1_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_producto ON conversaciones (producto_id) WHERE producto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_creado ON mensajes (conversacion_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_mensajes_destinatario_leido ON mensajes (destinatario_id, leido);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON mensajes (conversacion_id);
