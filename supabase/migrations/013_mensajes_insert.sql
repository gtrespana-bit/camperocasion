-- Migration 013: Fix INSERT policy on mensajes
-- Previous JOIN-based policy blocks when conversation doesn't exist yet.
-- The trigger on mensajes creates conversations on first insert.
-- This policy simply requires: sender must be the authenticated user.

drop policy if exists "Enviar mensajes" on mensajes;

create policy "Enviar mensajes" on mensajes for insert
  with check (auth.uid() = remitente_id);
