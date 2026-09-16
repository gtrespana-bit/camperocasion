-- ============================================
-- FIX 1: Conversaciones duplicadas
-- Unique constraint (user1, user2, producto)
-- ============================================

-- Primero limpiar duplicados existentes (mantener el más antiguo)
DELETE FROM conversaciones a USING (
  SELECT MIN(ctid) as ctid, user1_id, user2_id, producto_id
  FROM conversaciones
  GROUP BY user1_id, user2_id, producto_id
  HAVING COUNT(*) > 1
) b
WHERE a.user1_id = b.user1_id
  AND a.user2_id = b.user2_id
  AND (a.producto_id = b.producto_id OR (a.producto_id IS NULL AND b.producto_id IS NULL))
  AND a.ctid <> b.ctid;

-- Añadir unique constraint para evitar duplicados futuros
-- Como PostgreSQL no permite NULL en unique simple, usamos dos constraints parciales
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_con_producto
  ON conversaciones (user1_id, user2_id, producto_id)
  WHERE producto_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_sin_producto
  ON conversaciones (user1_id, user2_id)
  WHERE producto_id IS NULL;

-- ============================================
-- FIX 2: Índice para el trigger (performance)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conv_busqueda
  ON conversaciones (user1_id, user2_id, producto_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_por_conv
  ON mensajes (conversacion_id, creado_en);

-- ============================================
-- FIX 3: Mejorar trigger para evitar race conditions
-- ============================================
CREATE OR REPLACE FUNCTION crear_conversacion_si_no_existe()
RETURNS TRIGGER AS $$
DECLARE
  conv_id UUID;
  v_user1 UUID;
  v_user2 UUID;
BEGIN
  -- Normalizar: el menor user_id siempre va en user1_id
  IF NEW.remitente_id < NEW.destinatario_id THEN
    v_user1 := NEW.remitente_id;
    v_user2 := NEW.destinatario_id;
  ELSE
    v_user1 := NEW.destinatario_id;
    v_user2 := NEW.remitente_id;
  END IF;

  -- Buscar conversación existente (bidireccional)
  SELECT id INTO conv_id FROM conversaciones
  WHERE (
    (user1_id = v_user1 AND user2_id = v_user2)
    OR (user1_id = v_user2 AND user2_id = v_user1)
  )
  AND (
    (producto_id IS NOT NULL AND producto_id = NEW.producto_id)
    OR (producto_id IS NULL AND NEW.producto_id IS NULL)
  )
  ORDER BY creado_en ASC
  LIMIT 1;

  -- Si no existe, crearla
  IF conv_id IS NULL THEN
    INSERT INTO conversaciones (user1_id, user2_id, producto_id)
    VALUES (v_user1, v_user2, NEW.producto_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO conv_id;

    -- Si falló ON CONFLICT (race condition), reintentar fetch
    IF conv_id IS NULL THEN
      SELECT id INTO conv_id FROM conversaciones
      WHERE (
        (user1_id = v_user1 AND user2_id = v_user2)
        OR (user1_id = v_user2 AND user2_id = v_user1)
      )
      AND (
        (producto_id IS NOT NULL AND producto_id = NEW.producto_id)
        OR (producto_id IS NULL AND NEW.producto_id IS NULL)
      )
      ORDER BY creado_en ASC
      LIMIT 1;
    END IF;
  END IF;

  NEW.conversacion_id = conv_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
