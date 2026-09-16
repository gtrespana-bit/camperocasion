-- Migration 011: Sistema de créditos y bonus emprendedor
-- - Credito de bienvenida (1 crédito gratis al registrarse)
-- - Pack Emprendedor: 5 créditos gratis al llegar a 10 publicaciones
-- - Créditos manuales desde admin (tracking con motivo)
-- - Sistema de referidos (preparado para futura implementación)

-- 1. Añadir columnas necesarias en perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS emprendedor_dado BOOLEAN DEFAULT false;
-- para futuros referidos
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS referido_por UUID REFERENCES perfiles(id);
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS referido_bonus_dado BOOLEAN DEFAULT false;

-- 2. Añadir columna motivo_registro en transacciones_creditos (para tracking)
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS motivo_registro TEXT;
-- Método de pago ya existe, pero aseguramos
ALTER TABLE transacciones_creditos ADD COLUMN IF NOT EXISTS metodo_pago TEXT;

-- 3. Cambiar el default de credito_balance: nuevos perfiles nacen con 1 crédito
-- Solo si la columna existe (puede que ya tenga default 0)
DO $$
BEGIN
  -- Intentar cambiar el default
  ALTER TABLE perfiles ALTER COLUMN credito_balance SET DEFAULT 1;
EXCEPTION WHEN undefined_column THEN
  -- Si no existe, la creamos
  ALTER TABLE perfiles ADD COLUMN credito_balance INTEGER DEFAULT 1;
END $$;

-- 4. Dar 1 crédito de bienvenida a todos los perfiles existentes que tengan 0 o NULL
UPDATE perfiles
SET credito_balance = COALESCE(credito_balance, 0) + 1
WHERE COALESCE(credito_balance, 0) = 0;

-- 5. Registrar las transacciones de bienvenida en el historial (solo los que no tienen registro)
INSERT INTO transacciones_creditos (user_id, tipo, monto, estado, motivo_registro, creado_en)
SELECT
  id AS user_id,
  'bienvenida' AS tipo,
  1 AS monto,
  'aprobado' AS estado,
  'Credito de bienvenida - migration 011' AS motivo_registro,
  actualizado_en AS creado_en
FROM perfiles
WHERE credito_balance > 0
  AND id NOT IN (
    SELECT user_id FROM transacciones_creditos WHERE tipo = 'bienvenida'
  );

-- 6. Trigger para Pack Emprendedor: 10 publicaciones = 5 créditos gratis
CREATE OR REPLACE FUNCTION trg_empaque_emprendedor()
RETURNS TRIGGER AS $$
DECLARE
  pub_count INTEGER;
  ya_dado BOOLEAN;
BEGIN
  -- Contar publicaciones activas del usuario
  SELECT COUNT(*) INTO pub_count
  FROM productos
  WHERE user_id = NEW.user_id AND activo = true;

  -- Si es la décima publicación y no ha recibido el bonus
  IF pub_count >= 10 THEN
    SELECT emprendedor_dado INTO ya_dado FROM perfiles WHERE id = NEW.user_id;

    IF NOT ya_dado THEN
      -- Actualizar balance
      UPDATE perfiles
      SET
        credito_balance = COALESCE(credito_balance, 0) + 5,
        emprendedor_dado = true
      WHERE id = NEW.user_id;

      -- Registrar transacción
      INSERT INTO transacciones_creditos (
        user_id, tipo, monto, estado, motivo_registro, creado_en
      ) VALUES (
        NEW.user_id, 'emprendedor', 5, 'aprobado',
        'Bonus emprendedor - 10+ publicaciones',
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger si existe y crear nuevo
DROP TRIGGER IF EXISTS trg_pack_emprendedor ON productos;
CREATE TRIGGER trg_pack_emprendedor
  AFTER INSERT ON productos
  FOR EACH ROW
  EXECUTE FUNCTION trg_empaque_emprendedor();

-- 7. Trigger: cuando se elimina/re-activa una publicación, recalcular
CREATE OR REPLACE FUNCTION trg_recalcular_emprendedor()
RETURNS TRIGGER AS $$
DECLARE
  pub_count INTEGER;
BEGIN
  -- Solo importa si la publicación fue eliminada (OLD) o desactivada
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.activo = true AND NEW.activo = false) THEN
    DECLARE
      target_user UUID;
    BEGIN
      target_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;

      SELECT COUNT(*) INTO pub_count
      FROM productos
      WHERE user_id = target_user AND activo = true;

      -- Si bajó de 10, revertir el flag (permitir que lo gane de nuevo si llega otra vez)
      IF pub_count < 10 THEN
        UPDATE perfiles
        SET emprendedor_dado = false
        WHERE id = target_user AND emprendedor_dado = true;
      END IF;
    END;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_emprendedor ON productos;
CREATE TRIGGER trg_recalc_emprendedor
  AFTER DELETE OR UPDATE OF activo ON productos
  FOR EACH ROW
  EXECUTE FUNCTION trg_recalcular_emprendedor();

-- 8. Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_transacciones_tipo ON transacciones_creditos(tipo);
CREATE INDEX IF NOT EXISTS idx_transacciones_user_tipo ON transacciones_creditos(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_productos_user_activo ON productos(user_id, activo);
