-- ============================================
-- MIGRACIÓN 014: Chat limpio desde cero
-- Drop and recreate conversaciones + mensajes
-- con policies correctas (sin joins rotos)
-- ============================================

-- 1. Drop triggers
DROP TRIGGER IF EXISTS trigger_crear_conversacion ON mensajes;
DROP TRIGGER IF EXISTS trigger_ultimo_mensaje ON mensajes;
DROP FUNCTION IF EXISTS crear_conversacion_si_no_existe();
DROP FUNCTION IF EXISTS actualizar_ultimo_mensaje();

-- 2. Drop policies
DROP POLICY IF EXISTS "Ver mensajes" ON mensajes;
DROP POLICY IF EXISTS "Enviar mensajes" ON mensajes;
DROP POLICY IF EXISTS "Ver conversaciones propias" ON conversaciones;
DROP POLICY IF EXISTS "Crear conversaciones" ON conversaciones;
DROP POLICY IF EXISTS "Actualizar conversaciones" ON conversaciones;
DROP POLICY IF EXISTS "Eliminar conversaciones propias" ON conversaciones;
DROP POLICY IF EXISTS "Eliminar mensajes propios" ON mensajes;

-- 3. Drop tables (cascade borra policies e índices también)
DROP TABLE IF EXISTS mensajes CASCADE;
DROP TABLE IF EXISTS conversaciones CASCADE;

-- 4. Recrear conversaciones
CREATE TABLE conversaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  ultimo_mensaje TEXT,
  ultimo_mensaje_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user1_id != user2_id)
);

CREATE INDEX idx_conv_user1 ON conversaciones(user1_id);
CREATE INDEX idx_conv_user2 ON conversaciones(user2_id);
CREATE UNIQUE INDEX uq_conv_producto ON conversaciones(user1_id, user2_id, producto_id) WHERE producto_id IS NOT NULL;
CREATE UNIQUE INDEX uq_conv_sin_producto ON conversaciones(user1_id, user2_id) WHERE producto_id IS NULL;

-- 5. Recrear mensajes
CREATE TABLE mensajes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversacion_id UUID REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente_id UUID REFERENCES auth.users(id),
  destinatario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  producto_id UUID,
  contenido TEXT NOT NULL,
  leido BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_msg_conv ON mensajes(conversacion_id, creado_en);
CREATE INDEX idx_msg_remitente ON mensajes(remitente_id);
CREATE INDEX idx_msg_destinatario_leido ON mensajes(destinatario_id, leido) WHERE leido = FALSE;

-- 6. Enable RLS
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- 7. RLS conversaciones
CREATE POLICY "conv_select" ON conversaciones FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "conv_insert" ON conversaciones FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "conv_update" ON conversaciones FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "conv_delete" ON conversaciones FOR DELETE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 8. RLS mensajes
-- SELECT: el usuario debe ser parte de la conversacion
CREATE POLICY "msg_select" ON mensajes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversaciones
    WHERE conversaciones.id = mensajes.conversacion_id
    AND (conversaciones.user1_id = auth.uid() OR conversaciones.user2_id = auth.uid())
  ));

-- INSERT: solo verificar que el remitente sea el usuario logueado
-- (sin JOINs — el trigger crea la conversacion si hace falta)
CREATE POLICY "msg_insert" ON mensajes FOR INSERT
  WITH CHECK (auth.uid() = remitente_id);

-- UPDATE: marcar como leído (solo destinatario)
CREATE POLICY "msg_update" ON mensajes FOR UPDATE
  USING (auth.uid() = destinatario_id);

-- DELETE: solo si el usuario es parte de la conversación
CREATE POLICY "msg_delete" ON mensajes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM conversaciones
    WHERE conversaciones.id = mensajes.conversacion_id
    AND (conversaciones.user1_id = auth.uid() OR conversaciones.user2_id = auth.uid())
  ));

-- 9. Trigger: crear conversacion al insertar mensaje
CREATE OR REPLACE FUNCTION crear_conversacion_si_no_existe()
RETURNS TRIGGER AS $$
DECLARE
  v_conv_id UUID;
  v_u1 UUID;
  v_u2 UUID;
BEGIN
  -- Normalizar: menor ID primero
  IF NEW.remitente_id < NEW.destinatario_id THEN
    v_u1 := NEW.remitente_id;
    v_u2 := NEW.destinatario_id;
  ELSE
    v_u1 := NEW.destinatario_id;
    v_u2 := NEW.remitente_id;
  END IF;

  -- Buscar conversación existente
  SELECT id INTO v_conv_id FROM conversaciones
  WHERE user1_id = v_u1 AND user2_id = v_u2
  AND producto_id IS NOT DISTINCT FROM NEW.producto_id
  LIMIT 1;

  -- Si no existe, crearla
  IF v_conv_id IS NULL THEN
    INSERT INTO conversaciones (user1_id, user2_id, producto_id)
    VALUES (v_u1, v_u2, NEW.producto_id)
    RETURNING id INTO v_conv_id;
  END IF;

  -- Si por alguna razón el mensaje ya tiene conversacion_id pero no coincide
  -- con la encontrada/creada, corregirlo
  IF NEW.conversacion_id IS NULL OR NEW.conversacion_id != v_conv_id THEN
    NEW.conversacion_id = v_conv_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crear_conversacion
  BEFORE INSERT ON mensajes
  FOR EACH ROW
  EXECUTE FUNCTION crear_conversacion_si_no_existe();

-- 10. Trigger: actualizar ultimo_mensaje
CREATE OR REPLACE FUNCTION actualizar_ultimo_mensaje()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversaciones
  SET ultimo_mensaje = NEW.contenido,
      ultimo_mensaje_en = NEW.creado_en
  WHERE id = NEW.conversacion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ultimo_mensaje
  AFTER INSERT ON mensajes
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_ultimo_mensaje();
