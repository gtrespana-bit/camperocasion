-- Migration 012: Allow users to delete their own conversations and messages

-- DELETE policy for conversaciones: user can delete if they are user1 or user2
create policy "Eliminar conversaciones propias" on conversaciones for delete
  using (auth.uid() = user1_id or auth.uid() = user2_id);

-- DELETE policy for mensajes: user can delete messages they sent or received in their conversations
create policy "Eliminar mensajes propios" on mensajes for delete
  using (
    auth.uid() = remitente_id
    or exists (
      select 1 from conversaciones
      where conversaciones.id = mensajes.conversacion_id
      and (conversaciones.user1_id = auth.uid() or conversaciones.user2_id = auth.uid())
    )
  );
