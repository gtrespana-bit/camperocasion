-- =====================================================
-- 021: Tabla historial de precios + busquedas guardadas
-- =====================================================

-- Historial de precios
CREATE TABLE IF NOT EXISTS historial_precios (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    precio_anterior numeric NOT NULL,
    precio_nuevo numeric NOT NULL,
    creado_en timestamptz DEFAULT now()
);

ALTER TABLE historial_precios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historial_precios: lectura publica"
    ON historial_precios FOR SELECT USING (true);

-- Busquedas guardadas (alertas)
CREATE TABLE IF NOT EXISTS busquedas_guardadas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query text NOT NULL,
    filtros jsonb DEFAULT '{}',
    ultima_notificacion timestamptz,
    activa boolean DEFAULT true,
    creado_en timestamptz DEFAULT now()
);

ALTER TABLE busquedas_guardadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "busquedas_guardadas: users own"
    ON busquedas_guardadas FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Índice para búsqueda de alertas
CREATE INDEX idx_busquedas_guardadas_user ON busquedas_guardadas(user_id, activa);
