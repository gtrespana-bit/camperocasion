/**
 * Trigger para historial de precios.
 * Cada vez que cambia precio_usd en productos, guarda el cambio.
 */

-- Trigger function
CREATE OR REPLACE FUNCTION registrar_cambio_precio()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.precio_usd IS DISTINCT FROM NEW.precio_usd
     AND OLD.precio_usd IS NOT NULL
     AND NEW.precio_usd IS NOT NULL THEN
    INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo)
    VALUES (NEW.id, OLD.precio_usd, NEW.precio_usd);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_precio_history ON productos;
CREATE TRIGGER trg_precio_history
  AFTER UPDATE OF precio_usd ON productos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_precio();
