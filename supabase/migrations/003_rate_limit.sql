-- Rate limiting distribuido
-- Tabla para almacenar contadores de rate limit en Supabase
-- Esto funciona correctamente en Vercel serverless (DB compartida)

CREATE TABLE IF NOT EXISTS rate_limit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,              -- 'producto:create', 'auth:login', etc.
  identifier TEXT NOT NULL,       -- userId o IP address
  ip TEXT,                        -- IP del request (para análisis)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_created ON rate_limit(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON rate_limit(key, identifier, created_at);

-- RLS: nadie puede leer rate_limit directamente
ALTER TABLE rate_limit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nadie lee rate_limit" ON rate_limit FOR SELECT USING (false);
CREATE POLICY "System inserta rate_limit" ON rate_limit FOR INSERT WITH CHECK (true);
CREATE POLICY "System elimina rate_limit" ON rate_limit FOR DELETE USING (true);

-- Función para limpiar registros antiguos (> 24 horas)
CREATE OR REPLACE FUNCTION clean_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM rate_limit
  WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
