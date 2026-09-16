--
-- 010_badge_vendedor_en_cards.sql
-- Columna denormalizada en productos para mostrar badge en cards sin joins
--

-- 1. Columna
ALTER TABLE productos
  ADD COLUMN vendedor_verificado BOOLEAN DEFAULT false;

-- 2. Sync datos existentes
UPDATE productos p
SET vendedor_verificado = pr.verificado
FROM perfiles pr
WHERE p.user_id = pr.id;

-- 3. Trigger sync
CREATE OR REPLACE FUNCTION fn_propagar_verificado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verificado IS DISTINCT FROM OLD.verificado THEN
    UPDATE productos
    SET vendedor_verificado = NEW.verificado
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_propagar_verificado ON perfiles;
CREATE TRIGGER trg_propagar_verificado
  AFTER UPDATE OF verificado ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_propagar_verificado();
