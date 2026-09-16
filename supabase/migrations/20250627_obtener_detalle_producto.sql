-- ============================================================
-- FUNCIÓN RPC: obtener_detalle_producto
-- Consolida 6 queries del cliente en 1 solo round-trip
-- ============================================================
-- Parámetros:
--   p_producto_id: UUID del producto
--   p_user_id: UUID del usuario actual (NULL si no está logueado)
--
-- Retorna: JSON con vendedor, stats, reseñas, favorito, historial
-- ============================================================

CREATE OR REPLACE FUNCTION obtener_detalle_producto(
  p_producto_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendedor JSON;
  v_vendidas INT;
  v_activas INT;
  v_resenas_data JSON;
  v_resenas_count INT;
  v_es_favorito BOOLEAN := FALSE;
  v_historial JSON;
  v_producto_user_id UUID;
BEGIN
  -- Obtener user_id del producto
  SELECT user_id INTO v_producto_user_id
  FROM productos
  WHERE id = p_producto_id;

  IF v_producto_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Perfil vendedor
  SELECT json_build_object(
    'id', id,
    'nombre', nombre,
    'telefono', telefono,
    'ciudad', ciudad,
    'estado', estado,
    'whatsapp_disponible', whatsapp_disponible,
    'telefono_visible', telefono_visible,
    'email_visible', email_visible,
    'foto_perfil_url', foto_perfil_url,
    'verificado', verificado,
    'verificado_desde', verificado_desde,
    'nivel_confianza', nivel_confianza,
    'badges_automaticos', badges_automaticos,
    'ultima_actividad', ultima_actividad,
    'creado_en', creado_en
  ) INTO v_vendedor
  FROM perfiles
  WHERE id = v_producto_user_id;

  -- 2a. Count productos vendidos (no activos, no rechazados)
  SELECT COUNT(*) INTO v_vendidas
  FROM productos
  WHERE user_id = v_producto_user_id
    AND activo = FALSE
    AND (estado_moderacion IS NULL OR estado_moderacion != 'rechazado');

  -- 2b. Count productos activos
  SELECT COUNT(*) INTO v_activas
  FROM productos
  WHERE user_id = v_producto_user_id
    AND activo = TRUE;

  -- 2c. Reseñas: datos para promedio + count
  SELECT
    COALESCE(json_agg(json_build_object('puntuacion', puntuacion)), '[]'::json),
    COUNT(*)
  INTO v_resenas_data, v_resenas_count
  FROM resenas
  WHERE vendedor_id = v_producto_user_id;

  -- 4. Check favorito (solo si user está logueado)
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM favoritos
      WHERE user_id = p_user_id AND producto_id = p_producto_id
    ) INTO v_es_favorito;
  END IF;

  -- 6. Historial de precios (últimos 10)
  SELECT COALESCE(json_agg(row_data ORDER by row_data.creado_en DESC), '[]'::json)
  INTO v_historial
  FROM (
    SELECT json_build_object(
      'id', id,
      'precio_anterior', precio_anterior,
      'precio_nuevo', precio_nuevo,
      'creado_en', creado_en
    ) AS row_data
    FROM historial_precios
    WHERE producto_id = p_producto_id
    ORDER BY creado_en DESC
    LIMIT 10
  ) sub;

  -- Retornar todo en un solo JSON
  RETURN json_build_object(
    'vendedor', v_vendedor,
    'stats', json_build_object(
      'vendidas', v_vendidas,
      'activas', v_activas,
      'resenasCount', v_resenas_count,
      'resenasAvg', COALESCE(
        (SELECT AVG(puntuacion) FROM resenas WHERE vendedor_id = v_producto_user_id),
        0
      )
    ),
    'totalResenas', v_resenas_count,
    'esFavorito', v_es_favorito,
    'historial', v_historial
  );
END;
$$;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION obtener_detalle_producto(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION obtener_detalle_producto(UUID, UUID) TO authenticated;
