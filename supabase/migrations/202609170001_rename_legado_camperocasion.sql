-- ============================================================================
-- CamperOcasión — Canonización del esquema (2026-09-17)
-- Elimina el legado venezolano del esquema manteniendo compatibilidad.
--
-- Problema: el repo nació del marketplace venezolano y conserva nombres
--   `precio_usd`, `pago_movil_*`, `cedula_*`, `cedulas` (bucket) que en
--   España significan euros, DNI/NIE, teléfono/Bizum y documentos de identidad.
--   Renombrar rompe código y despliegues si no se hace con alias.
--
-- Solución (aditiva, idempotente, sin downtime):
--   1) Añade columnas canónicas ES (`precio`, `dni`, `telefono`, `banco` …)
--   2) Copia datos existentes (backfill)
--   3) Crea triggers bidireccionales que mantienen ambos nombres sincronizados
--   4) Crea bucket `documentos-identidad` (canónico) + mantiene `cedulas` como alias
--   5) Documenta `precio_usd` / `pago_movil_*` / `cedulas` como aliases deprecados
--
--   El código puede empezar a usar `precio` / `dni` ya; el viejo sigue
--   funcionando hasta que se retire en una migración mayor futura.
-- ============================================================================

-- ── 1. Productos: precio canónico ───────────────────────────────────────────
-- Antes: solo `precio_usd` (legado, pero se guarda en euros desde 2026-09)
-- Ahora: `precio`  = canónico ES (euros)
--        `precio_eur` = alias explícito (opcional, mismo valor)
--        `precio_usd` = alias deprecado (compat)

alter table public.productos
  add column if not exists precio numeric(12,2),
  add column if not exists precio_eur numeric(12,2);

-- Backfill: donde el canónico está vacío, copiar del legado
update public.productos set precio = precio_usd
  where precio is null and precio_usd is not null;

update public.productos set precio_eur = coalesce(precio, precio_usd)
  where precio_eur is null and coalesce(precio, precio_usd) is not null;

-- Si el legado está vacío pero el canónico tiene valor (escrituras nuevas), copiar atrás
update public.productos set precio_usd = coalesce(precio, precio_eur)
  where precio_usd is null and coalesce(precio, precio_eur) is not null;

comment on column public.productos.precio is
  'Canónico CamperOcasión: precio en euros. Alias legado: precio_usd (deprecado, sincronizado por trigger).';
comment on column public.productos.precio_eur is
  'Alias explícito de precio en euros (sincronizado). Preferir `precio`.';
comment on column public.productos.precio_usd is
  'Alias legado venezolano (deprecado) — mantener sincronizado con `precio`. Usar `precio` en código nuevo.';

-- Índice para ordenar por precio canónico (mantener el viejo por compat)
create index if not exists productos_precio_idx on public.productos (precio);
create index if not exists productos_precio_eur_idx on public.productos (precio_eur);

-- Trigger: mantiene precio / precio_eur / precio_usd sincronizados
create or replace function public.fn_sync_producto_precio()
returns trigger as $$
begin
  -- Si el canónico cambió, propagar a los alias
  if tg_op = 'INSERT' then
    if new.precio is not null then
      new.precio_eur := new.precio;
      new.precio_usd := new.precio;
    elsif new.precio_eur is not null then
      new.precio := new.precio_eur;
      new.precio_usd := new.precio_eur;
    elsif new.precio_usd is not null then
      new.precio := new.precio_usd;
      new.precio_eur := new.precio_usd;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    -- Prioridad: precio > precio_eur > precio_usd si varios cambian a la vez
    if new.precio is distinct from old.precio and new.precio is not null then
      new.precio_eur := new.precio;
      new.precio_usd := new.precio;
    elsif new.precio_eur is distinct from old.precio_eur and new.precio_eur is not null then
      new.precio := new.precio_eur;
      new.precio_usd := new.precio_eur;
    elsif new.precio_usd is distinct from old.precio_usd and new.precio_usd is not null then
      new.precio := new.precio_usd;
      new.precio_eur := new.precio_usd;
    end if;
    return new;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_producto_precio on public.productos;
create trigger trg_sync_producto_precio
  before insert or update of precio, precio_eur, precio_usd on public.productos
  for each row execute function public.fn_sync_producto_precio();


-- ── 2. Perfiles: identidad ES ───────────────────────────────────────────────
-- Antes: pago_movil_telefono, pago_movil_cedula, pago_movil_banco, cedula_numero, cedula_foto_url
-- Ahora: telefono_verificacion, dni, banco_verificacion, dni_foto_url (canónicos)
--        + aliases legados sincronizados

alter table public.perfiles
  add column if not exists dni text,
  add column if not exists telefono_verificacion text,
  add column if not exists banco_verificacion text,
  add column if not exists dni_foto_url text,
  add column if not exists dni_numero text;

-- Backfill canónico desde legado
update public.perfiles set dni = coalesce(dni, dni_numero, cedula_numero, pago_movil_cedula)
  where coalesce(dni, dni_numero, cedula_numero, pago_movil_cedula) is not null and dni is null;

update public.perfiles set telefono_verificacion = coalesce(telefono_verificacion, pago_movil_telefono)
  where telefono_verificacion is null and pago_movil_telefono is not null;

update public.perfiles set banco_verificacion = coalesce(banco_verificacion, pago_movil_banco)
  where banco_verificacion is null and pago_movil_banco is not null;

update public.perfiles set dni_foto_url = coalesce(dni_foto_url, cedula_foto_url)
  where dni_foto_url is null and cedula_foto_url is not null;

update public.perfiles set dni_numero = coalesce(dni_numero, dni, cedula_numero)
  where dni_numero is null and coalesce(dni, cedula_numero) is not null;

-- Backfill inverso: si alguien escribe en canónico, que el legado no quede vacío (compat API vieja)
update public.perfiles set pago_movil_cedula = coalesce(pago_movil_cedula, dni, cedula_numero)
  where pago_movil_cedula is null and coalesce(dni, cedula_numero) is not null;

update public.perfiles set cedula_numero = coalesce(cedula_numero, dni, pago_movil_cedula)
  where cedula_numero is null and coalesce(dni, pago_movil_cedula) is not null;

update public.perfiles set pago_movil_telefono = coalesce(pago_movil_telefono, telefono_verificacion)
  where pago_movil_telefono is null and telefono_verificacion is not null;

update public.perfiles set pago_movil_banco = coalesce(pago_movil_banco, banco_verificacion)
  where pago_movil_banco is null and banco_verificacion is not null;

update public.perfiles set cedula_foto_url = coalesce(cedula_foto_url, dni_foto_url)
  where cedula_foto_url is null and dni_foto_url is not null;

comment on column public.perfiles.dni is
  'Canónico ES: DNI/NIE del vendedor. Alias legado: pago_movil_cedula / cedula_numero (sincronizados).';
comment on column public.perfiles.telefono_verificacion is
  'Canónico ES: teléfono de verificación (Bizum). Alias legado: pago_movil_telefono.';
comment on column public.perfiles.banco_verificacion is
  'Canónico ES: banco de verificación. Alias legado: pago_movil_banco.';
comment on column public.perfiles.dni_foto_url is
  'Canónico ES: foto DNI/NIE. Alias legado: cedula_foto_url.';

create or replace function public.fn_sync_perfil_identidad()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.dni := coalesce(new.dni, new.dni_numero, new.cedula_numero, new.pago_movil_cedula);
    new.dni_numero := coalesce(new.dni_numero, new.dni);
    new.cedula_numero := coalesce(new.cedula_numero, new.dni);
    new.pago_movil_cedula := coalesce(new.pago_movil_cedula, new.dni);
    new.telefono_verificacion := coalesce(new.telefono_verificacion, new.pago_movil_telefono);
    new.pago_movil_telefono := coalesce(new.pago_movil_telefono, new.telefono_verificacion);
    new.banco_verificacion := coalesce(new.banco_verificacion, new.pago_movil_banco);
    new.pago_movil_banco := coalesce(new.pago_movil_banco, new.banco_verificacion);
    new.dni_foto_url := coalesce(new.dni_foto_url, new.cedula_foto_url);
    new.cedula_foto_url := coalesce(new.cedula_foto_url, new.dni_foto_url);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.dni is distinct from old.dni and new.dni is not null then
      new.dni_numero := new.dni; new.cedula_numero := new.dni; new.pago_movil_cedula := new.dni;
    elsif new.dni_numero is distinct from old.dni_numero and new.dni_numero is not null then
      new.dni := new.dni_numero; new.cedula_numero := new.dni_numero; new.pago_movil_cedula := new.dni_numero;
    elsif new.cedula_numero is distinct from old.cedula_numero and new.cedula_numero is not null then
      new.dni := new.cedula_numero; new.dni_numero := new.cedula_numero; new.pago_movil_cedula := new.cedula_numero;
    elsif new.pago_movil_cedula is distinct from old.pago_movil_cedula and new.pago_movil_cedula is not null then
      new.dni := new.pago_movil_cedula; new.dni_numero := new.pago_movil_cedula; new.cedula_numero := new.pago_movil_cedula;
    end if;
    if new.telefono_verificacion is distinct from old.telefono_verificacion and new.telefono_verificacion is not null then
      new.pago_movil_telefono := new.telefono_verificacion;
    elsif new.pago_movil_telefono is distinct from old.pago_movil_telefono and new.pago_movil_telefono is not null then
      new.telefono_verificacion := new.pago_movil_telefono;
    end if;
    if new.banco_verificacion is distinct from old.banco_verificacion and new.banco_verificacion is not null then
      new.pago_movil_banco := new.banco_verificacion;
    elsif new.pago_movil_banco is distinct from old.pago_movil_banco and new.pago_movil_banco is not null then
      new.banco_verificacion := new.pago_movil_banco;
    end if;
    if new.dni_foto_url is distinct from old.dni_foto_url and new.dni_foto_url is not null then
      new.cedula_foto_url := new.dni_foto_url;
    elsif new.cedula_foto_url is distinct from old.cedula_foto_url and new.cedula_foto_url is not null then
      new.dni_foto_url := new.cedula_foto_url;
    end if;
    return new;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_perfil_identidad on public.perfiles;
create trigger trg_sync_perfil_identidad
  before insert or update of dni, dni_numero, cedula_numero, pago_movil_cedula, telefono_verificacion, pago_movil_telefono, banco_verificacion, pago_movil_banco, dni_foto_url, cedula_foto_url
  on public.perfiles
  for each row execute function public.fn_sync_perfil_identidad();


-- ── 3. Solicitudes_verificacion: identidad ES ──────────────────────────────
-- Antes: pago_movil_telefono, pago_movil_cedula, pago_movil_banco, cedula_foto_frente/dorso_url
-- Ahora: telefono, dni, banco, dni_foto_frente/dorso_url (canónicos)

alter table public.solicitudes_verificacion
  add column if not exists telefono text,
  add column if not exists dni text,
  add column if not exists banco text,
  add column if not exists dni_foto_frente_url text,
  add column if not exists dni_foto_dorso_url text;

-- Backfill canónico
update public.solicitudes_verificacion set telefono = coalesce(telefono, pago_movil_telefono)
  where telefono is null and pago_movil_telefono is not null;
update public.solicitudes_verificacion set dni = coalesce(dni, pago_movil_cedula)
  where dni is null and pago_movil_cedula is not null;
update public.solicitudes_verificacion set banco = coalesce(banco, pago_movil_banco)
  where banco is null and pago_movil_banco is not null;
update public.solicitudes_verificacion set dni_foto_frente_url = coalesce(dni_foto_frente_url, cedula_foto_frente_url)
  where dni_foto_frente_url is null and cedula_foto_frente_url is not null;
update public.solicitudes_verificacion set dni_foto_dorso_url = coalesce(dni_foto_dorso_url, cedula_foto_dorso_url)
  where dni_foto_dorso_url is null and cedula_foto_dorso_url is not null;

-- Backfill inverso
update public.solicitudes_verificacion set pago_movil_telefono = coalesce(pago_movil_telefono, telefono)
  where pago_movil_telefono is null and telefono is not null;
update public.solicitudes_verificacion set pago_movil_cedula = coalesce(pago_movil_cedula, dni)
  where pago_movil_cedula is null and dni is not null;
update public.solicitudes_verificacion set pago_movil_banco = coalesce(pago_movil_banco, banco)
  where pago_movil_banco is null and banco is not null;
update public.solicitudes_verificacion set cedula_foto_frente_url = coalesce(cedula_foto_frente_url, dni_foto_frente_url)
  where cedula_foto_frente_url is null and dni_foto_frente_url is not null;
update public.solicitudes_verificacion set cedula_foto_dorso_url = coalesce(cedula_foto_dorso_url, dni_foto_dorso_url)
  where cedula_foto_dorso_url is null and dni_foto_dorso_url is not null;

comment on column public.solicitudes_verificacion.telefono is 'Canónico ES: teléfono. Alias legado: pago_movil_telefono.';
comment on column public.solicitudes_verificacion.dni is 'Canónico ES: DNI/NIE. Alias legado: pago_movil_cedula.';
comment on column public.solicitudes_verificacion.banco is 'Canónico ES: banco. Alias legado: pago_movil_banco.';
comment on column public.solicitudes_verificacion.dni_foto_frente_url is 'Canónico ES: foto DNI frente. Alias legado: cedula_foto_frente_url.';
comment on column public.solicitudes_verificacion.dni_foto_dorso_url is 'Canónico ES: foto DNI dorso. Alias legado: cedula_foto_dorso_url.';

create or replace function public.fn_sync_solicitud_verificacion()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.telefono := coalesce(new.telefono, new.pago_movil_telefono);
    new.pago_movil_telefono := coalesce(new.pago_movil_telefono, new.telefono);
    new.dni := coalesce(new.dni, new.pago_movil_cedula);
    new.pago_movil_cedula := coalesce(new.pago_movil_cedula, new.dni);
    new.banco := coalesce(new.banco, new.pago_movil_banco);
    new.pago_movil_banco := coalesce(new.pago_movil_banco, new.banco);
    new.dni_foto_frente_url := coalesce(new.dni_foto_frente_url, new.cedula_foto_frente_url);
    new.cedula_foto_frente_url := coalesce(new.cedula_foto_frente_url, new.dni_foto_frente_url);
    new.dni_foto_dorso_url := coalesce(new.dni_foto_dorso_url, new.cedula_foto_dorso_url);
    new.cedula_foto_dorso_url := coalesce(new.cedula_foto_dorso_url, new.dni_foto_dorso_url);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.telefono is distinct from old.telefono and new.telefono is not null then new.pago_movil_telefono := new.telefono;
    elsif new.pago_movil_telefono is distinct from old.pago_movil_telefono and new.pago_movil_telefono is not null then new.telefono := new.pago_movil_telefono;
    end if;
    if new.dni is distinct from old.dni and new.dni is not null then new.pago_movil_cedula := new.dni;
    elsif new.pago_movil_cedula is distinct from old.pago_movil_cedula and new.pago_movil_cedula is not null then new.dni := new.pago_movil_cedula;
    end if;
    if new.banco is distinct from old.banco and new.banco is not null then new.pago_movil_banco := new.banco;
    elsif new.pago_movil_banco is distinct from old.pago_movil_banco and new.pago_movil_banco is not null then new.banco := new.pago_movil_banco;
    end if;
    if new.dni_foto_frente_url is distinct from old.dni_foto_frente_url and new.dni_foto_frente_url is not null then new.cedula_foto_frente_url := new.dni_foto_frente_url;
    elsif new.cedula_foto_frente_url is distinct from old.cedula_foto_frente_url and new.cedula_foto_frente_url is not null then new.dni_foto_frente_url := new.cedula_foto_frente_url;
    end if;
    if new.dni_foto_dorso_url is distinct from old.dni_foto_dorso_url and new.dni_foto_dorso_url is not null then new.cedula_foto_dorso_url := new.dni_foto_dorso_url;
    elsif new.cedula_foto_dorso_url is distinct from old.cedula_foto_dorso_url and new.cedula_foto_dorso_url is not null then new.dni_foto_dorso_url := new.cedula_foto_dorso_url;
    end if;
    return new;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_solicitud_verificacion on public.solicitudes_verificacion;
create trigger trg_sync_solicitud_verificacion
  before insert or update of telefono, pago_movil_telefono, dni, pago_movil_cedula, banco, pago_movil_banco, dni_foto_frente_url, cedula_foto_frente_url, dni_foto_dorso_url, cedula_foto_dorso_url
  on public.solicitudes_verificacion
  for each row execute function public.fn_sync_solicitud_verificacion();


-- ── 4. Storage: bucket canónico de identidad ───────────────────────────────
-- Antes: solo `cedulas` (nombre venezolano)
-- Ahora: `documentos-identidad` = canónico ES; `cedulas` se mantiene como alias

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-identidad', 'documentos-identidad', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Mantener `cedulas` existente para compatibilidad: si no existe, crearlo (fresh install ya lo tiene por 009)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cedulas', 'cedulas', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

comment on column public.perfiles.dni_foto_url is 'Ruta en bucket `documentos-identidad` (alias `cedulas` legado).';

-- RLS para el nuevo bucket: mismas reglas que `cedulas`
-- Usuarios suben/ven sus propios documentos; admin ve todos (is_admin())

drop policy if exists "Usuarios suben sus propios documentos de identidad" on storage.objects;
create policy "Usuarios suben sus propios documentos de identidad" on storage.objects
  for insert with check (
    bucket_id = 'documentos-identidad'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Usuarios ven sus propios documentos de identidad" on storage.objects;
create policy "Usuarios ven sus propios documentos de identidad" on storage.objects
  for select using (
    bucket_id = 'documentos-identidad'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admin ve documentos de identidad" on storage.objects;
create policy "Admin ve documentos de identidad" on storage.objects
  for select using (bucket_id = 'documentos-identidad' and public.is_admin());

-- Nota: no se borra el bucket `cedulas`; ambos buckets coexisten. La app
-- debe preferir `documentos-identidad` en código nuevo.


-- ── 5. Transacciones: compatibilidad (la tabla canónica real es transacciones_creditos) ─
-- En instalaciones antiguas pudo existir `public.transacciones` con `precio_usd`;
-- en la base actual esa tabla no existe (el historial es transacciones_creditos
-- con columna `monto`). Este bloque es idempotente y no falla si la tabla no existe.

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'transacciones') then

    -- Añadir columna canónica si la tabla existe
    begin
      execute 'alter table public.transacciones add column if not exists precio_eur numeric(12,2)';
    exception when duplicate_column then null; end;

    -- Backfill bidireccional
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='transacciones' and column_name='precio_usd') then
      execute 'update public.transacciones set precio_eur = coalesce(precio_eur, precio_usd) where precio_eur is null and precio_usd is not null';
      execute 'update public.transacciones set precio_usd = coalesce(precio_usd, precio_eur) where precio_usd is null and precio_eur is not null';
    end if;

    begin
      execute 'comment on column public.transacciones.precio_eur is ''Canónico ES: precio en euros. Alias legado: precio_usd.''';
    exception when undefined_column then null; when undefined_object then null; end;

    -- Trigger sync (solo si ambas columnas existen)
    execute $fn$
      create or replace function public.fn_sync_transaccion_precio()
      returns trigger as $t$
      begin
        if tg_op = 'INSERT' then
          new.precio_eur := coalesce(new.precio_eur, new.precio_usd);
          new.precio_usd := coalesce(new.precio_usd, new.precio_eur);
          return new;
        elsif tg_op = 'UPDATE' then
          if new.precio_eur is distinct from old.precio_eur and new.precio_eur is not null then new.precio_usd := new.precio_eur;
          elsif new.precio_usd is distinct from old.precio_usd and new.precio_usd is not null then new.precio_eur := new.precio_usd;
          end if;
          return new;
        end if;
        return new;
      end;
      $t$ language plpgsql;
    $fn$;

    execute 'drop trigger if exists trg_sync_transaccion_precio on public.transacciones';
    begin
      execute 'create trigger trg_sync_transaccion_precio before insert or update of precio_eur, precio_usd on public.transacciones for each row execute function public.fn_sync_transaccion_precio()';
    exception when undefined_column then null; when undefined_object then null; end;

  end if;
end $$;


-- ── 6. Vistas de compatibilidad (opcional, lectura) ────────────────────────
-- Vista `productos_con_alias` no es necesaria: los triggers mantienen columnas.
-- Se documenta que `precio` es el campo a usar en consultas nuevas:
--   select id, titulo, precio, precio_eur, precio_usd ...  -- los tres valen lo mismo
-- Código nuevo: usar `precio` (o `precio_eur` si se quiere ser explícito).
