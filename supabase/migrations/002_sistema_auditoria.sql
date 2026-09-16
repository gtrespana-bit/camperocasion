-- Sistema de Auditoría
-- Registra automáticamente cambios en tablas críticas

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla_afectada TEXT NOT NULL,
  operacion TEXT NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id UUID,
  datos_antiguos JSONB,
  datos_nuevos JSONB,
  ip_address TEXT,
  user_agent TEXT,
  fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha_registro DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_operacion ON auditoria(operacion);

-- Función genérica para registrar auditoría
CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id UUID;
  v_datos_antiguos JSONB;
  v_datos_nuevos JSONB;
BEGIN
  -- Extraer usuario_id según la tabla
  IF TG_TABLE_NAME = 'productos' THEN
    v_usuario_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'perfiles' THEN
    v_usuario_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'mensajes' THEN
    v_usuario_id := COALESCE(NEW.remitente_id, OLD.remitente_id);
  ELSIF TG_TABLE_NAME = 'transacciones_creditos' THEN
    v_usuario_id := COALESCE(NEW.user_id, OLD.user_id);
  END IF;

  -- Preparar datos según operación
  IF TG_OP = 'INSERT' THEN
    v_datos_nuevos := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_datos_antiguos := to_jsonb(OLD);
    v_datos_nuevos := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_datos_antiguos := to_jsonb(OLD);
  END IF;

  -- Insertar registro de auditoría
  INSERT INTO auditoria (
    tabla_afectada,
    operacion,
    usuario_id,
    datos_antiguos,
    datos_nuevos
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_usuario_id,
    v_datos_antiguos,
    v_datos_nuevos
  );

  -- Retornar el registro apropiado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para tablas críticas

-- Productos: registrar cambios de precio, estado, moderación
DROP TRIGGER IF EXISTS trigger_auditoria_productos ON productos;
CREATE TRIGGER trigger_auditoria_productos
AFTER INSERT OR UPDATE OR DELETE ON productos
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Perfiles: registrar cambios de verificación, créditos
DROP TRIGGER IF EXISTS trigger_auditoria_perfiles ON perfiles;
CREATE TRIGGER trigger_auditoria_perfiles
AFTER INSERT OR UPDATE OR DELETE ON perfiles
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Mensajes: registrar envío y eliminación de mensajes
DROP TRIGGER IF EXISTS trigger_auditoria_mensajes ON mensajes;
CREATE TRIGGER trigger_auditoria_mensajes
AFTER INSERT OR UPDATE OR DELETE ON mensajes
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Transacciones de créditos: registrar todas las transacciones
DROP TRIGGER IF EXISTS trigger_auditoria_transacciones ON transacciones_creditos;
CREATE TRIGGER trigger_auditoria_transacciones
AFTER INSERT OR UPDATE OR DELETE ON transacciones_creditos
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Política RLS para auditoría
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden ver auditoría (usando service_role en API)
CREATE POLICY "Admin puede ver auditoría" ON auditoria
FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- Nadie puede modificar auditoría manualmente (solo triggers)
CREATE POLICY "Nadie puede insertar auditoría" ON auditoria
FOR INSERT WITH CHECK (false);

CREATE POLICY "Nadie puede actualizar auditoría" ON auditoria
FOR UPDATE USING (false);

CREATE POLICY "Nadie puede eliminar auditoría" ON auditoria
FOR DELETE USING (false);

-- Vista útil para ver cambios recientes
CREATE OR REPLACE VIEW auditoria_resumen AS
SELECT 
  fecha_registro,
  tabla_afectada,
  operacion,
  usuario_id,
  CASE 
    WHEN operacion = 'INSERT' THEN 'Nuevo registro'
    WHEN operacion = 'UPDATE' THEN 'Modificado'
    WHEN operacion = 'DELETE' THEN 'Eliminado'
  END as descripcion,
  datos_nuevos->>'titulo' as titulo_producto,
  datos_antiguos->>'precio_usd' as precio_anterior,
  datos_nuevos->>'precio_usd' as precio_nuevo
FROM auditoria
ORDER BY fecha_registro DESC
LIMIT 100;

-- Función para limpiar auditoría antigua (más de 90 días)
CREATE OR REPLACE FUNCTION limpiar_auditoria_antigua()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM auditoria
  WHERE fecha_registro < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario explicativo
COMMENT ON TABLE auditoria IS 'Sistema de auditoría automática para rastrear cambios en tablas críticas';
COMMENT ON COLUMN auditoria.tabla_afectada IS 'Nombre de la tabla donde ocurrió el cambio';
COMMENT ON COLUMN auditoria.operacion IS 'Tipo de operación: INSERT, UPDATE, DELETE';
COMMENT ON COLUMN auditoria.usuario_id IS 'ID del usuario que realizó el cambio';
COMMENT ON COLUMN auditoria.datos_antiguos IS 'Datos antes del cambio (UPDATE/DELETE)';
COMMENT ON COLUMN auditoria.datos_nuevos IS 'Datos después del cambio (INSERT/UPDATE)';
COMMENT ON COLUMN auditoria.fecha_registro IS 'Timestamp del cambio';
