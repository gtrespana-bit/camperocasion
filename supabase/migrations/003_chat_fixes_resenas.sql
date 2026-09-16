-- ============================================
-- MIGRATION 003: Chat fixes + Reseñas + Métodos contacto + Foto perfil
-- ============================================

-- ─── FIX CHAT: Unique constraint para conversaciones duplicadas ───

-- Limpiar duplicados existentes (mantener el más antiguo por id)
DELETE FROM conversaciones
WHERE id NOT IN (
  SELECT MIN(id)
  FROM conversaciones
  GROUP BY LEAST(user1_id::text, user2_id::text), GREATEST(user1_id::text, user2_id::text),
           COALESCE(producto_id::text, 'null')
);

-- Unique index bidireccional para conversaciones con producto
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_con_prod
  ON conversaciones (LEAST(user1_id::text, user2_id::text), GREATEST(user1_id::text, user2_id::text), producto_id)
  WHERE producto_id IS NOT NULL;

-- Unique index bidireccional para conversaciones sin producto
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_sin_prod
  ON conversaciones (LEAST(user1_id::text, user2_id::text), GREATEST(user1_id::text, user2_id::text))
  WHERE producto_id IS NULL;

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_mensajes_conv_fecha ON mensajes (conversacion_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_dest_leido ON mensajes (destinatario_id, leido) WHERE leido = false;

-- Mejorar trigger: normalizar user1 < user2 y evitar duplicados
CREATE OR REPLACE FUNCTION crear_conversacion_si_no_existe()
RETURNS TRIGGER AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Buscar conversación existente (bidireccional)
  SELECT id INTO conv_id FROM conversaciones
  WHERE (
    (user1_id = NEW.remitente_id AND user2_id = NEW.destinatario_id)
    OR (user1_id = NEW.destinatario_id AND user2_id = NEW.remitente_id)
  )
  AND (
    (producto_id IS NOT NULL AND producto_id = NEW.producto_id)
    OR (producto_id IS NULL AND NEW.producto_id IS NULL)
  )
  ORDER BY creado_en ASC
  LIMIT 1;

  -- Si no existe, crearla (ON CONFLICT para race conditions)
  IF conv_id IS NULL THEN
    INSERT INTO conversaciones (user1_id, user2_id, producto_id)
    VALUES (NEW.remitente_id, NEW.destinatario_id, NEW.producto_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO conv_id;

    -- Si otra petición la creó entre medias, recuperar
    IF conv_id IS NULL THEN
      SELECT id INTO conv_id FROM conversaciones
      WHERE (
        (user1_id = NEW.remitente_id AND user2_id = NEW.destinatario_id)
        OR (user1_id = NEW.destinatario_id AND user2_id = NEW.remitente_id)
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

-- ─── FIX CHAT: Publicar conversaciones en realtime también ───
-- Asegurarnos que las conversaciones también se publican en realtime
-- (ejecutar en Supabase SQL Editor):
-- alter publication supabase_realtime add table conversaciones;

-- ─── METODOS DE CONTACTO POR PUBLICACIÓN ───

-- Agregar columna a productos para métodos de contacto
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS metodos_contacto JSONB DEFAULT '{"chat": true, "whatsapp": false, "telefono": false, "email": false}';

-- ─── FOTO DE PERFIL ───

ALTER TABLE perfiles
ADD COLUMN IF NOT EXISTS foto_perfil_url TEXT;

-- Nota: también crear bucket "foto_perfil" en Supabase Storage → Settings → Storage → nuevo bucket "foto_perfil" → público

-- ─── SISTEMA DE RESEÑAS ───

CREATE TABLE IF NOT EXISTS resenas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comprador_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  puntuacion INTEGER NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendedor_id, comprador_id, producto_id)
);

-- RLS para reseñas
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver todas las resenas" ON resenas FOR SELECT USING (true);
CREATE POLICY "Insert resenas (comprador)" ON resenas FOR INSERT
  WITH CHECK (auth.uid() = comprador_id);
CREATE POLICY "Editar resenas propias" ON resenas FOR UPDATE
  USING (auth.uid() = comprador_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_resenas_vendedor ON resenas (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_resenas_comprador ON resenas (comprador_id);

-- ─── Trigger: crear perfil (sobreescribe para incluir foto por defecto si se añade en el futuro) ───
CREATE OR REPLACE FUNCTION crear_perfil()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre, telefono, estado, ciudad)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'telefono', ''),
    COALESCE(NEW.raw_user_meta_data->>'estado', ''),
    COALESCE(NEW.raw_user_meta_data->>'ciudad', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
