-- Migration 019: Full-text search con tsvector
-- Reemplaza el ilike() lento con búsqueda full-text indexada

-- 1. Columna tsvector para búsqueda en titulo + descripcion
ALTER TABLE productos ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(descripcion, '')), 'B')
  ) STORED;

-- 2. Índice GIN para búsqueda rápida (O(log n) en vez de O(n))
CREATE INDEX IF NOT EXISTS idx_productos_search ON productos USING GIN (search_vector);

-- 3. Función RPC para búsqueda full-text con ranking de relevancia
-- Devuelve productos ordenados por: boost > destacados > relevancia ts_rank > fecha
-- Límite de 1000 resultados (suficiente para cualquier búsqueda real)
CREATE OR REPLACE FUNCTION buscar_productos(
  p_query TEXT,
  p_categoria_id INT DEFAULT NULL,
  p_subcategoria TEXT DEFAULT NULL,
  p_marca TEXT DEFAULT NULL,
  p_estado_product TEXT DEFAULT NULL,
  p_ubicacion_estado TEXT DEFAULT NULL,
  p_ubicacion_ciudad TEXT DEFAULT NULL,
  p_precio_min NUMERIC DEFAULT NULL,
  p_precio_max NUMERIC DEFAULT NULL,
  p_orden TEXT DEFAULT '',
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  titulo TEXT,
  descripcion TEXT,
  precio_usd NUMERIC,
  estado TEXT,
  imagen_url TEXT,
  imagenes TEXT[],
  ubicacion_estado TEXT,
  ubicacion_ciudad TEXT,
  creado_en TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ,
  visitas INT,
  activo BOOLEAN,
  destacado BOOLEAN,
  destacado_hasta TIMESTAMPTZ,
  boosteado_en TIMESTAMPTZ,
  categoria_id INT,
  subcategoria TEXT,
  marca TEXT,
  modelo TEXT,
  seller_nombre TEXT,
  seller_telefono TEXT,
  estado_moderacion TEXT,
  vendedor_verificado BOOLEAN,
  relevance NUMERIC,
  match_count INT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH matched AS (
    SELECT
      p.*,
      CASE WHEN p_query IS NOT NULL AND p_query <> ''
           THEN ts_rank_cd(
             p.search_vector,
             plainto_tsquery('spanish', p_query),
             32
           )
           ELSE 0
      END AS ts_rel
    FROM productos p
    WHERE p.activo = true
      AND (p.estado_moderacion IS NULL OR p.estado_moderacion = 'aprobado')
      AND (
        p_query IS NULL
        OR p_query = ''
        OR p.search_vector @@ plainto_tsquery('spanish', p_query)
      )
      AND (p_categoria_id IS NULL OR p.categoria_id = p_categoria_id)
      AND (p_subcategoria IS NULL OR p.subcategoria = p_subcategoria)
      AND (p_marca IS NULL OR p.marca = p_marca)
      AND (p_estado_product IS NULL OR p.estado = p_estado_product)
      AND (p_ubicacion_estado IS NULL OR p.ubicacion_estado = p_ubicacion_estado)
      AND (p_ubicacion_ciudad IS NULL OR p.ubicacion_ciudad = p_ubicacion_ciudad)
      AND (p_precio_min IS NULL OR p.precio_usd >= p_precio_min)
      AND (p_precio_max IS NULL OR p.precio_usd <= p_precio_max)
  ),
  counted AS (
    SELECT count(*) AS total FROM matched
  )
  SELECT
    matched.id, matched.titulo, matched.descripcion, matched.precio_usd,
    matched.estado, matched.imagen_url, matched.imagenes,
    matched.ubicacion_estado, matched.ubicacion_ciudad,
    matched.creado_en, matched.actualizado_en, matched.visitas,
    matched.activo, matched.destacado, matched.destacado_hasta,
    matched.boosteado_en, matched.categoria_id, matched.subcategoria,
    matched.marca, matched.modelo, matched.seller_nombre,
    matched.seller_telefono, matched.estado_moderacion,
    matched.vendedor_verificado,
    matched.ts_rel,
    CASE WHEN p_query IS NOT NULL AND p_query <> ''
         THEN array_length(
           string_to_array(p_query, ' '), ' ')
         ELSE 0
    END,
    counted.total
  FROM matched, counted
  ORDER BY
    CASE WHEN p_orden = 'precio_asc' THEN matched.precio_usd END ASC,
    CASE WHEN p_orden = 'precio_desc' THEN matched.precio_usd END DESC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') THEN
      CASE
        WHEN matched.boosteado_en IS NOT NULL THEN 0
        WHEN matched.destacado = true AND matched.destacado_hasta > now() THEN 1
        ELSE 2
      END
    END ASC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') AND matched.boosteado_en IS NOT NULL
         THEN matched.boosteado_en END DESC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') AND matched.destacado = true AND matched.destacado_hasta > now()
         THEN matched.destacado_hasta END DESC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') AND (matched.boosteado_en IS NULL OR NOT (matched.destacado = true AND matched.destacado_hasta > now()))
         THEN matched.ts_rel
         ELSE 0
    END DESC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') AND (matched.boosteado_en IS NULL OR NOT (matched.destacado = true AND matched.destacado_hasta > now()))
         THEN matched.creado_en
         ELSE NULL
    END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Pobrear search_vector para productos existentes
UPDATE productos SET titulo = titulo WHERE search_vector IS NULL;
