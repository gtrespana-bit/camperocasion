-- Fix: evitar conversaciones duplicadas con constraint UNIQUE
-- Sin esto, el trigger puede crear duplicados en condiciones de race condition

-- 1. Eliminar duplicados existentes (quedar con el más antiguo)
DELETE FROM conversaciones a USING conversaciones b
WHERE a.id > b.id
  AND a.user1_id = b.user1_id
  AND a.user2_id = b.user2_id
  AND a.producto_id IS NOT DISTINCT FROM b.producto_id;

-- 2. Crear constraint único
ALTER TABLE conversaciones
  ADD CONSTRAINT uq_conversacion UNIQUE (user1_id, user2_id, producto_id);
