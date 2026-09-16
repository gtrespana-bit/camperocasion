-- ============================================================================
-- CamperOcasión — Verificación de homologación (Fase 0.2 del plan de confianza)
-- Fecha: 2026-09-15
--
-- Qué resuelve
--   Un anuncio de camper puede declarar "Vehículo Vivienda (2448/3148)" sin que
--   nadie haya visto la ficha técnica ni el proyecto de homologación. Esta
--   migración crea el EXPEDIENTE DEL VEHÍCULO: el vendedor sube documentos al
--   bucket privado `documentos-vehiculo`, el admin los revisa en el panel y el
--   anuncio muestra el sello "Homologación verificada".
--
--   Reutiliza el patrón del vendedor verificado (migraciones 009 y 010):
--   bucket privado + cola de revisión + badge, pero el estado vive en
--   `productos` (es una propiedad del anuncio, no del vendedor).
--
-- Nota de compatibilidad: es aditiva e idempotente. El sitio sigue funcionando
-- sin esta migración (el badge simplemente no aparece y la subida de
-- documentos responde con error controlado).
-- ============================================================================

-- ── 1. Estado de verificación en productos ──────────────────────────────────
-- sin_verificar → el vendedor no ha subido nada (estado por defecto)
-- pendiente     → hay documentos subidos esperando revisión del admin
-- verificada    → el admin ha validado el expediente (badge visible)
-- rechazada     → el admin lo ha revisado y no lo acepta (con motivo)

alter table public.productos
  add column if not exists verificacion_homologacion text not null default 'sin_verificar',
  add column if not exists verificacion_homologacion_motivo text,
  add column if not exists verificacion_homologacion_revisada_en timestamptz;

alter table public.productos
  drop constraint if exists productos_verificacion_homologacion_check;

alter table public.productos
  add constraint productos_verificacion_homologacion_check
  check (verificacion_homologacion in ('sin_verificar', 'pendiente', 'verificada', 'rechazada'));

comment on column public.productos.verificacion_homologacion is
  'Estado del expediente documental del vehículo. Solo lo escribe la API con '
  'service_role (el navegador tiene revocado el UPDATE de productos desde '
  '202608010005_productos_edicion_segura.sql).';

-- El filtro "Solo homologación verificada" del catálogo es selectivo: un índice
-- parcial mantiene el coste mínimo al ser "verificada" un estado poco frecuente.
create index if not exists productos_verificacion_homologacion_idx
  on public.productos (verificacion_homologacion)
  where verificacion_homologacion <> 'sin_verificar';


-- ── 2. Expediente documental del vehículo ───────────────────────────────────

create table if not exists public.documentos_vehiculo (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  -- Propietario del anuncio: se denormaliza para que la RLS y la ruta en
  -- Storage se validen sin leer `productos` (evita recursión de políticas).
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in (
    'ficha_tecnica',
    'proyecto_homologacion',
    'itv',
    'certificado_kilometraje',
    'contrato_compraventa',
    'otro'
  )),
  -- Ruta del objeto dentro del bucket privado `documentos-vehiculo`
  -- (`<user_id>/<producto_id>/<archivo>`). Nunca una URL pública: el panel
  -- admin y el propietario la abren con URL firmada de vida corta.
  archivo_url text not null,
  nombre_archivo text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'verificado', 'rechazado')),
  notas text,
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists documentos_vehiculo_producto_idx
  on public.documentos_vehiculo (producto_id);
create index if not exists documentos_vehiculo_user_idx
  on public.documentos_vehiculo (user_id);
-- Un documento de cada tipo por anuncio: para reemplazar uno, se borra y se
-- sube de nuevo (así el expediente no acumula versiones contradictorias).
create unique index if not exists documentos_vehiculo_producto_tipo_key
  on public.documentos_vehiculo (producto_id, tipo);

comment on table public.documentos_vehiculo is
  'Expediente documental del vehículo (ficha técnica, proyecto de '
  'homologación, ITV…). RLS: el propietario ve y sube los de sus anuncios, el '
  'admin revisa, y el público solo ve los ya verificados (para el checklist de '
  'la ficha del producto).';

alter table public.documentos_vehiculo enable row level security;

-- Nota sobre `user_id`: es una columna de propiedad, así que se congela al
-- crear la fila. Sin esto, un usuario autenticado podría insertar un documento
-- con el `user_id` de OTRO (el WITH CHECK no puede comprobar que sea el dueño
-- del anuncio sin leer `productos`, y hacerlo en la política provocaría
-- recursión). Congelarla evita ese vector sin tocar la política.
create or replace function public.fn_documentos_vehiculo_user_id_inmutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'El propietario del documento no se puede cambiar';
  end if;
  return new;
end $$;

drop trigger if exists trg_documentos_vehiculo_user_id_inmutable on public.documentos_vehiculo;
create trigger trg_documentos_vehiculo_user_id_inmutable
  before update on public.documentos_vehiculo
  for each row execute function public.fn_documentos_vehiculo_user_id_inmutable();

-- Propietario: ve, sube y borra los documentos de sus anuncios.
drop policy if exists "documentos_vehiculo: owner select" on public.documentos_vehiculo;
create policy "documentos_vehiculo: owner select" on public.documentos_vehiculo
  for select to authenticated
  using (auth.uid() = user_id);

-- Comprobar `auth.uid() = user_id` NO basta: un usuario podría adjuntar un
-- documento al expediente de un anuncio ajeno pasando su propio `user_id`. La
-- pertenencia del anuncio se comprueba con un helper SECURITY DEFINER (leer
-- `productos` dentro de la política funcionaría, pero este helper no depende de
-- la RLS de productos ni de que el anuncio esté activo).
create or replace function public.fn_es_dueno_del_anuncio(p_producto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.productos p
    where p.id = p_producto_id and p.user_id = auth.uid()
  );
$$;

grant execute on function public.fn_es_dueno_del_anuncio(uuid) to authenticated;

drop policy if exists "documentos_vehiculo: owner insert" on public.documentos_vehiculo;
create policy "documentos_vehiculo: owner insert" on public.documentos_vehiculo
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.fn_es_dueno_del_anuncio(producto_id)
  );

drop policy if exists "documentos_vehiculo: owner delete" on public.documentos_vehiculo;
create policy "documentos_vehiculo: owner delete" on public.documentos_vehiculo
  for delete to authenticated
  using (auth.uid() = user_id);

-- El propietario NO puede marcar sus propios documentos como verificados:
-- `estado` solo lo cambia el panel admin (service_role). Igual que en
-- `solicitudes_verificacion`, se restringe a las columnas que puede tocar.

-- Admin: revisa el expediente completo.
drop policy if exists "documentos_vehiculo: admin all" on public.documentos_vehiculo;
create policy "documentos_vehiculo: admin all" on public.documentos_vehiculo
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Público: solo los documentos ya verificados. Permite que la ficha del
-- producto muestre el checklist del expediente sin exponer nada en revisión.
drop policy if exists "documentos_vehiculo: public verificado" on public.documentos_vehiculo;
create policy "documentos_vehiculo: public verificado" on public.documentos_vehiculo
  for select to anon, authenticated
  using (estado = 'verificado');

-- La API del propietario escribe con service_role (comprueba la propiedad y la
-- subida antes); el navegador solo necesita leer su expediente.
revoke all on public.documentos_vehiculo from anon;
grant select on public.documentos_vehiculo to anon;
grant select, insert, delete on public.documentos_vehiculo to authenticated;
grant all on public.documentos_vehiculo to service_role;


-- ── 3. Bucket privado para los documentos ───────────────────────────────────
-- Acepta PDF además de imágenes: la ficha técnica (anexo I) y el proyecto de
-- homologación llegan en PDF desde la DGT o el taller.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-vehiculo',
  'documentos-vehiculo',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "documentos-vehiculo: owner upload" on storage.objects;
create policy "documentos-vehiculo: owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos-vehiculo'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documentos-vehiculo: owner read" on storage.objects;
create policy "documentos-vehiculo: owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos-vehiculo'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documentos-vehiculo: owner delete" on storage.objects;
create policy "documentos-vehiculo: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos-vehiculo'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- El admin abre cualquier documento del bucket con URL firmada. A diferencia
-- del bucket `cedulas` (migración 009), aquí NO se permite el SELECT a
-- `authenticated` en general: solo a administradores.
drop policy if exists "documentos-vehiculo: admin read" on storage.objects;
create policy "documentos-vehiculo: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos-vehiculo' and public.is_admin());
