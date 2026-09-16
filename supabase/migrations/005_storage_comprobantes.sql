-- Todo Anuncios: Storage bucket para comprobantes de pago
-- Ejecutar en Supabase SQL Editor

-- Crear bucket de comprobantes
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do nothing;
DROP POLICY IF EXISTS "Usuarios pueden subir comprobantes" ON "storage"."objects";


-- Políticas de almacenamiento para comprobantes
-- Solo usuarios autenticados pueden subir
create policy "Usuarios pueden subir comprobantes"
  on storage.objects for insert
  with check (
    bucket_id = 'comprobantes'
    and auth.role() = 'authenticated'
  );
DROP POLICY IF EXISTS "Cualquiera puede ver comprobantes" ON "storage"."objects";


-- Cualquiera puede ver (para revisión manual)
create policy "Cualquiera puede ver comprobantes"
  on storage.objects for select
  using (bucket_id = 'comprobantes');
DROP POLICY IF EXISTS "Ver comprobantes propios" ON "storage"."objects";


-- Solo el dueño puede ver sus propios comprobantes
create policy "Ver comprobantes propios"
  on storage.objects for select
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
