--
-- 008_moderacion.sql
-- Sistema de moderación: estado de publicación, tabla denuncias, auto-bloqueo
--

-- 1. Agregar columna de moderación a productos
ALTER TABLE productos 
  ADD COLUMN IF NOT EXISTS estado_moderacion TEXT DEFAULT 'aprobado' 
    CHECK (estado_moderacion IN ('aprobado', 'pendiente', 'revisando', 'rechazado')),
  ADD COLUMN IF NOT EXISTS motivo_moderacion TEXT;

-- 2. Tabla de denuncias (reportes de usuarios)
CREATE TABLE IF NOT EXISTS denuncias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  reportante_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'resuelta', 'invalidada')),
  creada_en TIMESTAMPTZ DEFAULT now(),
  resuelta_en TIMESTAMPTZ,
  administrador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(producto_id, reportante_id)
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_denuncias_producto ON denuncias(producto_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_estado ON denuncias(estado);

-- 3. Trigger: auto-bloquear producto con 3+ reportes
CREATE OR REPLACE FUNCTION fn_bloquear_por_denuncias()
RETURNS TRIGGER AS $$
DECLARE
  conteo INT;
BEGIN
  SELECT COUNT(*) INTO conteo
  FROM denuncias
  WHERE producto_id = NEW.producto_id
    AND estado = 'activa';
  
  IF conteo >= 3 THEN
    UPDATE productos
    SET estado_moderacion = 'rechazado',
        motivo_moderacion = 'Bloqueado automáticamente: ' || conteo || ' denuncias'
    WHERE id = NEW.producto_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bloquear_por_denuncias ON denuncias;
CREATE TRIGGER trg_bloquear_por_denuncias
  AFTER INSERT ON denuncias
  FOR EACH ROW
  EXECUTE FUNCTION fn_bloquear_por_denuncias();

-- 4. RLS Policies para denuncias
ALTER TABLE denuncias ENABLE ROW LEVEL SECURITY;

-- Solo el admin puede ver todas
CREATE POLICY "Admin ve todas las denuncias" ON denuncias
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid()
      AND p.nombre = 'Admin' -- o validar email directamente
    )
  );

-- Usuario puede crear denuncia
CREATE POLICY "Usuarios pueden denunciar" ON denuncias
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Usuario puede ver sus propias denuncias
CREATE POLICY "Usuarios ven sus denuncias" ON denuncias
  FOR SELECT USING (auth.uid() = reportante_id);

-- 5. Productos: solo mostrar aprobados por defecto
-- Nota: El catálogo ya filtra por activo=true, ahora filtra también por estado_moderacion
-- El admin puede ver todos

-- 6. Función para contar denuncias por producto (útil para admin)
CREATE OR REPLACE FUNCTION contar_denuncias_activas(pid UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM denuncias
  WHERE producto_id = pid AND estado = 'activa';
$$ LANGUAGE sql STABLE;

COMMENT ON COLUMN productos.estado_moderacion IS 'Estado de moderación: aprobado, pendiente, revisando, rechazado';
COMMENT ON TABLE denuncias IS 'Denuncias realizadas por usuarios sobre publicaciones';
