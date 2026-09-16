-- Migration 012: Sistema de Reputación del Vendedor
-- Calcula automáticamente: nivel_confianza, badges_automaticos

-- 1. Columnas nuevas en perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS nivel_confianza SMALLINT DEFAULT 0;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS badges_automaticos TEXT[] DEFAULT '{}';
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS tasa_respuesta SMALLINT DEFAULT NULL;

-- 2. Trigger para calcular reputación automáticamente al cambiar datos relevantes

CREATE OR REPLACE FUNCTION fn_calcular_reputacion()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_verificado BOOLEAN;
  v_verificado_desde TIMESTAMPTZ;
  v_promedio_stars NUMERIC;
  v_num_resenas INTEGER;
  v_num_pubs INTEGER;
  v_num_pubs_vendidas INTEGER;
  v_antiguedad_dias INTEGER;
  v_ultima_pub TIMESTAMPTZ;
  v_score INTEGER := 0;
  v_badges TEXT[] := '{}';
BEGIN
  v_user_id := COALESCE(NEW.id, OLD.id);

  -- Obtener datos del perfil
  SELECT verificado, verificado_desde,
         EXTRACT(DAY FROM NOW() - creado_en)::INTEGER
    INTO v_verificado, v_verificado_desde, v_antiguedad_dias
    FROM perfiles
    WHERE id = v_user_id;

  -- Obtener reseñas del vendedor
  SELECT COALESCE(AVG(puntuacion), 0), COUNT(*)
    INTO v_promedio_stars, v_num_resenas
    FROM resenas
    WHERE vendedor_id = v_user_id;

  -- Obtener publicaciones
  SELECT COUNT(*) INTO v_num_pubs
    FROM productos WHERE user_id = v_user_id AND activo = true;

  SELECT COUNT(*) INTO v_num_pubs_vendidas
    FROM productos WHERE user_id = v_user_id AND activo = false
      AND estado_moderacion != 'rechazado';

  -- Última actividad (última publicación o actualización de perfil)
  SELECT MAX(creado_en) INTO v_ultima_pub
    FROM productos WHERE user_id = v_user_id;

  -- ===== CALCULAR SCORE =====

  -- Verificación: 0, 10, o 20 pts
  IF v_verificado THEN v_score := v_score + 20;
  END IF;

  -- Reseñas (máx 30 pts)
  IF v_num_resenas >= 10 AND v_promedio_stars >= 4.5 THEN
    v_score := v_score + 30;
  ELSIF v_num_resenas >= 5 AND v_promedio_stars >= 4.0 THEN
    v_score := v_score + 20;
  ELSIF v_num_resenas >= 1 AND v_promedio_stars >= 3.5 THEN
    v_score := v_score + 10;
  ELSIF v_num_resenas >= 1 THEN
    v_score := v_score + 5;
  END IF;

  -- Antigüedad (máx 15 pts)
  IF v_antiguedad_dias >= 365 THEN v_score := v_score + 15;
  ELSIF v_antiguedad_dias >= 90 THEN v_score := v_score + 10;
  ELSIF v_antiguedad_dias >= 30 THEN v_score := v_score + 5;
  END IF;

  -- Actividad: publicaciones activas (máx 15 pts)
  IF v_num_pubs >= 20 THEN v_score := v_score + 15;
  ELSIF v_num_pubs >= 10 THEN v_score := v_score + 10;
  ELSIF v_num_pubs >= 5 THEN v_score := v_score + 5;
  ELSIF v_num_pubs >= 1 THEN v_score := v_score + 3;
  END IF;

  -- Publicaciones vendidas (máx 10 pts)
  IF v_num_pubs_vendidas >= 20 THEN v_score := v_score + 10;
  ELSIF v_num_pubs_vendidas >= 10 THEN v_score := v_score + 7;
  ELSIF v_num_pubs_vendidas >= 5 THEN v_score := v_score + 4;
  ELSIF v_num_pubs_vendidas >= 1 THEN v_score := v_score + 2;
  END IF;

  -- Últimamente activo (últimos 7 días): +10pts
  IF v_ultima_pub IS NOT NULL AND v_ultima_pub > NOW() - INTERVAL '7 days' THEN
    v_score := v_score + 10;
  END IF;

  -- ===== NIVEL (0-5 estrellas) =====
  -- Score máximo: 100
  -- 0-9: 0 estrellas (novato)
  -- 10-24: 1 estrella
  -- 25-44: 2 estrellas
  -- 45-64: 3 estrellas
  -- 65-84: 4 estrellas
  -- 85+: 5 estrellas
  IF v_score >= 85 THEN v_score := 5;
  ELSIF v_score >= 65 THEN v_score := 4;
  ELSIF v_score >= 45 THEN v_score := 3;
  ELSIF v_score >= 25 THEN v_score := 2;
  ELSIF v_score >= 10 THEN v_score := 1;
  ELSE v_score := 0;
  END IF;

  -- ===== BADGES AUTOMÁTICOS =====
  -- Vendedor Activo (publicó en los últimos 7 días y tiene +3 pubs)
  IF v_num_pubs >= 3 AND v_ultima_pub IS NOT NULL AND v_ultima_pub > NOW() - INTERVAL '7 days' THEN
    v_badges := array_append(v_badges, 'vendedor_activo');
  END IF;

  -- +50 ventas
  IF v_num_pubs_vendidas >= 50 THEN
    v_badges := array_append(v_badges, '50_ventas');
  ELSIF v_num_pubs_vendidas >= 20 THEN
    v_badges := array_append(v_badges, '20_ventas');
  ELSIF v_num_pubs_vendidas >= 10 THEN
    v_badges := array_append(v_badges, '10_ventas');
  END IF;

  -- +100 publicaciones
  IF v_num_pubs + v_num_pubs_vendidas >= 100 THEN
    v_badges := array_append(v_badges, '100_publicaciones');
  ELSIF v_num_pubs + v_num_pubs_vendidas >= 50 THEN
    v_badges := array_append(v_badges, '50_publicaciones');
  ELSIF v_num_pubs + v_num_pubs_vendidas >= 20 THEN
    v_badges := array_append(v_badges, '20_publicaciones');
  END IF;

  -- Reseñas positivas (5+ con 4.0+)
  IF v_num_resenas >= 10 AND v_promedio_stars >= 4.5 THEN
    v_badges := array_append(v_badges, 'top_vendedor');
  ELSIF v_num_resenas >= 5 AND v_promedio_stars >= 4.0 THEN
    v_badges := array_append(v_badges, 'buena_reputacion');
  END IF;

  -- Actualizar perfil
  UPDATE perfiles
  SET nivel_confianza = v_score,
      badges_automaticos = v_badges,
      ultima_actividad = COALESCE(v_ultima_pub, actualizado_en)
  WHERE id = v_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers: disparar reputación cuando cambien datos relevantes

-- Después de cualquier update en perfiles
DROP TRIGGER IF EXISTS trg_calc_reputacion ON perfiles;
CREATE TRIGGER trg_calc_reputacion
  AFTER INSERT OR UPDATE ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_calcular_reputacion();

-- Después de insertar/rechazar producto (cambia reputación vendedor)
DROP TRIGGER IF EXISTS trg_calc_reputacion_prod ON productos;
CREATE TRIGGER trg_calc_reputacion_prod
  AFTER INSERT OR UPDATE OF activo, estado_moderacion ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_calcular_reputacion();

-- Después de insertar reseña
DROP TRIGGER IF EXISTS trg_calc_reputacion_resena ON resenas;
CREATE TRIGGER trg_calc_reputacion_resena
  AFTER INSERT OR UPDATE ON resenas
  FOR EACH ROW
  EXECUTE FUNCTION fn_calcular_reputacion();

-- 3. Calcular reputación para todos los usuarios existentes
SELECT id FROM perfiles
WHERE id IN (SELECT DISTINCT user_id FROM productos WHERE activo = true)
   OR id IN (SELECT DISTINCT vendedor_id FROM resenas);

-- Actualizar manualmente (el trigger se dispara con UPDATE)
UPDATE perfiles SET actualizado_en = actualizado_en;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_perfiles_level ON perfiles(nivel_confianza);
CREATE INDEX IF NOT EXISTS idx_productos_vendido ON productos(user_id, activo, estado_moderacion);
