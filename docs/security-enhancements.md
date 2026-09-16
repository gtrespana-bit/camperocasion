# Sugerencias de Mejora de Seguridad

Este documento describe posibles mejoras de seguridad para el proyecto Marketplace VZLA que pueden implementarse en el futuro.

## 1. Políticas Adicionales para Tablas Específicas

### Tabla `resenas` (si existe)
```sql
-- Política para reseñas públicas
CREATE POLICY "Ver reseñas públicas" ON resenas 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM productos p 
    WHERE p.id = resenas.producto_id AND p.activo = false  -- Producto debe estar vendido/inactivo
  )
);

-- Política para prevenir auto-resenas
CREATE POLICY "No auto-resenas" ON resenas
FOR INSERT WITH CHECK (
  (SELECT user_id FROM productos WHERE id = producto_id) != evaluador_id
);
```

### Tabla `productos`
```sql
-- Política de rate limiting para prevenir spam de publicaciones
CREATE POLICY "Rate limit productos" ON productos 
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND 
  (
    SELECT COUNT(*) 
    FROM productos 
    WHERE user_id = auth.uid() 
    AND creado_en > NOW() - INTERVAL '1 day'
  ) < 50  -- Máximo 50 productos por día
);

-- Política para administradores
CREATE POLICY "Admin gestionar productos" ON productos 
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'  -- Requiere rol de administrador
);
```

## 2. Validación de Datos de Entrada

### Validación en API Routes
Asegurar que los endpoints de API validen correctamente los datos recibidos:

```typescript
// Ejemplo para validación en /api/publicar/route.ts
const validateProductData = (data: any) => {
  // Validar campos obligatorios
  if (!data.titulo || data.titulo.length < 3 || data.titulo.length > 100) {
    throw new Error('Título inválido');
  }
  
  // Validar precio
  if (typeof data.precio_usd !== 'number' || data.precio_usd <= 0) {
    throw new Error('Precio inválido');
  }
  
  // Validar estado
  const validStates = ['Nuevo', 'Como nuevo', 'Bueno', 'Usado', 'Para repuestos'];
  if (!validStates.includes(data.estado)) {
    throw new Error('Estado inválido');
  }
  
  // Validar ubicación
  if (!data.ubicacion_estado || !data.ubicacion_ciudad) {
    throw new Error('Ubicación inválida');
  }
};
```

## 3. Auditoría y Logging

### Tabla de auditoría
```sql
-- Crear tabla para registro de actividades importantes
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla_afectada TEXT,
  operacion TEXT,  -- 'INSERT', 'UPDATE', 'DELETE'
  usuario_id UUID,
  datos_antiguos JSONB,
  datos_nuevos JSONB,
  fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para registrar actividades importantes
CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO auditoria (tabla_afectada, operacion, usuario_id, datos_nuevos)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.user_id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria (tabla_afectada, operacion, usuario_id, datos_antiguos, datos_nuevos)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.user_id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria (tabla_afectada, operacion, usuario_id, datos_antiguos)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.user_id, to_jsonb(OLD));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas sensibles (opcional)
-- CREATE TRIGGER trigger_auditoria_perfiles
--   AFTER INSERT OR UPDATE OR DELETE ON perfiles
--   FOR EACH ROW EXECUTE PROCEDURE registrar_auditoria();
```

## 4. Monitoreo de Actividades Sospechosas

### Posibles indicadores de actividad sospechosa:
- Más de 10 productos publicados en menos de 5 minutos
- Intentos repetidos de acceso a recursos no autorizados
- Cambios inusuales en perfiles de usuario
- Patrones inusuales de mensajería

### Implementación:
```typescript
// Ejemplo de servicio para detectar actividad sospechosa
class SuspiciousActivityDetector {
  static async checkUserActivity(userId: string) {
    // Verificar publicaciones rápidas
    const recentPosts = await supabase
      .from('productos')
      .select('*')
      .eq('user_id', userId)
      .gte('creado_en', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Últimos 5 minutos
    
    if (recentPosts.data && recentPosts.data.length > 10) {
      // Registrar actividad sospechosa
      await this.reportSuspiciousActivity(userId, 'High frequency product posting');
    }
  }
  
  static async reportSuspiciousActivity(userId: string, reason: string) {
    // Enviar alerta al sistema de administración
    console.warn(`Suspicious activity detected for user ${userId}: ${reason}`);
    // Aquí se podría enviar una notificación al equipo de moderación
  }
}
```

## 5. Consideraciones de Seguridad Futuras

### Autenticación de Dos Factores (2FA)
- Considerar implementar 2FA para cuentas de alto valor o administradores

### Rate Limiting en API
- Implementar rate limiting más sofisticado en endpoints sensibles
- Considerar uso de Redis para almacenamiento eficiente de contadores

### Validación de Imágenes
- Implementar validación de imágenes subidas para prevenir malware
- Escanear imágenes antes de almacenarlas

### Encriptación de Datos Sensibles
- Considerar encriptación adicional para datos muy sensibles
- Implementar encriptación de lado del cliente para datos críticos

## 6. Recomendaciones de Implementación

### Implementación Gradual
1. **Prioridad Alta**: Validación de datos en endpoints API
2. **Prioridad Media**: Documentación de políticas RLS
3. **Prioridad Baja**: Sistema de auditoría y monitoreo

### Pruebas de Seguridad
- Realizar pruebas de penetración regulares
- Implementar pruebas de seguridad automatizadas
- Revisar periódicamente las políticas RLS

### Monitoreo Continuo
- Implementar alertas para actividades inusuales
- Revisar logs de seguridad regularmente
- Actualizar políticas según nuevas amenazas detectadas