--
-- 009_verificacion.sql -- Sistema de Vendedor Verificado
--

-- 1. Columnas de verificacion en perfiles
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS verificado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verificado_desde TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cedula_foto_url TEXT,
  ADD COLUMN IF NOT EXISTS cedula_numero TEXT,
  ADD COLUMN IF NOT EXISTS pago_movil_telefono TEXT,
  ADD COLUMN IF NOT EXISTS pago_movil_cedula TEXT,
  ADD COLUMN IF NOT EXISTS pago_movil_banco TEXT;

-- 2. Tabla de solicitudes de verificacion
CREATE TABLE IF NOT EXISTS solicitudes_verificacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  pago_movil_telefono TEXT,
  pago_movil_cedula TEXT,
  pago_movil_banco TEXT,
  cedula_foto_frente_url TEXT,
  cedula_foto_dorso_url TEXT,
  mensaje TEXT,
  rechazo_motivo TEXT,
  creada_en TIMESTAMPTZ DEFAULT now(),
  revisada_en TIMESTAMPTZ,
  administrador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Solo permitir una solicitud pendiente o aprobada por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitud_unica_pendiente
  ON solicitudes_verificacion(user_id)
  WHERE estado = 'pendiente';

CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitud_unica_aprobada
  ON solicitudes_verificacion(user_id)
  WHERE estado = 'aprobada';

-- 3. Storage bucket para cedulas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cedulas', 'cedulas', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS Policies para cedulas bucket
CREATE POLICY "Usuarios suben sus propias cedulas" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cedulas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuarios ven sus propias cedulas" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cedulas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admin ve todas las cedulas" ON storage.objects
  FOR SELECT USING (bucket_id = 'cedulas');

-- 4. RLS Policies para solicitudes_verificacion
ALTER TABLE solicitudes_verificacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus solicitudes" ON solicitudes_verificacion;
CREATE POLICY "Usuarios ven sus solicitudes" ON solicitudes_verificacion
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios crean solicitudes" ON solicitudes_verificacion;
CREATE POLICY "Usuarios crean solicitudes" ON solicitudes_verificacion
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin ve todas las solicitudes" ON solicitudes_verificacion;
CREATE POLICY "Admin ve todas las solicitudes" ON solicitudes_verificacion
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin actualiza solicitudes" ON solicitudes_verificacion;
CREATE POLICY "Admin actualiza solicitudes" ON solicitudes_verificacion
  FOR UPDATE USING (true);
