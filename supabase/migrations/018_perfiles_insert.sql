-- Migration 018: Fix RLS en perfiles - permitir INSERT y INSERT propio
-- Sin esto, users no pueden crear su perfil ni via upsert ni manualmente

-- Allow users to INSERT their own profile
DROP POLICY IF EXISTS "Insert propio" ON perfiles;
CREATE POLICY "Insert propio" ON perfiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Also allow the trigger (security definer) to insert
-- The trigger function is SECURITY DEFINER, so it bypasses RLS
