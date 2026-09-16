-- 011_chat_fix_create_conv.sql
-- Fix 1: RLS policy para permitir crear conversación cuando el usuario es user1 o user2
DROP POLICY IF EXISTS "Crear conversaciones" ON conversaciones;
CREATE POLICY "Crear conversaciones" ON conversaciones FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Fix 2: Unique constraint para evitar duplicados
-- Evita que se creen múltiples conversaciones entre mismo usuario + producto
ALTER TABLE conversaciones
  DROP CONSTRAINT IF EXISTS conversaciones_usuario_producto_unique;
