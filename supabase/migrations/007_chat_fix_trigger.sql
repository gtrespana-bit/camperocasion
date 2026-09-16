-- Fix: Trigger de mensajes robusto contra duplicados de conversación
-- Drop the old trigger and function, recreate with proper guard

DROP TRIGGER IF EXISTS trigger_crear_conversacion ON mensajes;
DROP FUNCTION IF EXISTS crear_conversacion_si_no_existe();

-- Recreate function with proper dedup
CREATE OR REPLACE FUNCTION crear_conversacion_si_no_existe()
RETURNS trigger AS $$
DECLARE
  conv_id uuid;
  u1 uuid;
  u2 uuid;
BEGIN
  -- Normalize: smaller ID first for consistent ordering
  IF NEW.remitente_id < NEW.destinatario_id THEN
    u1 := NEW.remitente_id;
    u2 := NEW.destinatario_id;
  ELSE
    u1 := NEW.destinatario_id;
    u2 := NEW.remitente_id;
  END IF;

  -- Buscar conversacion existente (ordenado para evitar duplicados)
  SELECT id INTO conv_id FROM conversaciones
  WHERE 
    ((user1_id = u1 AND user2_id = u2)
     OR (user1_id = u2 AND user2_id = u1))
    AND (producto_id = NEW.producto_id
         OR (producto_id IS NULL AND NEW.producto_id IS NULL))
  ORDER BY creado_en ASC
  LIMIT 1;

  IF conv_id IS NULL THEN
    -- Create always with normalized order to prevent OR-direction dups
    INSERT INTO conversaciones (user1_id, user2_id, producto_id)
    VALUES (u1, u2, NEW.producto_id)
    RETURNING id INTO conv_id;
  END IF;

  NEW.conversacion_id = conv_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_crear_conversacion
  BEFORE INSERT ON mensajes
  FOR EACH ROW
  EXECUTE FUNCTION crear_conversacion_si_no_existe();

-- Drop old unique constraint if it exists and recreate properly
ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS uq_conversacion;
ALTER TABLE conversaciones
  ADD CONSTRAINT uq_conversacion UNIQUE (user1_id, user2_id, producto_id);
