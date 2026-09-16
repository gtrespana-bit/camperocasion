-- ============================================
-- FIX: Conversaciones duplicadas + performance
-- ============================================

-- 1. Migrar columnas existentes de texto a UUID typed
-- (conversaciones.user1_id y user2_id ya son uuid en el schema original)

-- 2. Unique constraint para evitar duplicados
-- Una conversacion por par de usuarios + producto (mismo par + null producto = 1 sola)
ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS uq_conversaciones;
ALTER TABLE conversaciones ADD CONSTRAINT uq_conversaciones UNIQUE (user1_id, user2_id, COALESCE(producto_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Para PostgreSQL < 15 que no soporta COALESCE en unique constraint,
-- hacemos el unique con una columna generada:
ALTER TABLE conversaciones DROP COLUMN IF EXISTS _producto_normalized;
ALTER TABLE conversaciones ADD COLUMN _producto_normalized uuid GENERATED ALWAYS AS (COALESCE(producto_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;
ALTER TABLE conversaciones ADD CONSTRAINT uq_conversaciones UNIQUE (user1_id, user2_id, _producto_normalized);

-- 3. Índices para queries mas rapidas
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuarios ON conversaciones (user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_user2_user1 ON conversaciones (user2_id, user1_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_producto ON conversaciones (producto_id) WHERE producto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_creado ON mensajes (conversacion_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_mensajes_destinatario_leido ON mensajes (destinatario_id, leido);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON mensajes (conversacion_id);
