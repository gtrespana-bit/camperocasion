-- ============================================================
-- CamperOcasión — setup completo de la base de datos
-- Pega este bloque completo en Supabase Dashboard → SQL Editor → RUN.
-- Puedes ejecutarlo varias veces: todas las sentencias usan IF NOT EXISTS.
-- ============================================================

-- ----- 001_schema_inicial.sql -----
-- TuCambalo: Schema inicial de Supabase
-- Ejecutar en el SQL Editor de tu proyecto Supabase

-- Tabla de perfiles (se vincula con auth.users)
create table if not exists perfiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nombre text,
  telefono text,
  estado text,
  ciudad text,
  whatsapp_disponible boolean default false,
  telefono_visible boolean default false,
  email_visible boolean default false,
  credito_balance integer default 0,
  creado_en timestamp with time zone default now(),
  actualizado_en timestamp with time zone default now()
);

-- Tabla de categorías
create table if not exists categorias (
  id serial primary key,
  nombre text not null unique
);

insert into categorias (nombre) values
  ('vehiculos'),
  ('tecnologia'),
  ('moda'),
  ('hogar'),
  ('herramientas'),
  ('otros')
on conflict do nothing;

-- Tabla de productos
create table if not exists productos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  titulo text not null,
  descripcion text,
  categoria_id integer references categorias(id),
  subcategoria text,
  marca text,
  modelo text,
  estado text check (estado in ('Nuevo', 'Como nuevo', 'Bueno', 'Usado', 'Para repuestos')),
  precio_usd decimal(12,2),
  ubicacion_estado text,
  ubicacion_ciudad text,
  imagen_url text,
  imagenes text[],
  activo boolean default true,
  destacado boolean default false,
  destacado_hasta timestamp with time zone,
  visitas integer default 0,
  creado_en timestamp with time zone default now(),
  actualizado_en timestamp with time zone default now()
);

-- Tabla de favoritos
create table if not exists favoritos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  producto_id uuid references productos(id) on delete cascade not null,
  creado_en timestamp with time zone default now(),
  unique(user_id, producto_id)
);

-- Tabla de mensajes (chat)
create table if not exists mensajes (
  id uuid default gen_random_uuid() primary key,
  conversacion_id uuid not null,
  remitente_id uuid references auth.users(id) on delete cascade not null,
  destinatario_id uuid references auth.users(id) on delete cascade not null,
  producto_id uuid references productos(id) on delete set null,
  contenido text not null,
  leido boolean default false,
  creado_en timestamp with time zone default now()
);

-- Tabla de transacciones de créditos
create table if not exists transacciones_creditos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  tipo text check (tipo in ('compra', 'gasto', 'reembolso')),
  monto integer not null,
  metodo_pago text,
  comprobante_url text,
  estado text check (estado in ('pendiente', 'aprobado', 'rechazado')) default 'pendiente',
  creado_en timestamp with time zone default now()
);

-- RLS: Row Level Security

-- Perfiles: todos pueden ver, el dueño puede editar
alter table perfiles enable row level security;
DROP POLICY IF EXISTS "Ver perfiles" ON "perfiles";


create policy "Ver perfiles" on perfiles for select using (true);
DROP POLICY IF EXISTS "Editar propio perfil" ON "perfiles";

create policy "Editar propio perfil" on perfiles for update using (auth.uid() = id);

-- Productos: visibles todos, el dueño puede CRUD
alter table productos enable row level security;
DROP POLICY IF EXISTS "Ver productos" ON "productos";


create policy "Ver productos" on productos for select using (activo = true);
DROP POLICY IF EXISTS "Ver propios" ON "productos";

create policy "Ver propios" on productos for select using (auth.uid() = user_id);
DROP POLICY IF EXISTS "Insert propios" ON "productos";

create policy "Insert propios" on productos for insert with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "Editar propios" ON "productos";

create policy "Editar propios" on productos for update using (auth.uid() = user_id);
DROP POLICY IF EXISTS "Eliminar propios" ON "productos";

create policy "Eliminar propios" on productos for delete using (auth.uid() = user_id);

-- Favoritos
alter table favoritos enable row level security;
DROP POLICY IF EXISTS "Ver favoritos propios" ON "favoritos";

create policy "Ver favoritos propios" on favoritos for select using (auth.uid() = user_id);
DROP POLICY IF EXISTS "Insert favoritos propios" ON "favoritos";

create policy "Insert favoritos propios" on favoritos for insert with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "Eliminar favoritos propios" ON "favoritos";

create policy "Eliminar favoritos propios" on favoritos for delete using (auth.uid() = user_id);

-- Mensajes
alter table mensajes enable row level security;
DROP POLICY IF EXISTS "Ver mensajes" ON "mensajes";

create policy "Ver mensajes" on mensajes for select using (
  auth.uid() = remitente_id or auth.uid() = destinatario_id
);
DROP POLICY IF EXISTS "Enviar mensajes" ON "mensajes";

create policy "Enviar mensajes" on mensajes for insert with check (auth.uid() = remitente_id);

-- Transacciones créditos
alter table transacciones_creditos enable row level security;
DROP POLICY IF EXISTS "Ver transacciones propias" ON "transacciones_creditos";

create policy "Ver transacciones propias" on transacciones_creditos for select using (auth.uid() = user_id);
DROP POLICY IF EXISTS "Insert propias" ON "transacciones_creditos";

create policy "Insert propias" on transacciones_creditos for insert with check (auth.uid() = user_id);

-- Trigger para actualizar actualizado_en
create or replace function actualizar_timestamp()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;
DROP TRIGGER IF EXISTS "actualizar_productos_ts" ON "productos";


create trigger actualizar_productos_ts before update on productos
  for each row execute procedure actualizar_timestamp();
DROP TRIGGER IF EXISTS "actualizar_perfiles_ts" ON "perfiles";


create trigger actualizar_perfiles_ts before update on perfiles
  for each row execute procedure actualizar_timestamp();
DROP FUNCTION IF EXISTS crear_perfil() CASCADE;


-- Trigger: crear perfil automáticamente al registrarse
create or replace function crear_perfil()
returns trigger as $$
begin
  insert into perfiles (id, nombre, telefono, estado, ciudad)
  values (
    new.id,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'estado',
    new.raw_user_meta_data->>'ciudad'
  );
  return new;
end;
$$ language plpgsql security definer;
DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";


create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure crear_perfil();

-- Habilitar Realtime para chat
-- (crea la publication si no existe y evita error si la tabla ya fue añadida)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
do $$
begin
  alter publication supabase_realtime add table mensajes;
exception
  when duplicate_object then null; -- ya estaba añadida
end $$;


-- ----- 002_chat.sql -----
-- Tabla de conversaciones
create table if not exists conversaciones (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references auth.users(id) on delete cascade not null,
  user2_id uuid references auth.users(id) on delete cascade not null,
  producto_id uuid references productos(id) on delete set null,
  ultimo_mensaje text,
  ultimo_mensaje_en timestamp with time zone,
  creado_en timestamp with time zone default now(),
  constraint distintos_usuarios check (user1_id != user2_id)
);

-- RLS conversaciones
alter table conversaciones enable row level security;
DROP POLICY IF EXISTS "Ver conversaciones propias" ON "conversaciones";


create policy "Ver conversaciones propias" on conversaciones for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);
DROP POLICY IF EXISTS "Crear conversaciones" ON "conversaciones";


create policy "Crear conversaciones" on conversaciones for insert
  with check (auth.uid() = user1_id);
DROP POLICY IF EXISTS "Actualizar conversaciones" ON "conversaciones";


create policy "Actualizar conversaciones" on conversaciones for update
  using (auth.uid() = user1_id or auth.uid() = user2_id);
DROP FUNCTION IF EXISTS crear_conversacion_si_no_existe() CASCADE;


-- Trigger para crear conversacion automatica al primer mensaje
create or replace function crear_conversacion_si_no_existe()
returns trigger as $$
declare
  conv_id uuid;
begin
  -- Buscar conversacion existente
  select id into conv_id from conversaciones
  where (
    (user1_id = NEW.remitente_id and user2_id = NEW.destinatario_id)
    or (user1_id = NEW.destinatario_id and user2_id = NEW.remitente_id)
  )
  and (producto_id = NEW.producto_id or (producto_id is null and NEW.producto_id is null))
  limit 1;

  -- Si no existe, crearla
  if conv_id is null then
    insert into conversaciones (user1_id, user2_id, producto_id)
    values (NEW.remitente_id, NEW.destinatario_id, NEW.producto_id)
    returning id into conv_id;
  end if;

  NEW.conversacion_id = conv_id;
  return NEW;
end;
$$ language plpgsql;
DROP TRIGGER IF EXISTS "trigger_crear_conversacion" ON "mensajes";


create trigger trigger_crear_conversacion
  before insert on mensajes
  for each row
  execute function crear_conversacion_si_no_existe();
DROP FUNCTION IF EXISTS actualizar_ultimo_mensaje() CASCADE;


-- Trigger para actualizar ultimo_mensaje
create or replace function actualizar_ultimo_mensaje()
returns trigger as $$
begin
  update conversaciones
  set ultimo_mensaje = NEW.contenido,
      ultimo_mensaje_en = NEW.creado_en
  where id = NEW.conversacion_id;
  return NEW;
end;
$$ language plpgsql;
DROP TRIGGER IF EXISTS "trigger_ultimo_mensaje" ON "mensajes";


create trigger trigger_ultimo_mensaje
  after insert on mensajes
  for each row
  execute function actualizar_ultimo_mensaje();

-- RLS mensajes (actualizar para incluir conversacion_id)
drop policy if exists "Ver mensajes" on mensajes;
DROP POLICY IF EXISTS "Ver mensajes" ON "mensajes";

create policy "Ver mensajes" on mensajes for select
  using (
    auth.uid() in (
      select user1_id from conversaciones where id = mensajes.conversacion_id
      union
      select user2_id from conversaciones where id = mensajes.conversacion_id
    )
  );

drop policy if exists "Enviar mensajes" on mensajes;
DROP POLICY IF EXISTS "Enviar mensajes" ON "mensajes";

create policy "Enviar mensajes" on mensajes for insert
  with check (auth.uid() = remitente_id);


-- ----- 002_sistema_auditoria.sql -----
-- Sistema de Auditoría
-- Registra automáticamente cambios en tablas críticas

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla_afectada TEXT NOT NULL,
  operacion TEXT NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id UUID,
  datos_antiguos JSONB,
  datos_nuevos JSONB,
  ip_address TEXT,
  user_agent TEXT,
  fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha_registro DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_operacion ON auditoria(operacion);

-- Función genérica para registrar auditoría
CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id UUID;
  v_datos_antiguos JSONB;
  v_datos_nuevos JSONB;
BEGIN
  -- Extraer usuario_id según la tabla
  IF TG_TABLE_NAME = 'productos' THEN
    v_usuario_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'perfiles' THEN
    v_usuario_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'mensajes' THEN
    v_usuario_id := COALESCE(NEW.remitente_id, OLD.remitente_id);
  ELSIF TG_TABLE_NAME = 'transacciones_creditos' THEN
    v_usuario_id := COALESCE(NEW.user_id, OLD.user_id);
  END IF;

  -- Preparar datos según operación
  IF TG_OP = 'INSERT' THEN
    v_datos_nuevos := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_datos_antiguos := to_jsonb(OLD);
    v_datos_nuevos := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_datos_antiguos := to_jsonb(OLD);
  END IF;

  -- Insertar registro de auditoría
  INSERT INTO auditoria (
    tabla_afectada,
    operacion,
    usuario_id,
    datos_antiguos,
    datos_nuevos
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_usuario_id,
    v_datos_antiguos,
    v_datos_nuevos
  );

  -- Retornar el registro apropiado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para tablas críticas

-- Productos: registrar cambios de precio, estado, moderación
DROP TRIGGER IF EXISTS trigger_auditoria_productos ON productos;
DROP TRIGGER IF EXISTS "trigger_auditoria_productos" ON "productos";

CREATE TRIGGER trigger_auditoria_productos
AFTER INSERT OR UPDATE OR DELETE ON productos
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Perfiles: registrar cambios de verificación, créditos
DROP TRIGGER IF EXISTS trigger_auditoria_perfiles ON perfiles;
DROP TRIGGER IF EXISTS "trigger_auditoria_perfiles" ON "perfiles";

CREATE TRIGGER trigger_auditoria_perfiles
AFTER INSERT OR UPDATE OR DELETE ON perfiles
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Mensajes: registrar envío y eliminación de mensajes
DROP TRIGGER IF EXISTS trigger_auditoria_mensajes ON mensajes;
DROP TRIGGER IF EXISTS "trigger_auditoria_mensajes" ON "mensajes";

CREATE TRIGGER trigger_auditoria_mensajes
AFTER INSERT OR UPDATE OR DELETE ON mensajes
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Transacciones de créditos: registrar todas las transacciones
DROP TRIGGER IF EXISTS trigger_auditoria_transacciones ON transacciones_creditos;
DROP TRIGGER IF EXISTS "trigger_auditoria_transacciones" ON "transacciones_creditos";

CREATE TRIGGER trigger_auditoria_transacciones
AFTER INSERT OR UPDATE OR DELETE ON transacciones_creditos
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Política RLS para auditoría
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin puede ver auditoría" ON "auditoria";


-- Solo administradores pueden ver auditoría (usando service_role en API)
CREATE POLICY "Admin puede ver auditoría" ON auditoria
FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
DROP POLICY IF EXISTS "Nadie puede insertar auditoría" ON "auditoria";


-- Nadie puede modificar auditoría manualmente (solo triggers)
CREATE POLICY "Nadie puede insertar auditoría" ON auditoria
FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "Nadie puede actualizar auditoría" ON "auditoria";


CREATE POLICY "Nadie puede actualizar auditoría" ON auditoria
FOR UPDATE USING (false);
DROP POLICY IF EXISTS "Nadie puede eliminar auditoría" ON "auditoria";


CREATE POLICY "Nadie puede eliminar auditoría" ON auditoria
FOR DELETE USING (false);

-- Vista útil para ver cambios recientes
CREATE OR REPLACE VIEW auditoria_resumen AS
SELECT 
  fecha_registro,
  tabla_afectada,
  operacion,
  usuario_id,
  CASE 
    WHEN operacion = 'INSERT' THEN 'Nuevo registro'
    WHEN operacion = 'UPDATE' THEN 'Modificado'
    WHEN operacion = 'DELETE' THEN 'Eliminado'
  END as descripcion,
  datos_nuevos->>'titulo' as titulo_producto,
  datos_antiguos->>'precio_usd' as precio_anterior,
  datos_nuevos->>'precio_usd' as precio_nuevo
FROM auditoria
ORDER BY fecha_registro DESC
LIMIT 100;

-- Función para limpiar auditoría antigua (más de 90 días)
CREATE OR REPLACE FUNCTION limpiar_auditoria_antigua()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM auditoria
  WHERE fecha_registro < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario explicativo
COMMENT ON TABLE auditoria IS 'Sistema de auditoría automática para rastrear cambios en tablas críticas';
COMMENT ON COLUMN auditoria.tabla_afectada IS 'Nombre de la tabla donde ocurrió el cambio';
COMMENT ON COLUMN auditoria.operacion IS 'Tipo de operación: INSERT, UPDATE, DELETE';
COMMENT ON COLUMN auditoria.usuario_id IS 'ID del usuario que realizó el cambio';
COMMENT ON COLUMN auditoria.datos_antiguos IS 'Datos antes del cambio (UPDATE/DELETE)';
COMMENT ON COLUMN auditoria.datos_nuevos IS 'Datos después del cambio (INSERT/UPDATE)';
COMMENT ON COLUMN auditoria.fecha_registro IS 'Timestamp del cambio';


-- ----- 003_chat_fix.sql -----
-- ============================================
-- FIX 1: Conversaciones duplicadas
-- Unique constraint (user1, user2, producto)
-- ============================================

-- Primero limpiar duplicados existentes (mantener el más antiguo)
DELETE FROM conversaciones a USING (
  SELECT MIN(ctid) as ctid, user1_id, user2_id, producto_id
  FROM conversaciones
  GROUP BY user1_id, user2_id, producto_id
  HAVING COUNT(*) > 1
) b
WHERE a.user1_id = b.user1_id
  AND a.user2_id = b.user2_id
  AND (a.producto_id = b.producto_id OR (a.producto_id IS NULL AND b.producto_id IS NULL))
  AND a.ctid <> b.ctid;

-- Añadir unique constraint para evitar duplicados futuros
-- Como PostgreSQL no permite NULL en unique simple, usamos dos constraints parciales
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_con_producto
  ON conversaciones (user1_id, user2_id, producto_id)
  WHERE producto_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_sin_producto
  ON conversaciones (user1_id, user2_id)
  WHERE producto_id IS NULL;

-- ============================================
-- FIX 2: Índice para el trigger (performance)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_conv_busqueda
  ON conversaciones (user1_id, user2_id, producto_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_por_conv
  ON mensajes (conversacion_id, creado_en);
DROP FUNCTION IF EXISTS crear_conversacion_si_no_existe() CASCADE;


-- ============================================
-- FIX 3: Mejorar trigger para evitar race conditions
-- ============================================
CREATE OR REPLACE FUNCTION crear_conversacion_si_no_existe()
RETURNS TRIGGER AS $$
DECLARE
  conv_id UUID;
  v_user1 UUID;
  v_user2 UUID;
BEGIN
  -- Normalizar: el menor user_id siempre va en user1_id
  IF NEW.remitente_id < NEW.destinatario_id THEN
    v_user1 := NEW.remitente_id;
    v_user2 := NEW.destinatario_id;
  ELSE
    v_user1 := NEW.destinatario_id;
    v_user2 := NEW.remitente_id;
  END IF;

  -- Buscar conversación existente (bidireccional)
  SELECT id INTO conv_id FROM conversaciones
  WHERE (
    (user1_id = v_user1 AND user2_id = v_user2)
    OR (user1_id = v_user2 AND user2_id = v_user1)
  )
  AND (
    (producto_id IS NOT NULL AND producto_id = NEW.producto_id)
    OR (producto_id IS NULL AND NEW.producto_id IS NULL)
  )
  ORDER BY creado_en ASC
  LIMIT 1;

  -- Si no existe, crearla
  IF conv_id IS NULL THEN
    INSERT INTO conversaciones (user1_id, user2_id, producto_id)
    VALUES (v_user1, v_user2, NEW.producto_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO conv_id;

    -- Si falló ON CONFLICT (race condition), reintentar fetch
    IF conv_id IS NULL THEN
      SELECT id INTO conv_id FROM conversaciones
      WHERE (
        (user1_id = v_user1 AND user2_id = v_user2)
        OR (user1_id = v_user2 AND user2_id = v_user1)
      )
      AND (
        (producto_id IS NOT NULL AND producto_id = NEW.producto_id)
        OR (producto_id IS NULL AND NEW.producto_id IS NULL)
      )
      ORDER BY creado_en ASC
      LIMIT 1;
    END IF;
  END IF;

  NEW.conversacion_id = conv_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ----- 003_chat_fixes.sql -----
-- ============================================
-- FIX: Conversaciones duplicadas + performance
-- ============================================

-- 1. Migrar columnas existentes de texto a UUID typed
-- (conversaciones.user1_id y user2_id ya son uuid en el schema original)

-- 2. Unique constraint para evitar duplicados
-- Una conversacion por par de usuarios + producto (mismo par + null producto = 1 sola)
-- NOTA: una CONSTRAINT UNIQUE de tabla no admite expresiones (COALESCE), por eso
-- se usan dos indices unicos parciales, soportados en todos los PostgreSQL:
ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS uq_conversaciones;
DROP INDEX IF EXISTS uq_conversaciones;
DROP INDEX IF EXISTS uq_conversaciones_null;
-- Limpieza del intento anterior con columna generada
ALTER TABLE conversaciones DROP COLUMN IF EXISTS _producto_normalized;
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversaciones      ON conversaciones (user1_id, user2_id, producto_id) WHERE producto_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversaciones_null ON conversaciones (user1_id, user2_id)               WHERE producto_id IS NULL;

-- 3. Índices para queries mas rapidas
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuarios ON conversaciones (user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_user2_user1 ON conversaciones (user2_id, user1_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_producto ON conversaciones (producto_id) WHERE producto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_creado ON mensajes (conversacion_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_mensajes_destinatario_leido ON mensajes (destinatario_id, leido);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON mensajes (conversacion_id);


-- ----- 003_chat_fixes_resenas.sql -----
-- ============================================
-- MIGRATION 003: Chat fixes + Reseñas + Métodos contacto + Foto perfil
-- ============================================

-- ─── FIX CHAT: Unique constraint para conversaciones duplicadas ───

-- Limpiar duplicados existentes (mantener el más antiguo por creado_en)
-- NOTA: no existe MIN(uuid) en PostgreSQL, se usa DISTINCT ON + creado_en
DELETE FROM conversaciones
WHERE id NOT IN (
  SELECT DISTINCT ON (LEAST(user1_id::text, user2_id::text), GREATEST(user1_id::text, user2_id::text), COALESCE(producto_id::text, 'null'))
         id
  FROM conversaciones
  ORDER BY LEAST(user1_id::text, user2_id::text), GREATEST(user1_id::text, user2_id::text),
           COALESCE(producto_id::text, 'null'), creado_en, id
);

-- Unique index bidireccional para conversaciones con producto
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_con_prod
  ON conversaciones (LEAST(user1_id::text, user2_id::text), GREATEST(user1_id::text, user2_id::text), producto_id)
  WHERE producto_id IS NOT NULL;

-- Unique index bidireccional para conversaciones sin producto
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_sin_prod
  ON conversaciones (LEAST(user1_id::text, user2_id::text), GREATEST(user1_id::text, user2_id::text))
  WHERE producto_id IS NULL;

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_mensajes_conv_fecha ON mensajes (conversacion_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_dest_leido ON mensajes (destinatario_id, leido) WHERE leido = false;
DROP FUNCTION IF EXISTS crear_conversacion_si_no_existe() CASCADE;


-- Mejorar trigger: normalizar user1 < user2 y evitar duplicados
CREATE OR REPLACE FUNCTION crear_conversacion_si_no_existe()
RETURNS TRIGGER AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Buscar conversación existente (bidireccional)
  SELECT id INTO conv_id FROM conversaciones
  WHERE (
    (user1_id = NEW.remitente_id AND user2_id = NEW.destinatario_id)
    OR (user1_id = NEW.destinatario_id AND user2_id = NEW.remitente_id)
  )
  AND (
    (producto_id IS NOT NULL AND producto_id = NEW.producto_id)
    OR (producto_id IS NULL AND NEW.producto_id IS NULL)
  )
  ORDER BY creado_en ASC
  LIMIT 1;

  -- Si no existe, crearla (ON CONFLICT para race conditions)
  IF conv_id IS NULL THEN
    INSERT INTO conversaciones (user1_id, user2_id, producto_id)
    VALUES (NEW.remitente_id, NEW.destinatario_id, NEW.producto_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO conv_id;

    -- Si otra petición la creó entre medias, recuperar
    IF conv_id IS NULL THEN
      SELECT id INTO conv_id FROM conversaciones
      WHERE (
        (user1_id = NEW.remitente_id AND user2_id = NEW.destinatario_id)
        OR (user1_id = NEW.destinatario_id AND user2_id = NEW.remitente_id)
      )
      AND (
        (producto_id IS NOT NULL AND producto_id = NEW.producto_id)
        OR (producto_id IS NULL AND NEW.producto_id IS NULL)
      )
      ORDER BY creado_en ASC
      LIMIT 1;
    END IF;
  END IF;

  NEW.conversacion_id = conv_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── FIX CHAT: Publicar conversaciones en realtime también ───
-- Asegurarnos que las conversaciones también se publican en realtime
-- (ejecutar en Supabase SQL Editor):
-- alter publication supabase_realtime add table conversaciones;

-- ─── METODOS DE CONTACTO POR PUBLICACIÓN ───

-- Agregar columna a productos para métodos de contacto
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS metodos_contacto JSONB DEFAULT '{"chat": true, "whatsapp": false, "telefono": false, "email": false}';

-- ─── FOTO DE PERFIL ───

ALTER TABLE perfiles
ADD COLUMN IF NOT EXISTS foto_perfil_url TEXT;

-- Nota: también crear bucket "foto_perfil" en Supabase Storage → Settings → Storage → nuevo bucket "foto_perfil" → público

-- ─── SISTEMA DE RESEÑAS ───

CREATE TABLE IF NOT EXISTS resenas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comprador_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  puntuacion INTEGER NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendedor_id, comprador_id, producto_id)
);

-- RLS para reseñas
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver todas las resenas" ON "resenas";


CREATE POLICY "Ver todas las resenas" ON resenas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Insert resenas (comprador)" ON "resenas";

CREATE POLICY "Insert resenas (comprador)" ON resenas FOR INSERT
  WITH CHECK (auth.uid() = comprador_id);
DROP POLICY IF EXISTS "Editar resenas propias" ON "resenas";

CREATE POLICY "Editar resenas propias" ON resenas FOR UPDATE
  USING (auth.uid() = comprador_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_resenas_vendedor ON resenas (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_resenas_comprador ON resenas (comprador_id);
DROP FUNCTION IF EXISTS crear_perfil() CASCADE;


-- ─── Trigger: crear perfil (sobreescribe para incluir foto por defecto si se añade en el futuro) ───
CREATE OR REPLACE FUNCTION crear_perfil()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre, telefono, estado, ciudad)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'telefono', ''),
    COALESCE(NEW.raw_user_meta_data->>'estado', ''),
    COALESCE(NEW.raw_user_meta_data->>'ciudad', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----- 003_rate_limit.sql -----
-- Rate limiting distribuido
-- Tabla para almacenar contadores de rate limit en Supabase
-- Esto funciona correctamente en Vercel serverless (DB compartida)

CREATE TABLE IF NOT EXISTS rate_limit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,              -- 'producto:create', 'auth:login', etc.
  identifier TEXT NOT NULL,       -- userId o IP address
  ip TEXT,                        -- IP del request (para análisis)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_created ON rate_limit(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON rate_limit(key, identifier, created_at);

-- RLS: nadie puede leer rate_limit directamente
ALTER TABLE rate_limit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Nadie lee rate_limit" ON "rate_limit";

CREATE POLICY "Nadie lee rate_limit" ON rate_limit FOR SELECT USING (false);
DROP POLICY IF EXISTS "System inserta rate_limit" ON "rate_limit";

CREATE POLICY "System inserta rate_limit" ON rate_limit FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "System elimina rate_limit" ON "rate_limit";

CREATE POLICY "System elimina rate_limit" ON rate_limit FOR DELETE USING (true);

-- Función para limpiar registros antiguos (> 24 horas)
CREATE OR REPLACE FUNCTION clean_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM rate_limit
  WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----- 004_creditos.sql -----
-- Todo Anuncios: Sistema de créditos — Boost + Destacados
-- Ejecutar en Supabase SQL Editor

-- 1. Columna boosteado_en: cuándo se hizo el último boost (1 crédito)
alter table productos add column if not exists boosteado_en timestamp with time zone;

-- 2. Función RPC: ordenar productos por prioridad
-- boost (reciente) → destacado (vigente) → normales (reciente)
create or replace function obtener_productos_ordenados(
  p_categoria_id integer default null,
  p_subcategoria text default null,
  p_marca text default null,
  p_estado text default null,
  p_ubicacion_estado text default null,
  p_ubicacion_ciudad text default null,
  p_busqueda text default null,
  p_precio_min decimal default null,
  p_precio_max decimal default null,
  p_limite integer default 200,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  titulo text,
  descripcion text,
  categoria_id integer,
  subcategoria text,
  marca text,
  modelo text,
  estado text,
  precio_usd decimal,
  ubicacion_estado text,
  ubicacion_ciudad text,
  imagen_url text,
  imagenes text[],
  activo boolean,
  destacado boolean,
  destacado_hasta timestamp with time zone,
  visitas integer,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  boosteado_en timestamp with time zone
)
language plpgsql
stable
as $$
begin
  return query
  select
    p.id, p.user_id, p.titulo, p.descripcion, p.categoria_id,
    p.subcategoria, p.marca, p.modelo, p.estado, p.precio_usd,
    p.ubicacion_estado, p.ubicacion_ciudad, p.imagen_url,
    p.imagenes, p.activo, p.destacado, p.destacado_hasta,
    p.visitas, p.creado_en, p.actualizado_en, p.boosteado_en
  from productos p
  where p.activo = true
    -- Filtros dinámicos
    and (p_categoria_id is null or p.categoria_id = p_categoria_id)
    and (p_subcategoria is null or p.subcategoria = p_subcategoria)
    and (p_marca is null or p.marca = p_marca)
    and (p_estado is null or p.estado = p_estado)
    and (p_ubicacion_estado is null or p.ubicacion_estado = p_ubicacion_estado)
    and (p_ubicacion_ciudad is null or p.ubicacion_ciudad = p_ubicacion_ciudad)
    and (p_busqueda is null or p.titulo ilike '%' || p_busqueda || '%')
    and (p_precio_min is null or p.precio_usd >= p_precio_min)
    and (p_precio_max is null or p.precio_usd <= p_precio_max)
  order by
    -- 1º Boost activos: ordenados por cuándo se hicieron (más reciente primero)
    case when p.boosteado_en is not null then 0 else 1 end,
    p.boosteado_en desc nulls last,
    -- 2º Destacados vigentes
    case when p.destacado = true and p.destacado_hasta > now() then 0 else 1 end,
    p.destacado_hasta desc nulls last,
    -- 3º Normales por fecha
    p.creado_en desc
  limit p_limite
  offset p_offset;
end;
$$;

-- 3. Función RPC: obtener productos destacados (para home)
drop function if exists obtener_destacados_home(integer) CASCADE;
create or replace function obtener_destacados_home(
  p_limite integer default 8
)
returns table (
  id uuid,
  user_id uuid,
  titulo text,
  descripcion text,
  categoria_id integer,
  subcategoria text,
  marca text,
  modelo text,
  estado text,
  precio_usd decimal,
  ubicacion_estado text,
  ubicacion_ciudad text,
  imagen_url text,
  imagenes text[],
  activo boolean,
  destacado boolean,
  destacado_hasta timestamp with time zone,
  visitas integer,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  boosteado_en timestamp with time zone
)
language plpgsql
stable
as $$
begin
  return query
  select
    p.id, p.user_id, p.titulo, p.descripcion, p.categoria_id,
    p.subcategoria, p.marca, p.modelo, p.estado, p.precio_usd,
    p.ubicacion_estado, p.ubicacion_ciudad, p.imagen_url,
    p.imagenes, p.activo, p.destacado, p.destacado_hasta,
    p.visitas, p.creado_en, p.actualizado_en, p.boosteado_en
  from productos p
  where p.activo = true
    and p.destacado = true
    and p.destacado_hasta > now()
  order by p.destacado_hasta desc
  limit p_limite;
end;
$$;
DROP FUNCTION IF EXISTS usar_boost(uuid, uuid) CASCADE;


-- 4. Función RPC: usar crédito para BOOST (sube al #1)
create or replace function usar_boost(
  p_producto_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_balance integer;
  v_owner uuid;
begin
  -- Verificar que el producto pertenece al usuario
  select user_id into v_owner from productos where id = p_producto_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  -- Verificar balance
  select credito_balance into v_balance from perfiles where id = p_user_id;
  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes');
  end if;

  -- Aplicar boost
  update productos set boosteado_en = now() where id = p_producto_id;

  -- Descontar crédito
  update perfiles set credito_balance = credito_balance - 1 where id = p_user_id;

  -- Registrar transacción
  insert into transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (p_user_id, 'gasto', 1, 'boost', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance - 1);
end;
$$;
DROP FUNCTION IF EXISTS usar_destacado(uuid, uuid, int4) CASCADE;


-- 5. Función RPC: usar créditos para DESTACADO
create or replace function usar_destacado(
  p_producto_id uuid,
  p_user_id uuid,
  p_horas integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_balance integer;
  v_owner uuid;
  v_costo integer;
begin
  -- Verificar producto
  select user_id into v_owner from productos where id = p_producto_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  -- Calcular costo
  v_costo := case
    when p_horas <= 12 then 4
    when p_horas <= 24 then 6
    else 10
  end;

  -- Verificar balance
  select credito_balance into v_balance from perfiles where id = p_user_id;
  if v_balance < v_costo then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes (necesitas ' || v_costo || ')');
  end if;

  -- Activar destacado
  update productos
  set destacado = true,
      destacado_hasta = now() + (p_horas || ' hours')::interval
  where id = p_producto_id;

  -- Descontar créditos
  update perfiles set credito_balance = credito_balance - v_costo where id = p_user_id;

  -- Registrar transacción
  insert into transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (p_user_id, 'gasto', v_costo, 'destacado_' || p_horas || 'h', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance - v_costo, 'hasta', now() + (p_horas || ' hours')::interval);
end;
$$;
DROP FUNCTION IF EXISTS aprobar_transaccion(uuid, uuid) CASCADE;


-- 6. Función RPC: aprobar transacción y añadir créditos (admin)
create or replace function aprobar_transaccion(
  p_transaccion_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_monto integer;
  v_estado text;
  v_tipo text;
begin
  select user_id, monto, estado, tipo
  into v_user_id, v_monto, v_estado, v_tipo
  from transacciones_creditos
  where id = p_transaccion_id;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Transacción no encontrada');
  end if;
  if v_estado != 'pendiente' then
    return jsonb_build_object('ok', false, 'error', 'Transacción ya procesada');
  end if;
  if v_tipo != 'compra' then
    return jsonb_build_object('ok', false, 'error', 'Solo se pueden aprobar compras');
  end if;

  -- Actualizar transacción
  update transacciones_creditos set estado = 'aprobado' where id = p_transaccion_id;

  -- Añadir créditos
  update perfiles set credito_balance = credito_balance + v_monto where id = v_user_id;

  return jsonb_build_object('ok', true, 'creditos_anadidos', v_monto);
end;
$$;

-- 7. Habilitar llamadas RPC al anon (ya están habilitadas por defecto con security definer)
grant execute on function obtener_productos_ordenados to anon, authenticated;
grant execute on function obtener_destacados_home to anon, authenticated;
grant execute on function usar_boost to authenticated;
grant execute on function usar_destacado to authenticated;
grant execute on function aprobar_transaccion to authenticated;


-- ----- 005_storage_comprobantes.sql -----
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


-- ----- 006_chat_unique_constraint.sql -----
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


-- ----- 007_chat_fix_trigger.sql -----
-- Fix: Trigger de mensajes robusto contra duplicados de conversación
-- Drop the old trigger and function, recreate with proper guard

DROP TRIGGER IF EXISTS trigger_crear_conversacion ON mensajes;
DROP FUNCTION IF EXISTS crear_conversacion_si_no_existe() CASCADE;

-- Recreate function with proper dedup
CREATE OR REPLACE FUNCTION crear_conversacion_si_no_existe()
RETURNS trigger AS $$
DECLARE
  conv_id uuid;
  u1 uuid;
  u2 uuid;
BEGIN
  -- Normalize: smaller ID first for consistent ordering
  IF NEW.remitente_id < NEW.destinatario_id THEN
    u1 := NEW.remitente_id;
    u2 := NEW.destinatario_id;
  ELSE
    u1 := NEW.destinatario_id;
    u2 := NEW.remitente_id;
  END IF;

  -- Buscar conversacion existente (ordenado para evitar duplicados)
  SELECT id INTO conv_id FROM conversaciones
  WHERE 
    ((user1_id = u1 AND user2_id = u2)
     OR (user1_id = u2 AND user2_id = u1))
    AND (producto_id = NEW.producto_id
         OR (producto_id IS NULL AND NEW.producto_id IS NULL))
  ORDER BY creado_en ASC
  LIMIT 1;

  IF conv_id IS NULL THEN
    -- Create always with normalized order to prevent OR-direction dups
    INSERT INTO conversaciones (user1_id, user2_id, producto_id)
    VALUES (u1, u2, NEW.producto_id)
    RETURNING id INTO conv_id;
  END IF;

  NEW.conversacion_id = conv_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trigger_crear_conversacion" ON "mensajes";


-- Recreate trigger
CREATE TRIGGER trigger_crear_conversacion
  BEFORE INSERT ON mensajes
  FOR EACH ROW
  EXECUTE FUNCTION crear_conversacion_si_no_existe();

-- Drop old unique constraint if it exists and recreate properly
ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS uq_conversacion;
ALTER TABLE conversaciones
  ADD CONSTRAINT uq_conversacion UNIQUE (user1_id, user2_id, producto_id);


-- ----- 008_moderacion.sql -----
--
-- 008_moderacion.sql
-- Sistema de moderación: estado de publicación, tabla denuncias, auto-bloqueo
--

-- 1. Agregar columna de moderación a productos
ALTER TABLE productos 
  ADD COLUMN IF NOT EXISTS estado_moderacion TEXT DEFAULT 'aprobado' 
    CHECK (estado_moderacion IN ('aprobado', 'pendiente', 'revisando', 'rechazado')),
  ADD COLUMN IF NOT EXISTS motivo_moderacion TEXT;

-- 2. Tabla de denuncias (reportes de usuarios)
CREATE TABLE IF NOT EXISTS denuncias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  reportante_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'resuelta', 'invalidada')),
  creada_en TIMESTAMPTZ DEFAULT now(),
  resuelta_en TIMESTAMPTZ,
  administrador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(producto_id, reportante_id)
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_denuncias_producto ON denuncias(producto_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_estado ON denuncias(estado);

-- 3. Trigger: auto-bloquear producto con 3+ reportes
CREATE OR REPLACE FUNCTION fn_bloquear_por_denuncias()
RETURNS TRIGGER AS $$
DECLARE
  conteo INT;
BEGIN
  SELECT COUNT(*) INTO conteo
  FROM denuncias
  WHERE producto_id = NEW.producto_id
    AND estado = 'activa';
  
  IF conteo >= 3 THEN
    UPDATE productos
    SET estado_moderacion = 'rechazado',
        motivo_moderacion = 'Bloqueado automáticamente: ' || conteo || ' denuncias'
    WHERE id = NEW.producto_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bloquear_por_denuncias ON denuncias;
DROP TRIGGER IF EXISTS "trg_bloquear_por_denuncias" ON "denuncias";

CREATE TRIGGER trg_bloquear_por_denuncias
  AFTER INSERT ON denuncias
  FOR EACH ROW
  EXECUTE FUNCTION fn_bloquear_por_denuncias();

-- 4. RLS Policies para denuncias
ALTER TABLE denuncias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin ve todas las denuncias" ON "denuncias";


-- Solo el admin puede ver todas
CREATE POLICY "Admin ve todas las denuncias" ON denuncias
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid()
      AND p.nombre = 'Admin' -- o validar email directamente
    )
  );
DROP POLICY IF EXISTS "Usuarios pueden denunciar" ON "denuncias";


-- Usuario puede crear denuncia
CREATE POLICY "Usuarios pueden denunciar" ON denuncias
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Usuarios ven sus denuncias" ON "denuncias";


-- Usuario puede ver sus propias denuncias
CREATE POLICY "Usuarios ven sus denuncias" ON denuncias
  FOR SELECT USING (auth.uid() = reportante_id);

-- 5. Productos: solo mostrar aprobados por defecto
-- Nota: El catálogo ya filtra por activo=true, ahora filtra también por estado_moderacion
-- El admin puede ver todos

-- 6. Función para contar denuncias por producto (útil para admin)
CREATE OR REPLACE FUNCTION contar_denuncias_activas(pid UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM denuncias
  WHERE producto_id = pid AND estado = 'activa';
$$ LANGUAGE sql STABLE;

COMMENT ON COLUMN productos.estado_moderacion IS 'Estado de moderación: aprobado, pendiente, revisando, rechazado';
COMMENT ON TABLE denuncias IS 'Denuncias realizadas por usuarios sobre publicaciones';


-- ----- 009_verificacion.sql -----
--
-- 009_verificacion.sql -- Sistema de Vendedor Verificado
--

-- 1. Columnas de verificacion en perfiles
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS verificado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verificado_desde TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cedula_foto_url TEXT,
  ADD COLUMN IF NOT EXISTS cedula_numero TEXT,
  ADD COLUMN IF NOT EXISTS pago_movil_telefono TEXT,
  ADD COLUMN IF NOT EXISTS pago_movil_cedula TEXT,
  ADD COLUMN IF NOT EXISTS pago_movil_banco TEXT;

-- 2. Tabla de solicitudes de verificacion
CREATE TABLE IF NOT EXISTS solicitudes_verificacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  pago_movil_telefono TEXT,
  pago_movil_cedula TEXT,
  pago_movil_banco TEXT,
  cedula_foto_frente_url TEXT,
  cedula_foto_dorso_url TEXT,
  mensaje TEXT,
  rechazo_motivo TEXT,
  creada_en TIMESTAMPTZ DEFAULT now(),
  revisada_en TIMESTAMPTZ,
  administrador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Solo permitir una solicitud pendiente o aprobada por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitud_unica_pendiente
  ON solicitudes_verificacion(user_id)
  WHERE estado = 'pendiente';

CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitud_unica_aprobada
  ON solicitudes_verificacion(user_id)
  WHERE estado = 'aprobada';

-- 3. Storage bucket para cedulas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cedulas', 'cedulas', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Usuarios suben sus propias cedulas" ON "storage"."objects";


-- RLS Policies para cedulas bucket
CREATE POLICY "Usuarios suben sus propias cedulas" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cedulas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "Usuarios ven sus propias cedulas" ON "storage"."objects";


CREATE POLICY "Usuarios ven sus propias cedulas" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cedulas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "Admin ve todas las cedulas" ON "storage"."objects";


CREATE POLICY "Admin ve todas las cedulas" ON storage.objects
  FOR SELECT USING (bucket_id = 'cedulas');

-- 4. RLS Policies para solicitudes_verificacion
ALTER TABLE solicitudes_verificacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus solicitudes" ON solicitudes_verificacion;
DROP POLICY IF EXISTS "Usuarios ven sus solicitudes" ON "solicitudes_verificacion";

CREATE POLICY "Usuarios ven sus solicitudes" ON solicitudes_verificacion
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios crean solicitudes" ON solicitudes_verificacion;
DROP POLICY IF EXISTS "Usuarios crean solicitudes" ON "solicitudes_verificacion";

CREATE POLICY "Usuarios crean solicitudes" ON solicitudes_verificacion
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin ve todas las solicitudes" ON solicitudes_verificacion;
DROP POLICY IF EXISTS "Admin ve todas las solicitudes" ON "solicitudes_verificacion";

CREATE POLICY "Admin ve todas las solicitudes" ON solicitudes_verificacion
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin actualiza solicitudes" ON solicitudes_verificacion;
DROP POLICY IF EXISTS "Admin actualiza solicitudes" ON "solicitudes_verificacion";

CREATE POLICY "Admin actualiza solicitudes" ON solicitudes_verificacion
  FOR UPDATE USING (true);


-- ----- 010_badge_vendedor_en_cards.sql -----
--
-- 010_badge_vendedor_en_cards.sql
-- Columna denormalizada en productos para mostrar badge en cards sin joins
--

-- 1. Columna
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS vendedor_verificado BOOLEAN DEFAULT false;

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
DROP TRIGGER IF EXISTS "trg_propagar_verificado" ON "perfiles";

CREATE TRIGGER trg_propagar_verificado
  AFTER UPDATE OF verificado ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_propagar_verificado();


-- ----- 011_chat_fix_create_conv.sql -----
-- 011_chat_fix_create_conv.sql
-- Fix 1: RLS policy para permitir crear conversación cuando el usuario es user1 o user2
DROP POLICY IF EXISTS "Crear conversaciones" ON conversaciones;
DROP POLICY IF EXISTS "Crear conversaciones" ON "conversaciones";

CREATE POLICY "Crear conversaciones" ON conversaciones FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Fix 2: Unique constraint para evitar duplicados
-- Evita que se creen múltiples conversaciones entre mismo usuario + producto
ALTER TABLE conversaciones
  DROP CONSTRAINT IF EXISTS conversaciones_usuario_producto_unique;


-- ----- 011_credito_sistema.sql -----
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
DROP TRIGGER IF EXISTS "trg_pack_emprendedor" ON "productos";

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
DROP TRIGGER IF EXISTS "trg_recalc_emprendedor" ON "productos";

CREATE TRIGGER trg_recalc_emprendedor
  AFTER DELETE OR UPDATE OF activo ON productos
  FOR EACH ROW
  EXECUTE FUNCTION trg_recalcular_emprendedor();

-- 8. Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_transacciones_tipo ON transacciones_creditos(tipo);
CREATE INDEX IF NOT EXISTS idx_transacciones_user_tipo ON transacciones_creditos(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_productos_user_activo ON productos(user_id, activo);
DROP POLICY IF EXISTS "Eliminar conversaciones propias" ON "conversaciones";



-- ----- 012_delete_policies.sql -----
-- Migration 012: Allow users to delete their own conversations and messages

-- DELETE policy for conversaciones: user can delete if they are user1 or user2
create policy "Eliminar conversaciones propias" on conversaciones for delete
  using (auth.uid() = user1_id or auth.uid() = user2_id);
DROP POLICY IF EXISTS "Eliminar mensajes propios" ON "mensajes";


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


-- ----- 012_reputacion.sql -----
-- Migration 012: Sistema de Reputación del Vendedor
-- Calcula automáticamente: nivel_confianza, badges_automaticos

-- 1. Columnas nuevas en perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS nivel_confianza SMALLINT DEFAULT 0;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS badges_automaticos TEXT[] DEFAULT '{}';
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS tasa_respuesta SMALLINT DEFAULT NULL;

-- 2. Trigger para calcular reputación automáticamente al cambiar datos relevantes

CREATE OR REPLACE FUNCTION fn_calcular_reputacion()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_verificado BOOLEAN;
  v_verificado_desde TIMESTAMPTZ;
  v_promedio_stars NUMERIC;
  v_num_resenas INTEGER;
  v_num_pubs INTEGER;
  v_num_pubs_vendidas INTEGER;
  v_antiguedad_dias INTEGER;
  v_ultima_pub TIMESTAMPTZ;
  v_score INTEGER := 0;
  v_badges TEXT[] := '{}';
BEGIN
  v_user_id := COALESCE(NEW.id, OLD.id);

  -- Obtener datos del perfil
  SELECT verificado, verificado_desde,
         EXTRACT(DAY FROM NOW() - creado_en)::INTEGER
    INTO v_verificado, v_verificado_desde, v_antiguedad_dias
    FROM perfiles
    WHERE id = v_user_id;

  -- Obtener reseñas del vendedor
  SELECT COALESCE(AVG(puntuacion), 0), COUNT(*)
    INTO v_promedio_stars, v_num_resenas
    FROM resenas
    WHERE vendedor_id = v_user_id;

  -- Obtener publicaciones
  SELECT COUNT(*) INTO v_num_pubs
    FROM productos WHERE user_id = v_user_id AND activo = true;

  SELECT COUNT(*) INTO v_num_pubs_vendidas
    FROM productos WHERE user_id = v_user_id AND activo = false
      AND estado_moderacion != 'rechazado';

  -- Última actividad (última publicación o actualización de perfil)
  SELECT MAX(creado_en) INTO v_ultima_pub
    FROM productos WHERE user_id = v_user_id;

  -- ===== CALCULAR SCORE =====

  -- Verificación: 0, 10, o 20 pts
  IF v_verificado THEN v_score := v_score + 20;
  END IF;

  -- Reseñas (máx 30 pts)
  IF v_num_resenas >= 10 AND v_promedio_stars >= 4.5 THEN
    v_score := v_score + 30;
  ELSIF v_num_resenas >= 5 AND v_promedio_stars >= 4.0 THEN
    v_score := v_score + 20;
  ELSIF v_num_resenas >= 1 AND v_promedio_stars >= 3.5 THEN
    v_score := v_score + 10;
  ELSIF v_num_resenas >= 1 THEN
    v_score := v_score + 5;
  END IF;

  -- Antigüedad (máx 15 pts)
  IF v_antiguedad_dias >= 365 THEN v_score := v_score + 15;
  ELSIF v_antiguedad_dias >= 90 THEN v_score := v_score + 10;
  ELSIF v_antiguedad_dias >= 30 THEN v_score := v_score + 5;
  END IF;

  -- Actividad: publicaciones activas (máx 15 pts)
  IF v_num_pubs >= 20 THEN v_score := v_score + 15;
  ELSIF v_num_pubs >= 10 THEN v_score := v_score + 10;
  ELSIF v_num_pubs >= 5 THEN v_score := v_score + 5;
  ELSIF v_num_pubs >= 1 THEN v_score := v_score + 3;
  END IF;

  -- Publicaciones vendidas (máx 10 pts)
  IF v_num_pubs_vendidas >= 20 THEN v_score := v_score + 10;
  ELSIF v_num_pubs_vendidas >= 10 THEN v_score := v_score + 7;
  ELSIF v_num_pubs_vendidas >= 5 THEN v_score := v_score + 4;
  ELSIF v_num_pubs_vendidas >= 1 THEN v_score := v_score + 2;
  END IF;

  -- Últimamente activo (últimos 7 días): +10pts
  IF v_ultima_pub IS NOT NULL AND v_ultima_pub > NOW() - INTERVAL '7 days' THEN
    v_score := v_score + 10;
  END IF;

  -- ===== NIVEL (0-5 estrellas) =====
  -- Score máximo: 100
  -- 0-9: 0 estrellas (novato)
  -- 10-24: 1 estrella
  -- 25-44: 2 estrellas
  -- 45-64: 3 estrellas
  -- 65-84: 4 estrellas
  -- 85+: 5 estrellas
  IF v_score >= 85 THEN v_score := 5;
  ELSIF v_score >= 65 THEN v_score := 4;
  ELSIF v_score >= 45 THEN v_score := 3;
  ELSIF v_score >= 25 THEN v_score := 2;
  ELSIF v_score >= 10 THEN v_score := 1;
  ELSE v_score := 0;
  END IF;

  -- ===== BADGES AUTOMÁTICOS =====
  -- Vendedor Activo (publicó en los últimos 7 días y tiene +3 pubs)
  IF v_num_pubs >= 3 AND v_ultima_pub IS NOT NULL AND v_ultima_pub > NOW() - INTERVAL '7 days' THEN
    v_badges := array_append(v_badges, 'vendedor_activo');
  END IF;

  -- +50 ventas
  IF v_num_pubs_vendidas >= 50 THEN
    v_badges := array_append(v_badges, '50_ventas');
  ELSIF v_num_pubs_vendidas >= 20 THEN
    v_badges := array_append(v_badges, '20_ventas');
  ELSIF v_num_pubs_vendidas >= 10 THEN
    v_badges := array_append(v_badges, '10_ventas');
  END IF;

  -- +100 publicaciones
  IF v_num_pubs + v_num_pubs_vendidas >= 100 THEN
    v_badges := array_append(v_badges, '100_publicaciones');
  ELSIF v_num_pubs + v_num_pubs_vendidas >= 50 THEN
    v_badges := array_append(v_badges, '50_publicaciones');
  ELSIF v_num_pubs + v_num_pubs_vendidas >= 20 THEN
    v_badges := array_append(v_badges, '20_publicaciones');
  END IF;

  -- Reseñas positivas (5+ con 4.0+)
  IF v_num_resenas >= 10 AND v_promedio_stars >= 4.5 THEN
    v_badges := array_append(v_badges, 'top_vendedor');
  ELSIF v_num_resenas >= 5 AND v_promedio_stars >= 4.0 THEN
    v_badges := array_append(v_badges, 'buena_reputacion');
  END IF;

  -- Actualizar perfil
  UPDATE perfiles
  SET nivel_confianza = v_score,
      badges_automaticos = v_badges,
      ultima_actividad = COALESCE(v_ultima_pub, actualizado_en)
  WHERE id = v_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers: disparar reputación cuando cambien datos relevantes

-- Después de cualquier update en perfiles
DROP TRIGGER IF EXISTS trg_calc_reputacion ON perfiles;
DROP TRIGGER IF EXISTS "trg_calc_reputacion" ON "perfiles";

CREATE TRIGGER trg_calc_reputacion
  AFTER INSERT OR UPDATE ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_calcular_reputacion();

-- Después de insertar/rechazar producto (cambia reputación vendedor)
DROP TRIGGER IF EXISTS trg_calc_reputacion_prod ON productos;
DROP TRIGGER IF EXISTS "trg_calc_reputacion_prod" ON "productos";

CREATE TRIGGER trg_calc_reputacion_prod
  AFTER INSERT OR UPDATE OF activo, estado_moderacion ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_calcular_reputacion();

-- Después de insertar reseña
DROP TRIGGER IF EXISTS trg_calc_reputacion_resena ON resenas;
DROP TRIGGER IF EXISTS "trg_calc_reputacion_resena" ON "resenas";

CREATE TRIGGER trg_calc_reputacion_resena
  AFTER INSERT OR UPDATE ON resenas
  FOR EACH ROW
  EXECUTE FUNCTION fn_calcular_reputacion();

-- 3. Calcular reputación para todos los usuarios existentes
SELECT id FROM perfiles
WHERE id IN (SELECT DISTINCT user_id FROM productos WHERE activo = true)
   OR id IN (SELECT DISTINCT vendedor_id FROM resenas);

-- Actualizar manualmente (el trigger se dispara con UPDATE)
UPDATE perfiles SET actualizado_en = actualizado_en;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_perfiles_level ON perfiles(nivel_confianza);
CREATE INDEX IF NOT EXISTS idx_productos_vendido ON productos(user_id, activo, estado_moderacion);


-- ----- 013_mensajes_insert.sql -----
-- Migration 013: Fix INSERT policy on mensajes
-- Previous JOIN-based policy blocks when conversation doesn't exist yet.
-- The trigger on mensajes creates conversations on first insert.
-- This policy simply requires: sender must be the authenticated user.

drop policy if exists "Enviar mensajes" on mensajes;
DROP POLICY IF EXISTS "Enviar mensajes" ON "mensajes";


create policy "Enviar mensajes" on mensajes for insert
  with check (auth.uid() = remitente_id);


-- ----- 014_chat_reset.sql -----
-- ============================================
-- MIGRACIÓN 014: Chat limpio desde cero
-- Drop and recreate conversaciones + mensajes
-- con policies correctas (sin joins rotos)
-- ============================================

-- 1. Drop triggers
DROP TRIGGER IF EXISTS trigger_crear_conversacion ON mensajes;
DROP TRIGGER IF EXISTS trigger_ultimo_mensaje ON mensajes;
DROP FUNCTION IF EXISTS crear_conversacion_si_no_existe() CASCADE;
DROP FUNCTION IF EXISTS actualizar_ultimo_mensaje() CASCADE;

-- 2. Drop policies
DROP POLICY IF EXISTS "Ver mensajes" ON mensajes;
DROP POLICY IF EXISTS "Enviar mensajes" ON mensajes;
DROP POLICY IF EXISTS "Ver conversaciones propias" ON conversaciones;
DROP POLICY IF EXISTS "Crear conversaciones" ON conversaciones;
DROP POLICY IF EXISTS "Actualizar conversaciones" ON conversaciones;
DROP POLICY IF EXISTS "Eliminar conversaciones propias" ON conversaciones;
DROP POLICY IF EXISTS "Eliminar mensajes propios" ON mensajes;

-- 3. Drop tables (cascade borra policies e índices también)
DROP TABLE IF EXISTS mensajes CASCADE;
DROP TABLE IF EXISTS conversaciones CASCADE;

-- 4. Recrear conversaciones
CREATE TABLE IF NOT EXISTS conversaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  ultimo_mensaje TEXT,
  ultimo_mensaje_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user1_id != user2_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_user1 ON conversaciones(user1_id);
CREATE INDEX IF NOT EXISTS idx_conv_user2 ON conversaciones(user2_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_producto ON conversaciones(user1_id, user2_id, producto_id) WHERE producto_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_sin_producto ON conversaciones(user1_id, user2_id) WHERE producto_id IS NULL;

-- 5. Recrear mensajes
CREATE TABLE IF NOT EXISTS mensajes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversacion_id UUID REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente_id UUID REFERENCES auth.users(id),
  destinatario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  producto_id UUID,
  contenido TEXT NOT NULL,
  leido BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON mensajes(conversacion_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_msg_remitente ON mensajes(remitente_id);
CREATE INDEX IF NOT EXISTS idx_msg_destinatario_leido ON mensajes(destinatario_id, leido) WHERE leido = FALSE;

-- 6. Enable RLS
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conv_select" ON "conversaciones";


-- 7. RLS conversaciones
CREATE POLICY "conv_select" ON conversaciones FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS "conv_insert" ON "conversaciones";


CREATE POLICY "conv_insert" ON conversaciones FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS "conv_update" ON "conversaciones";


CREATE POLICY "conv_update" ON conversaciones FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS "conv_delete" ON "conversaciones";


CREATE POLICY "conv_delete" ON conversaciones FOR DELETE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
DROP POLICY IF EXISTS "msg_select" ON "mensajes";


-- 8. RLS mensajes
-- SELECT: el usuario debe ser parte de la conversacion
CREATE POLICY "msg_select" ON mensajes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversaciones
    WHERE conversaciones.id = mensajes.conversacion_id
    AND (conversaciones.user1_id = auth.uid() OR conversaciones.user2_id = auth.uid())
  ));
DROP POLICY IF EXISTS "msg_insert" ON "mensajes";


-- INSERT: solo verificar que el remitente sea el usuario logueado
-- (sin JOINs — el trigger crea la conversacion si hace falta)
CREATE POLICY "msg_insert" ON mensajes FOR INSERT
  WITH CHECK (auth.uid() = remitente_id);
DROP POLICY IF EXISTS "msg_update" ON "mensajes";


-- UPDATE: marcar como leído (solo destinatario)
CREATE POLICY "msg_update" ON mensajes FOR UPDATE
  USING (auth.uid() = destinatario_id);
DROP POLICY IF EXISTS "msg_delete" ON "mensajes";


-- DELETE: solo si el usuario es parte de la conversación
CREATE POLICY "msg_delete" ON mensajes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM conversaciones
    WHERE conversaciones.id = mensajes.conversacion_id
    AND (conversaciones.user1_id = auth.uid() OR conversaciones.user2_id = auth.uid())
  ));
DROP FUNCTION IF EXISTS crear_conversacion_si_no_existe() CASCADE;


-- 9. Trigger: crear conversacion al insertar mensaje
CREATE OR REPLACE FUNCTION crear_conversacion_si_no_existe()
RETURNS TRIGGER AS $$
DECLARE
  v_conv_id UUID;
  v_u1 UUID;
  v_u2 UUID;
BEGIN
  -- Normalizar: menor ID primero
  IF NEW.remitente_id < NEW.destinatario_id THEN
    v_u1 := NEW.remitente_id;
    v_u2 := NEW.destinatario_id;
  ELSE
    v_u1 := NEW.destinatario_id;
    v_u2 := NEW.remitente_id;
  END IF;

  -- Buscar conversación existente
  SELECT id INTO v_conv_id FROM conversaciones
  WHERE user1_id = v_u1 AND user2_id = v_u2
  AND producto_id IS NOT DISTINCT FROM NEW.producto_id
  LIMIT 1;

  -- Si no existe, crearla
  IF v_conv_id IS NULL THEN
    INSERT INTO conversaciones (user1_id, user2_id, producto_id)
    VALUES (v_u1, v_u2, NEW.producto_id)
    RETURNING id INTO v_conv_id;
  END IF;

  -- Si por alguna razón el mensaje ya tiene conversacion_id pero no coincide
  -- con la encontrada/creada, corregirlo
  IF NEW.conversacion_id IS NULL OR NEW.conversacion_id != v_conv_id THEN
    NEW.conversacion_id = v_conv_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trigger_crear_conversacion" ON "mensajes";


CREATE TRIGGER trigger_crear_conversacion
  BEFORE INSERT ON mensajes
  FOR EACH ROW
  EXECUTE FUNCTION crear_conversacion_si_no_existe();
DROP FUNCTION IF EXISTS actualizar_ultimo_mensaje() CASCADE;


-- 10. Trigger: actualizar ultimo_mensaje
CREATE OR REPLACE FUNCTION actualizar_ultimo_mensaje()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversaciones
  SET ultimo_mensaje = NEW.contenido,
      ultimo_mensaje_en = NEW.creado_en
  WHERE id = NEW.conversacion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trigger_ultimo_mensaje" ON "mensajes";


CREATE TRIGGER trigger_ultimo_mensaje
  AFTER INSERT ON mensajes
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_ultimo_mensaje();


-- ----- 015_clean_chat.sql -----
-- Eliminar TODOS los mensajes y conversaciones (desde cero)
-- Ejecutar en Supabase SQL Editor

DELETE FROM mensajes;
ALTER SEQUENCE IF EXISTS mensajes_id_seq RESTART WITH 1;

DELETE FROM conversaciones;
ALTER SEQUENCE IF EXISTS conversaciones_id_seq RESTART WITH 1;


-- ----- 016_add_seller_telefono.sql -----
-- Añadir columna seller_telefono y seller_nombre a productos si no existen
ALTER TABLE productos ADD COLUMN IF NOT EXISTS seller_telefono text;
DROP FUNCTION IF EXISTS crear_perfil() CASCADE;



-- ----- 017_fix_perfiles.sql -----
-- Migration 017: Fix trigger crear_perfil para que lea metadata del registro
-- y guarde nombre, telefono, estado, ciudad

CREATE OR REPLACE FUNCTION crear_perfil()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, telefono, estado, ciudad)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'telefono', ''),
    COALESCE(NEW.raw_user_meta_data->>'estado', ''),
    COALESCE(NEW.raw_user_meta_data->>'ciudad', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block registration
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger if it doesn't already exist
DROP TRIGGER IF EXISTS crear_perfil_trigger ON auth.users;
DROP TRIGGER IF EXISTS "crear_perfil_trigger" ON "auth"."users";

CREATE TRIGGER crear_perfil_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION crear_perfil();


-- ----- 018_perfiles_insert.sql -----
-- Migration 018: Fix RLS en perfiles - permitir INSERT y INSERT propio
-- Sin esto, users no pueden crear su perfil ni via upsert ni manualmente

-- Allow users to INSERT their own profile
DROP POLICY IF EXISTS "Insert propio" ON perfiles;
DROP POLICY IF EXISTS "Insert propio" ON "perfiles";

CREATE POLICY "Insert propio" ON perfiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Also allow the trigger (security definer) to insert
-- The trigger function is SECURITY DEFINER, so it bypasses RLS


-- ----- 019_fulltext_search.sql -----
-- Migration 019: Full-text search con tsvector
-- Reemplaza el ilike() lento con búsqueda full-text indexada

-- 1. Columna tsvector para búsqueda en titulo + descripcion
ALTER TABLE productos ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(descripcion, '')), 'B')
  ) STORED;

-- 2. Índice GIN para búsqueda rápida (O(log n) en vez de O(n))
CREATE INDEX IF NOT EXISTS idx_productos_search ON productos USING GIN (search_vector);

-- 3. Función RPC para búsqueda full-text con ranking de relevancia
-- Devuelve productos ordenados por: boost > destacados > relevancia ts_rank > fecha
-- Límite de 1000 resultados (suficiente para cualquier búsqueda real)
CREATE OR REPLACE FUNCTION buscar_productos(
  p_query TEXT,
  p_categoria_id INT DEFAULT NULL,
  p_subcategoria TEXT DEFAULT NULL,
  p_marca TEXT DEFAULT NULL,
  p_estado_product TEXT DEFAULT NULL,
  p_ubicacion_estado TEXT DEFAULT NULL,
  p_ubicacion_ciudad TEXT DEFAULT NULL,
  p_precio_min NUMERIC DEFAULT NULL,
  p_precio_max NUMERIC DEFAULT NULL,
  p_orden TEXT DEFAULT '',
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  titulo TEXT,
  descripcion TEXT,
  precio_usd NUMERIC,
  estado TEXT,
  imagen_url TEXT,
  imagenes TEXT[],
  ubicacion_estado TEXT,
  ubicacion_ciudad TEXT,
  creado_en TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ,
  visitas INT,
  activo BOOLEAN,
  destacado BOOLEAN,
  destacado_hasta TIMESTAMPTZ,
  boosteado_en TIMESTAMPTZ,
  categoria_id INT,
  subcategoria TEXT,
  marca TEXT,
  modelo TEXT,
  seller_nombre TEXT,
  seller_telefono TEXT,
  estado_moderacion TEXT,
  vendedor_verificado BOOLEAN,
  relevance NUMERIC,
  match_count INT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH matched AS (
    SELECT
      p.*,
      CASE WHEN p_query IS NOT NULL AND p_query <> ''
           THEN ts_rank_cd(
             p.search_vector,
             plainto_tsquery('spanish', p_query),
             32
           )
           ELSE 0
      END AS ts_rel
    FROM productos p
    WHERE p.activo = true
      AND (p.estado_moderacion IS NULL OR p.estado_moderacion = 'aprobado')
      AND (
        p_query IS NULL
        OR p_query = ''
        OR p.search_vector @@ plainto_tsquery('spanish', p_query)
      )
      AND (p_categoria_id IS NULL OR p.categoria_id = p_categoria_id)
      AND (p_subcategoria IS NULL OR p.subcategoria = p_subcategoria)
      AND (p_marca IS NULL OR p.marca = p_marca)
      AND (p_estado_product IS NULL OR p.estado = p_estado_product)
      AND (p_ubicacion_estado IS NULL OR p.ubicacion_estado = p_ubicacion_estado)
      AND (p_ubicacion_ciudad IS NULL OR p.ubicacion_ciudad = p_ubicacion_ciudad)
      AND (p_precio_min IS NULL OR p.precio_usd >= p_precio_min)
      AND (p_precio_max IS NULL OR p.precio_usd <= p_precio_max)
  ),
  counted AS (
    SELECT count(*) AS total FROM matched
  )
  SELECT
    matched.id, matched.titulo, matched.descripcion, matched.precio_usd,
    matched.estado, matched.imagen_url, matched.imagenes,
    matched.ubicacion_estado, matched.ubicacion_ciudad,
    matched.creado_en, matched.actualizado_en, matched.visitas,
    matched.activo, matched.destacado, matched.destacado_hasta,
    matched.boosteado_en, matched.categoria_id, matched.subcategoria,
    matched.marca, matched.modelo, matched.seller_nombre,
    matched.seller_telefono, matched.estado_moderacion,
    matched.vendedor_verificado,
    matched.ts_rel,
    CASE WHEN p_query IS NOT NULL AND p_query <> ''
         THEN array_length(
           string_to_array(p_query, ' '), ' ')
         ELSE 0
    END,
    counted.total
  FROM matched, counted
  ORDER BY
    CASE WHEN p_orden = 'precio_asc' THEN matched.precio_usd END ASC,
    CASE WHEN p_orden = 'precio_desc' THEN matched.precio_usd END DESC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') THEN
      CASE
        WHEN matched.boosteado_en IS NOT NULL THEN 0
        WHEN matched.destacado = true AND matched.destacado_hasta > now() THEN 1
        ELSE 2
      END
    END ASC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') AND matched.boosteado_en IS NOT NULL
         THEN matched.boosteado_en END DESC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') AND matched.destacado = true AND matched.destacado_hasta > now()
         THEN matched.destacado_hasta END DESC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') AND (matched.boosteado_en IS NULL OR NOT (matched.destacado = true AND matched.destacado_hasta > now()))
         THEN matched.ts_rel
         ELSE 0
    END DESC,
    CASE WHEN p_orden NOT IN ('precio_asc', 'precio_desc') AND (matched.boosteado_en IS NULL OR NOT (matched.destacado = true AND matched.destacado_hasta > now()))
         THEN matched.creado_en
         ELSE NULL
    END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Pobrear search_vector para productos existentes
UPDATE productos SET titulo = titulo WHERE search_vector IS NULL;


-- ----- 019_push_subscriptions.sql -----
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth_key text NOT NULL,
    creado_en timestamptz DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON "push_subscriptions";


CREATE POLICY "Users manage own push subscriptions"
    ON push_subscriptions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ----- 020_push_notifications.sql -----
-- Cola de notificaciones push pendientes
CREATE TABLE IF NOT EXISTS notificaciones_push (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo text NOT NULL,
    titulo text NOT NULL,
    cuerpo text NOT NULL,
    click_url text DEFAULT '/',
    procesada boolean DEFAULT false,
    creado_en timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_push_pending ON notificaciones_push (target_user_id, procesada) WHERE procesada = false;


-- ----- 021_stats_y_alertas.sql -----
-- =====================================================
-- 021: Tabla historial de precios + busquedas guardadas
-- =====================================================

-- Historial de precios
CREATE TABLE IF NOT EXISTS historial_precios (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    precio_anterior numeric NOT NULL,
    precio_nuevo numeric NOT NULL,
    creado_en timestamptz DEFAULT now()
);

ALTER TABLE historial_precios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "historial_precios: lectura publica" ON "historial_precios";

CREATE POLICY "historial_precios: lectura publica"
    ON historial_precios FOR SELECT USING (true);

-- Busquedas guardadas (alertas)
CREATE TABLE IF NOT EXISTS busquedas_guardadas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query text NOT NULL,
    filtros jsonb DEFAULT '{}',
    ultima_notificacion timestamptz,
    activa boolean DEFAULT true,
    creado_en timestamptz DEFAULT now()
);

ALTER TABLE busquedas_guardadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "busquedas_guardadas: users own" ON "busquedas_guardadas";

CREATE POLICY "busquedas_guardadas: users own"
    ON busquedas_guardadas FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Índice para búsqueda de alertas
CREATE INDEX IF NOT EXISTS idx_busquedas_guardadas_user ON busquedas_guardadas(user_id, activa);


-- ----- 022_trigger_precio.sql -----
/**
 * Trigger para historial de precios.
 * Cada vez que cambia precio_usd en productos, guarda el cambio.
 */

-- Trigger function
CREATE OR REPLACE FUNCTION registrar_cambio_precio()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.precio_usd IS DISTINCT FROM NEW.precio_usd
     AND OLD.precio_usd IS NOT NULL
     AND NEW.precio_usd IS NOT NULL THEN
    INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo)
    VALUES (NEW.id, OLD.precio_usd, NEW.precio_usd);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_precio_history ON productos;
DROP TRIGGER IF EXISTS "trg_precio_history" ON "productos";

CREATE TRIGGER trg_precio_history
  AFTER UPDATE OF precio_usd ON productos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_precio();


-- ----- 023_fix_seguridad.sql -----
-- ============================================================
-- 023_fix_seguridad.sql
-- Fase 1 de seguridad (2026-07-31)
--
-- Cierra 3 vectores de abuso de créditos/verificación:
--   1. Crea tabla `admins` (emails con permisos de administrador).
--   2. aprobar_transaccion: solo puede ejecutarla un admin real
--      (auth.uid() debe estar en `admins`). Antes, cualquier usuario
--      autenticado podía auto-aprobarse una compra de créditos.
--   3. usar_boost / usar_destacado: exigen que auth.uid() coincida
--      con p_user_id. Antes, un atacante podía drenar los créditos
--      de otro usuario pasando su user_id.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 1. Tabla de administradores
create table if not exists admins (
  email text primary key,
  creado_en timestamp with time zone default now()
);

insert into admins (email) values ('gtrespana@gmail.com')
on conflict (email) do nothing;
DROP FUNCTION IF EXISTS aprobar_transaccion(uuid, uuid) CASCADE;


-- 2. aprobar_transaccion: SOLO admins (según sesión JWT, no el parámetro)
create or replace function aprobar_transaccion(
  p_transaccion_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_monto integer;
  v_estado text;
  v_tipo text;
  v_es_admin boolean;
begin
  -- Verificar sesión autenticada
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'No autenticado');
  end if;

  -- Verificar que el llamador está en la tabla admins (vía su email en auth.users)
  select exists (
    select 1
    from auth.users u
    join admins a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
  ) into v_es_admin;

  if not v_es_admin then
    return jsonb_build_object('ok', false, 'error', 'No autorizado: solo administradores');
  end if;

  select user_id, monto, estado, tipo
  into v_user_id, v_monto, v_estado, v_tipo
  from transacciones_creditos
  where id = p_transaccion_id;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Transacción no encontrada');
  end if;
  if v_estado != 'pendiente' then
    return jsonb_build_object('ok', false, 'error', 'Transacción ya procesada');
  end if;
  if v_tipo != 'compra' then
    return jsonb_build_object('ok', false, 'error', 'Solo se pueden aprobar compras');
  end if;

  -- Actualizar transacción
  update transacciones_creditos set estado = 'aprobado' where id = p_transaccion_id;

  -- Añadir créditos
  update perfiles set credito_balance = credito_balance + v_monto where id = v_user_id;

  return jsonb_build_object('ok', true, 'creditos_anadidos', v_monto);
end;
$$;
DROP FUNCTION IF EXISTS usar_boost(uuid, uuid) CASCADE;


-- 3. usar_boost: el llamador debe ser el dueño del producto
create or replace function usar_boost(
  p_producto_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_owner uuid;
begin
  -- La sesión debe coincidir con p_user_id (evita drenar créditos ajenos)
  if auth.uid() is null or auth.uid() != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado: la sesión no coincide con el usuario');
  end if;

  select user_id into v_owner from productos where id = p_producto_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  select credito_balance into v_balance from perfiles where id = p_user_id;
  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes');
  end if;

  update productos set boosteado_en = now() where id = p_producto_id;
  update perfiles set credito_balance = credito_balance - 1 where id = p_user_id;
  insert into transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (p_user_id, 'gasto', 1, 'boost', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance - 1);
end;
$$;
DROP FUNCTION IF EXISTS usar_destacado(uuid, uuid, int4) CASCADE;


-- 4. usar_destacado: igual que usar_boost
create or replace function usar_destacado(
  p_producto_id uuid,
  p_user_id uuid,
  p_horas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_owner uuid;
  v_costo integer;
begin
  -- La sesión debe coincidir con p_user_id
  if auth.uid() is null or auth.uid() != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado: la sesión no coincide con el usuario');
  end if;

  select user_id into v_owner from productos where id = p_producto_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  v_costo := case
    when p_horas <= 12 then 4
    when p_horas <= 24 then 6
    else 10
  end;

  select credito_balance into v_balance from perfiles where id = p_user_id;
  if v_balance < v_costo then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes (necesitas ' || v_costo || ')');
  end if;

  update productos
  set destacado = true,
      destacado_hasta = now() + (p_horas || ' hours')::interval
  where id = p_producto_id;

  update perfiles set credito_balance = credito_balance - v_costo where id = p_user_id;

  insert into transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (p_user_id, 'gasto', v_costo, 'destacado_' || p_horas || 'h', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance - v_costo, 'hasta', now() + (p_horas || ' hours')::interval);
end;
$$;

-- 5. Reforzar: revocar ejecución a anon en las funciones sensibles
revoke execute on function aprobar_transaccion(uuid, uuid) from anon;
revoke execute on function usar_boost(uuid, uuid) from anon;
revoke execute on function usar_destacado(uuid, uuid, integer) from anon;


-- ----- 024_slugs_productos.sql -----
-- ============================================
-- MIGRACIÓN: Slugs SEO para productos
-- URLs /producto/iphone-13-pro-caracas-550e8400 en vez de UUIDs
-- Ejecutar en el Supabase SQL Editor
-- ============================================

-- 1. Función slugify sin dependencia de la extensión unaccent.
--    minúsculas, sin acentos, separadores '-', solo [a-z0-9].
--    Devuelve NULL si el resultado queda vacío (todo símbolos).
create or replace function public.slugify(input text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      translate(lower($1),
        'áàäâãéèëêíìïîóòöôõúùüûñç',
        'aaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', '-', 'g')),
    '')
$$;

-- 2. Nueva columna
alter table public.productos
  add column if not exists slug text;

-- 3. Generador: título slugificado (máx. 60 chars) + 8 hex del UUID.
--    El sufijo del UUID garantiza unicidad sin consultas extra.
create or replace function public.generar_slug_producto(p_titulo text, p_id uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select concat(
    left(coalesce(public.slugify(nullif(btrim(coalesce(p_titulo, '')), '')), 'producto'), 60),
    '-',
    substr(replace(p_id::text, '-', ''), 1, 8)
  )
$$;

-- 4. Backfill de productos existentes
update public.productos
set slug = public.generar_slug_producto(titulo, id)
where slug is null or btrim(slug) = '';

-- 5. Restricciones (not null + único)
alter table public.productos alter column slug set not null;

create unique index if not exists productos_slug_key on public.productos (slug);

-- 6. Trigger: genera el slug en inserts futuros.
--    Solo si viene vacío — si el cliente envía slug explícito se respeta.
--    NEW.id ya existe aquí porque el default gen_random_uuid() se evalúa
--    antes de los triggers BEFORE INSERT.
create or replace function public.productos_set_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.generar_slug_producto(new.titulo, new.id);
  end if;
  return new;
end
$$;

drop trigger if exists trg_productos_slug on public.productos;
DROP TRIGGER IF EXISTS "trg_productos_slug" ON "public"."productos";


create trigger trg_productos_slug
  before insert on public.productos
  for each row execute function public.productos_set_slug();

comment on column public.productos.slug is
  'Slug SEO único generado desde el título + sufijo del UUID. No cambiar tras la creación (afectaría URLs indexadas).';

-- 7. Actualizar RPCs que la app usa para listar productos, incluyendo slug.
--    (create or replace con cambio de returns table requiere drop previo)
drop function if exists public.obtener_destacados_home(integer) CASCADE;

create or replace function public.obtener_destacados_home(
  p_limite integer default 8
)
returns table (
  id uuid,
  slug text,
  user_id uuid,
  titulo text,
  descripcion text,
  categoria_id integer,
  subcategoria text,
  marca text,
  modelo text,
  estado text,
  precio_usd decimal,
  ubicacion_estado text,
  ubicacion_ciudad text,
  imagen_url text,
  imagenes text[],
  activo boolean,
  destacado boolean,
  destacado_hasta timestamp with time zone,
  visitas integer,
  creado_en timestamp with time zone,
  actualizado_en timestamp with time zone,
  boosteado_en timestamp with time zone
)
language plpgsql
stable
set search_path = public
as $$
begin
  return query
  select
    p.id, p.slug, p.user_id, p.titulo, p.descripcion, p.categoria_id,
    p.subcategoria, p.marca, p.modelo, p.estado, p.precio_usd,
    p.ubicacion_estado, p.ubicacion_ciudad, p.imagen_url,
    p.imagenes, p.activo, p.destacado, p.destacado_hasta,
    p.visitas, p.creado_en, p.actualizado_en, p.boosteado_en
  from productos p
  where p.activo = true
    and p.destacado = true
    and p.destacado_hasta > now()
  order by p.destacado_hasta desc
  limit p_limite;
end;
$$;

grant execute on function public.obtener_destacados_home(integer) to anon, authenticated;


-- ----- 025_categorias_faltantes_y_especificaciones.sql -----
-- ============================================
-- MIGRACIÓN 025
--   1. Categorías faltantes ('repuestos', 'materiales')  → fix error 406
--   2. Columna productos.especificaciones (JSONB)        → specs del paso 2
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================

-- ── 1. Categorías faltantes ────────────────────────────────────────────────
--
-- `src/lib/categorias.ts` ofrece 8 categorías en el formulario de publicar,
-- pero la migración 001 solo insertó 6. Faltaban 'repuestos' y 'materiales'.
--
-- Consecuencia del bug: al publicar en esas categorías, el cliente hacía
--   GET /rest/v1/categorias?select=id&nombre=eq.repuestos
-- con `.single()`. Cero filas + `.single()` = **HTTP 406** (el error que
-- aparecía en la consola del navegador) y el producto terminaba guardado con
-- `categoria_id = NULL`, invisible para los filtros por categoría.

insert into categorias (nombre) values
  ('repuestos'),
  ('materiales')
on conflict (nombre) do nothing;


-- ── 2. Columna especificaciones ────────────────────────────────────────────
--
-- El paso 2 de /publicar recoge campos por subcategoría (Marca, Modelo,
-- Kilometraje, Tipo de repuesto, Talla, RAM...). Se mostraban en la pantalla
-- de revisión pero NUNCA se persistían: no existía dónde guardarlos.
--
-- `/producto/editar/[id]` ya leía `prod.especificaciones` — código escrito
-- contra una columna inexistente, así que siempre resolvía a undefined.

alter table public.productos
  add column if not exists especificaciones jsonb;

comment on column public.productos.especificaciones is
  'Specs por subcategoría del paso 2 de /publicar. Claves = CatField.label '
  '(p. ej. {"Marca":"Ford","Modelo":"Explorer","Tipo de repuesto":"Radiador"}).';

-- Índice GIN: permite filtrar por spec sin escanear la tabla entera.
-- Ej: where especificaciones @> '{"Marca":"Ford"}'
create index if not exists productos_especificaciones_idx
  on public.productos using gin (especificaciones);


-- ── 3. Backfill de productos ya publicados ─────────────────────────────────
-- Los productos guardados antes de esta migración quedaron con
-- categoria_id NULL. Se reasignan por su subcategoría.

update public.productos p
set categoria_id = c.id
from public.categorias c
where p.categoria_id is null
  and c.nombre = 'repuestos'
  and p.subcategoria in ('Carros', 'Motos')
  -- Solo los que parecen repuestos: evita tocar vehículos completos.
  and (
    p.titulo ilike '%repuesto%'
    or p.titulo ilike '%radiador%'
    or p.titulo ilike '%filtro%'
    or p.titulo ilike '%pastilla%'
    or p.titulo ilike '%bujia%'
    or p.titulo ilike '%bujía%'
    or p.titulo ilike '%amortiguador%'
    or p.titulo ilike '%bomba%'
    or p.titulo ilike '%alternador%'
    or p.titulo ilike '%embrague%'
    or p.titulo ilike '%cadena%'
    or p.titulo ilike '%carburador%'
  );

update public.productos p
set categoria_id = c.id
from public.categorias c
where p.categoria_id is null
  and c.nombre = 'materiales'
  and p.subcategoria in ('Construcción', 'Eléctricos', 'Plomería');


-- ----- 026_categoria_camper.sql -----
-- Relanzamiento CamperOcasión (2026-09): marketplace vertical camper.
-- La categoría única del formulario de publicación es `camper`.
-- (El api/publicar también crea la categoría bajo demanda, pero el seed
-- aquí evita el 406 de PostgREST en la primera lectura y documenta el
-- contrato front ↔ tabla `categorias`.)
insert into categorias (nombre) values
  ('camper')
on conflict (nombre) do nothing;


-- ----- 20250627_obtener_detalle_producto.sql -----
-- ============================================================
-- FUNCIÓN RPC: obtener_detalle_producto
-- Consolida 6 queries del cliente en 1 solo round-trip
-- ============================================================
-- Parámetros:
--   p_producto_id: UUID del producto
--   p_user_id: UUID del usuario actual (NULL si no está logueado)
--
-- Retorna: JSON con vendedor, stats, reseñas, favorito, historial
-- ============================================================

CREATE OR REPLACE FUNCTION obtener_detalle_producto(
  p_producto_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendedor JSON;
  v_vendidas INT;
  v_activas INT;
  v_resenas_data JSON;
  v_resenas_count INT;
  v_es_favorito BOOLEAN := FALSE;
  v_historial JSON;
  v_producto_user_id UUID;
BEGIN
  -- Obtener user_id del producto
  SELECT user_id INTO v_producto_user_id
  FROM productos
  WHERE id = p_producto_id;

  IF v_producto_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Perfil vendedor
  SELECT json_build_object(
    'id', id,
    'nombre', nombre,
    'telefono', telefono,
    'ciudad', ciudad,
    'estado', estado,
    'whatsapp_disponible', whatsapp_disponible,
    'telefono_visible', telefono_visible,
    'email_visible', email_visible,
    'foto_perfil_url', foto_perfil_url,
    'verificado', verificado,
    'verificado_desde', verificado_desde,
    'nivel_confianza', nivel_confianza,
    'badges_automaticos', badges_automaticos,
    'ultima_actividad', ultima_actividad,
    'creado_en', creado_en
  ) INTO v_vendedor
  FROM perfiles
  WHERE id = v_producto_user_id;

  -- 2a. Count productos vendidos (no activos, no rechazados)
  SELECT COUNT(*) INTO v_vendidas
  FROM productos
  WHERE user_id = v_producto_user_id
    AND activo = FALSE
    AND (estado_moderacion IS NULL OR estado_moderacion != 'rechazado');

  -- 2b. Count productos activos
  SELECT COUNT(*) INTO v_activas
  FROM productos
  WHERE user_id = v_producto_user_id
    AND activo = TRUE;

  -- 2c. Reseñas: datos para promedio + count
  SELECT
    COALESCE(json_agg(json_build_object('puntuacion', puntuacion)), '[]'::json),
    COUNT(*)
  INTO v_resenas_data, v_resenas_count
  FROM resenas
  WHERE vendedor_id = v_producto_user_id;

  -- 4. Check favorito (solo si user está logueado)
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM favoritos
      WHERE user_id = p_user_id AND producto_id = p_producto_id
    ) INTO v_es_favorito;
  END IF;

  -- 6. Historial de precios (últimos 10)
  SELECT COALESCE(json_agg(row_data ORDER by row_data.creado_en DESC), '[]'::json)
  INTO v_historial
  FROM (
    SELECT json_build_object(
      'id', id,
      'precio_anterior', precio_anterior,
      'precio_nuevo', precio_nuevo,
      'creado_en', creado_en
    ) AS row_data
    FROM historial_precios
    WHERE producto_id = p_producto_id
    ORDER BY creado_en DESC
    LIMIT 10
  ) sub;

  -- Retornar todo en un solo JSON
  RETURN json_build_object(
    'vendedor', v_vendedor,
    'stats', json_build_object(
      'vendidas', v_vendidas,
      'activas', v_activas,
      'resenasCount', v_resenas_count,
      'resenasAvg', COALESCE(
        (SELECT AVG(puntuacion) FROM resenas WHERE vendedor_id = v_producto_user_id),
        0
      )
    ),
    'totalResenas', v_resenas_count,
    'esFavorito', v_es_favorito,
    'historial', v_historial
  );
END;
$$;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION obtener_detalle_producto(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION obtener_detalle_producto(UUID, UUID) TO authenticated;


-- ----- 202608010001_hardening_integridad.sql -----
-- ============================================================================
-- VendeT — Hardening de permisos e integridad
-- Fecha: 2026-08-01
--
-- Esta migración va DESPUÉS de las migraciones existentes. No elimina datos.
-- Antes de ejecutarla en producción:
--   1. aplicar en staging,
--   2. comprobar que todos los consumidores usan las APIs nuevas,
--   3. verificar los permisos con un usuario anon y uno authenticated.
--
-- Objetivos:
--   - limitar columnas que el navegador puede leer/modificar;
--   - hacer que publicación, créditos, reseñas y archivos sensibles pasen por
--     operaciones de servidor;
--   - corregir operaciones de créditos no atómicas;
--   - permitir solo administradores reales en solicitudes de verificación y
--     denuncias.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Asegurar columnas que esta migración usa
-- ────────────────────────────────────────────────────────────────────────────

alter table public.productos
  add column if not exists especificaciones jsonb,
  add column if not exists metodos_contacto jsonb,
  add column if not exists vendido boolean default false,
  add column if not exists vendido_en text,
  add column if not exists comprador_id uuid references auth.users(id);

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Admins: función segura para reutilizar en RLS
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.admins (
  email text primary key,
  creado_en timestamptz default now()
);

insert into public.admins (email)
values ('gtrespana@gmail.com')
on conflict (email) do nothing;

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Perfiles: columnas públicas separadas de columnas privadas/de negocio
-- ────────────────────────────────────────────────────────────────────────────

 drop policy if exists "Ver perfiles" on public.perfiles;
 drop policy if exists "Editar propio perfil" on public.perfiles;
 drop policy if exists "Insert propio" on public.perfiles;
DROP POLICY IF EXISTS "Ver perfiles públicos" ON "public"."perfiles";


create policy "Ver perfiles públicos" on public.perfiles
  for select using (true);
DROP POLICY IF EXISTS "Editar campos propios" ON "public"."perfiles";


create policy "Editar campos propios" on public.perfiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- El cliente solo necesita estos campos para cards, perfiles públicos y avatar.
-- Los campos privados se leen mediante /api/perfil o endpoints admin.
revoke all on table public.perfiles from anon, authenticated;
grant select (
  id,
  nombre,
  estado,
  ciudad,
  whatsapp_disponible,
  verificado,
  verificado_desde,
  nivel_confianza,
  badges_automaticos,
  ultima_actividad,
  creado_en,
  actualizado_en,
  foto_perfil_url
) on table public.perfiles to anon, authenticated;

grant update (nombre, telefono, estado, ciudad)
on table public.perfiles to authenticated;

-- El perfil lo crea el trigger SECURITY DEFINER de auth.users o la API privada.
-- No se permite INSERT directo desde el navegador.
revoke insert on table public.perfiles from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Productos: publicación y campos de sistema pasan por servidor
-- ────────────────────────────────────────────────────────────────────────────

-- El navegador no debe poder insertar productos saltándose moderación ni
-- alterar columnas de promoción, venta o auditoría.
revoke insert, delete, update on table public.productos from anon, authenticated;

grant update (
  titulo,
  descripcion,
  categoria_id,
  subcategoria,
  marca,
  modelo,
  especificaciones,
  estado,
  precio_usd,
  ubicacion_estado,
  ubicacion_ciudad,
  imagen_url,
  imagenes,
  metodos_contacto,
  activo
) on table public.productos to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Créditos y reseñas: solo APIs/RPCs de servidor escriben
-- ────────────────────────────────────────────────────────────────────────────

alter table public.transacciones_creditos
  add column if not exists precio_usd numeric(12,2);

alter table public.transacciones_creditos
  drop constraint if exists transacciones_creditos_tipo_check;

alter table public.transacciones_creditos
  add constraint transacciones_creditos_tipo_check
  check (tipo in ('compra', 'gasto', 'reembolso', 'bienvenida', 'emprendedor', 'admin_manual'));

revoke insert, update, delete on table public.transacciones_creditos from anon, authenticated;

revoke insert, update, delete on table public.resenas from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Denuncias: el reportante debe ser la sesión; admin real puede moderar
-- ────────────────────────────────────────────────────────────────────────────

 drop policy if exists "Admin ve todas las denuncias" on public.denuncias;
 drop policy if exists "Usuarios pueden denunciar" on public.denuncias;
 drop policy if exists "Usuarios ven sus denuncias" on public.denuncias;
DROP POLICY IF EXISTS "Denuncias visibles para reportante o admin" ON "public"."denuncias";


create policy "Denuncias visibles para reportante o admin" on public.denuncias
  for select using (auth.uid() = reportante_id or public.is_admin());
DROP POLICY IF EXISTS "Usuarios denuncian con su propia identidad" ON "public"."denuncias";


create policy "Usuarios denuncian con su propia identidad" on public.denuncias
  for insert
  with check (auth.uid() = reportante_id);
DROP POLICY IF EXISTS "Admin actualiza denuncias" ON "public"."denuncias";


create policy "Admin actualiza denuncias" on public.denuncias
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Verificación: solicitud propia o administrador real
-- ────────────────────────────────────────────────────────────────────────────

 drop policy if exists "Usuarios ven sus solicitudes" on public.solicitudes_verificacion;
 drop policy if exists "Usuarios crean solicitudes" on public.solicitudes_verificacion;
 drop policy if exists "Admin ve todas las solicitudes" on public.solicitudes_verificacion;
 drop policy if exists "Admin actualiza solicitudes" on public.solicitudes_verificacion;
DROP POLICY IF EXISTS "Usuario ve su solicitud o admin" ON "public"."solicitudes_verificacion";


create policy "Usuario ve su solicitud o admin" on public.solicitudes_verificacion
  for select using (auth.uid() = user_id or public.is_admin());
DROP POLICY IF EXISTS "Usuario crea su propia solicitud" ON "public"."solicitudes_verificacion";


create policy "Usuario crea su propia solicitud" on public.solicitudes_verificacion
  for insert
  with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin actualiza solicitudes de verificación" ON "public"."solicitudes_verificacion";


create policy "Admin actualiza solicitudes de verificación" on public.solicitudes_verificacion
  for update
  using (public.is_admin())
  with check (public.is_admin());
DROP POLICY IF EXISTS "Admin elimina solicitudes de verificación" ON "public"."solicitudes_verificacion";


create policy "Admin elimina solicitudes de verificación" on public.solicitudes_verificacion
  for delete using (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Storage sensible: comprobantes privados y cédulas solo para dueño/admin
-- ────────────────────────────────────────────────────────────────────────────

update storage.buckets
set public = false
where id = 'comprobantes';

 drop policy if exists "Usuarios pueden subir comprobantes" on storage.objects;
 drop policy if exists "Cualquiera puede ver comprobantes" on storage.objects;
 drop policy if exists "Ver comprobantes propios" on storage.objects;
DROP POLICY IF EXISTS "Usuarios suben sus comprobantes" ON "storage"."objects";


create policy "Usuarios suben sus comprobantes"
on storage.objects for insert
with check (
  bucket_id = 'comprobantes'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS "Usuarios ven sus comprobantes" ON "storage"."objects";


create policy "Usuarios ven sus comprobantes"
on storage.objects for select
using (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS "Admin ve comprobantes" ON "storage"."objects";


create policy "Admin ve comprobantes"
on storage.objects for select
using (bucket_id = 'comprobantes' and public.is_admin());

 drop policy if exists "Admin ve todas las cedulas" on storage.objects;
DROP POLICY IF EXISTS "Admin ve todas las cedulas" ON "storage"."objects";

create policy "Admin ve todas las cedulas"
on storage.objects for select
using (bucket_id = 'cedulas' and public.is_admin());

-- Estas tablas solo se escriben desde APIs con service_role.
revoke all on table public.rate_limit from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;

alter table if exists public.notificaciones_push enable row level security;
revoke all on table public.notificaciones_push from anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Visitas atómicas
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.incrementar_visitas(p_producto_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visitas integer;
begin
  update public.productos
  set visitas = coalesce(visitas, 0) + 1
  where id = p_producto_id
    and activo = true
    and (estado_moderacion is null or estado_moderacion in ('aprobado', 'pendiente'))
  returning visitas into v_visitas;

  return coalesce(v_visitas, 0);
end;
$$;

grant execute on function public.incrementar_visitas(uuid) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Créditos atómicos e idempotentes
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.aprobar_transaccion(
  p_transaccion_id uuid,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_monto integer;
  v_estado text;
  v_tipo text;
  v_balance integer;
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'No autorizado: solo administradores');
  end if;

  select user_id, monto, estado, tipo
    into v_user_id, v_monto, v_estado, v_tipo
  from public.transacciones_creditos
  where id = p_transaccion_id
  for update;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Transacción no encontrada');
  end if;
  if v_estado <> 'pendiente' then
    return jsonb_build_object('ok', false, 'error', 'Transacción ya procesada');
  end if;
  if v_tipo <> 'compra' then
    return jsonb_build_object('ok', false, 'error', 'Solo se pueden aprobar compras');
  end if;

  update public.transacciones_creditos
  set estado = 'aprobado'
  where id = p_transaccion_id and estado = 'pendiente';

  update public.perfiles
  set credito_balance = coalesce(credito_balance, 0) + v_monto
  where id = v_user_id
  returning credito_balance into v_balance;

  return jsonb_build_object(
    'ok', true,
    'creditos_anadidos', v_monto,
    'balance', v_balance
  );
end;
$$;

grant execute on function public.aprobar_transaccion(uuid, uuid) to authenticated;
revoke execute on function public.aprobar_transaccion(uuid, uuid) from anon;

create or replace function public.usar_boost(
  p_producto_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  select user_id into v_owner
  from public.productos
  where id = p_producto_id;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  update public.perfiles
  set credito_balance = credito_balance - 1
  where id = auth.uid() and coalesce(credito_balance, 0) >= 1
  returning credito_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes');
  end if;

  update public.productos
  set boosteado_en = now()
  where id = p_producto_id and user_id = auth.uid();

  insert into public.transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (auth.uid(), 'gasto', 1, 'boost', 'aprobado');

  return jsonb_build_object('ok', true, 'balance', v_balance);
end;
$$;

create or replace function public.usar_destacado(
  p_producto_id uuid,
  p_user_id uuid,
  p_horas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_costo integer;
  v_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  v_costo := case p_horas when 12 then 4 when 24 then 6 when 48 then 10 else 0 end;
  if v_costo = 0 then
    return jsonb_build_object('ok', false, 'error', 'Duración no válida');
  end if;

  select user_id into v_owner
  from public.productos
  where id = p_producto_id;

  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'No eres dueño de este producto');
  end if;

  update public.perfiles
  set credito_balance = credito_balance - v_costo
  where id = auth.uid() and coalesce(credito_balance, 0) >= v_costo
  returning credito_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'No tienes créditos suficientes');
  end if;

  update public.productos
  set destacado = true,
      destacado_hasta = now() + make_interval(hours => p_horas)
  where id = p_producto_id and user_id = auth.uid();

  insert into public.transacciones_creditos (user_id, tipo, monto, metodo_pago, estado)
  values (auth.uid(), 'gasto', v_costo, 'destacado_' || p_horas || 'h', 'aprobado');

  return jsonb_build_object(
    'ok', true,
    'balance', v_balance,
    'hasta', now() + make_interval(hours => p_horas)
  );
end;
$$;

grant execute on function public.usar_boost(uuid, uuid) to authenticated;
grant execute on function public.usar_destacado(uuid, uuid, integer) to authenticated;
revoke execute on function public.usar_boost(uuid, uuid) from anon;
revoke execute on function public.usar_destacado(uuid, uuid, integer) from anon;

create or replace function public.agregar_creditos_admin(
  p_user_id uuid,
  p_cantidad integer,
  p_motivo text default 'Manual admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 10000 then
    return jsonb_build_object('ok', false, 'error', 'Cantidad inválida');
  end if;

  update public.perfiles
  set credito_balance = coalesce(credito_balance, 0) + p_cantidad
  where id = p_user_id
  returning credito_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'Perfil no encontrado');
  end if;

  insert into public.transacciones_creditos (
    user_id, tipo, monto, estado, motivo_registro
  ) values (
    p_user_id, 'admin_manual', p_cantidad, 'aprobado', left(coalesce(p_motivo, 'Manual admin'), 500)
  );

  return jsonb_build_object('ok', true, 'nuevoBalance', v_balance);
end;
$$;

grant execute on function public.agregar_creditos_admin(uuid, integer, text) to authenticated;
revoke execute on function public.agregar_creditos_admin(uuid, integer, text) from anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Evitar que el cálculo de reputación se dispare por sus propios campos
-- ────────────────────────────────────────────────────────────────────────────

 drop trigger if exists trg_calc_reputacion on public.perfiles;
DROP TRIGGER IF EXISTS "trg_calc_reputacion" ON "public"."perfiles";

create trigger trg_calc_reputacion
  after insert or update of verificado, verificado_desde on public.perfiles
  for each row execute function public.fn_calcular_reputacion();

-- El trigger de productos sigue recalculando reputación cuando cambia la
-- actividad/moderación, pero la actualización de los campos derivados del
-- perfil ya no vuelve a disparar trg_calc_reputacion.

-- El historial se escribe desde un trigger, no desde el cliente.
create or replace function public.registrar_cambio_precio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.precio_usd is distinct from new.precio_usd
     and old.precio_usd is not null
     and new.precio_usd is not null then
    insert into public.historial_precios (producto_id, precio_anterior, precio_nuevo)
    values (new.id, old.precio_usd, new.precio_usd);
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. Detalle de producto: no filtrar teléfono ni favoritos de otro usuario
-- ────────────────────────────────────────────────────────────────────────────

-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE.
-- Algunas instalaciones antiguas tienen esta función con una firma/retorno
-- diferente, así que se elimina solo la sobrecarga exacta antes de recrearla.
drop function if exists public.obtener_detalle_producto(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.obtener_detalle_producto(
  p_producto_id uuid,
  p_user_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_user_id uuid;
  v_vendedor json;
  v_vendidas integer;
  v_activas integer;
  v_resenas_data json;
  v_resenas_count integer;
  v_es_favorito boolean := false;
  v_historial json;
  v_effective_user uuid;
begin
  select user_id into v_producto_user_id
  from public.productos
  where id = p_producto_id
    and activo = true
    and (estado_moderacion is null or estado_moderacion in ('aprobado', 'pendiente'));

  if v_producto_user_id is null then
    return null;
  end if;

  v_effective_user := auth.uid();
  if p_user_id is not null and p_user_id = v_effective_user then
    v_effective_user := p_user_id;
  end if;

  select json_build_object(
    'id', id,
    'nombre', nombre,
    'telefono', case when coalesce(telefono_visible, false) then telefono else null end,
    'ciudad', ciudad,
    'estado', estado,
    'whatsapp_disponible', whatsapp_disponible,
    'telefono_visible', coalesce(telefono_visible, false),
    'email_visible', coalesce(email_visible, false),
    'foto_perfil_url', foto_perfil_url,
    'verificado', verificado,
    'verificado_desde', verificado_desde,
    'nivel_confianza', nivel_confianza,
    'badges_automaticos', badges_automaticos,
    'ultima_actividad', ultima_actividad,
    'creado_en', creado_en
  ) into v_vendedor
  from public.perfiles
  where id = v_producto_user_id;

  select count(*) into v_vendidas
  from public.productos
  where user_id = v_producto_user_id
    and activo = false
    and vendido = true
    and (estado_moderacion is null or estado_moderacion <> 'rechazado');

  select count(*) into v_activas
  from public.productos
  where user_id = v_producto_user_id and activo = true;

  select coalesce(json_agg(json_build_object('puntuacion', puntuacion)), '[]'::json), count(*)
    into v_resenas_data, v_resenas_count
  from public.resenas
  where vendedor_id = v_producto_user_id;

  if v_effective_user is not null then
    select exists(
      select 1 from public.favoritos
      where user_id = v_effective_user and producto_id = p_producto_id
    ) into v_es_favorito;
  end if;

  select coalesce(json_agg(row_data order by row_data->>'creado_en' desc), '[]'::json)
    into v_historial
  from (
    select json_build_object(
      'id', id,
      'precio_anterior', precio_anterior,
      'precio_nuevo', precio_nuevo,
      'creado_en', creado_en
    ) as row_data
    from public.historial_precios
    where producto_id = p_producto_id
    order by creado_en desc
    limit 10
  ) history;

  return json_build_object(
    'vendedor', v_vendedor,
    'stats', json_build_object(
      'vendidas', v_vendidas,
      'activas', v_activas,
      'resenasCount', v_resenas_count,
      'resenasAvg', coalesce((select avg(puntuacion) from public.resenas where vendedor_id = v_producto_user_id), 0)
    ),
    'totalResenas', v_resenas_count,
    'esFavorito', v_es_favorito,
    'historial', v_historial
  );
end;
$$;

grant execute on function public.obtener_detalle_producto(uuid, uuid) to anon, authenticated;


-- ----- 202608010002_chat_resenas_integridad.sql -----
-- ============================================================================
-- VendeT — Fase 2: chat y reseñas
--
-- Aplicar después de 202608010001_hardening_integridad.sql.
-- Las escrituras del navegador se trasladan a APIs autenticadas; las políticas
-- dejan de confiar en remitente/destinatario enviados por el cliente.
-- ============================================================================

-- Conversaciones: el navegador solo lee las conversaciones propias. Las crea,
-- modifica y elimina la API después de comprobar la relación con el producto.
revoke insert, update, delete on table public.conversaciones from anon, authenticated;

drop policy if exists "Ver conversaciones propias" on public.conversaciones;
drop policy if exists "Crear conversaciones" on public.conversaciones;
drop policy if exists "conv_insert" on public.conversaciones;
 drop policy if exists "Actualizar conversaciones" on public.conversaciones;
 drop policy if exists "conv_update" on public.conversaciones;
 drop policy if exists "Eliminar conversaciones propias" on public.conversaciones;
 drop policy if exists "conv_delete" on public.conversaciones;
DROP POLICY IF EXISTS "Ver conversaciones propias" ON "public"."conversaciones";


create policy "Ver conversaciones propias" on public.conversaciones
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);

-- Índices únicos con usuarios normalizados. Las migraciones anteriores ya
-- normalizan user1/user2 en el trigger, pero estos índices protegen también las
-- inserciones directas antiguas.
create unique index if not exists uq_conversaciones_par_producto_202608
  on public.conversaciones (user1_id, user2_id, producto_id)
  where producto_id is not null;

create unique index if not exists uq_conversaciones_par_sin_producto_202608
  on public.conversaciones (user1_id, user2_id)
  where producto_id is null;

-- Mensajes: las inserciones y cambios pasan por APIs. La política de inserción
-- conserva una defensa secundaria para clientes antiguos.
revoke insert, update, delete on table public.mensajes from anon, authenticated;

drop policy if exists "Enviar mensajes dentro de conversación propia" on public.mensajes;
drop policy if exists "Ver mensajes de conversaciones propias" on public.mensajes;
drop policy if exists "Enviar mensajes" on public.mensajes;
drop policy if exists "msg_insert" on public.mensajes;
drop policy if exists "Ver mensajes" on public.mensajes;
drop policy if exists "msg_select" on public.mensajes;
drop policy if exists "msg_update" on public.mensajes;
drop policy if exists "Actualizar mensajes" on public.mensajes;
DROP POLICY IF EXISTS "Ver mensajes de conversaciones propias" ON "public"."mensajes";


create policy "Ver mensajes de conversaciones propias" on public.mensajes
  for select using (
    exists (
      select 1
      from public.conversaciones c
      where c.id = mensajes.conversacion_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "Enviar mensajes dentro de conversación propia" ON "public"."mensajes";


create policy "Enviar mensajes dentro de conversación propia" on public.mensajes
  for insert with check (
    auth.uid() = remitente_id
    and exists (
      select 1
      from public.conversaciones c
      where c.id = mensajes.conversacion_id
        and (
          (c.user1_id = auth.uid() and c.user2_id = mensajes.destinatario_id)
          or (c.user2_id = auth.uid() and c.user1_id = mensajes.destinatario_id)
        )
    )
  );

-- Reseñas: solo las APIs que validan venta/comprador/vendedor escriben.
revoke insert, update, delete on table public.resenas from anon, authenticated;

-- Mensajes leídos y reseñas requieren un producto vendido real. No se cambia
-- aquí el esquema de datos existentes para evitar borrar histórico.

-- Asegurar que la cola de push no sea una tabla escribible desde el navegador.
alter table if exists public.notificaciones_push enable row level security;
revoke all on table public.notificaciones_push from anon, authenticated;


-- ----- 202608010003_fix_reputacion_definer.sql -----
-- ============================================================================
-- VendeT — Fix: fn_calcular_reputacion como SECURITY DEFINER
-- Fecha: 2026-08-01
--
-- Contexto
-- --------
-- La migración 202608010001_hardening_integridad.sql revocó a `authenticated`
-- el UPDATE de las columnas de negocio de `perfiles`
-- (nivel_confianza, badges_automaticos, ultima_actividad), dejando únicamente
-- (nombre, telefono, estado, ciudad).
--
-- Sin embargo, fn_calcular_reputacion() (migración 012_reputacion.sql) sigue
-- siendo una función normal (SECURITY INVOKER). Se dispara desde triggers sobre
-- `productos` (trg_calc_reputacion_prod) y `resenas`, además de `perfiles`.
--
-- Cuando un usuario edita un producto (el UPDATE incluye `activo`), el trigger
-- de productos ejecuta fn_calcular_reputacion(), que intenta:
--     UPDATE perfiles SET nivel_confianza, badges_automaticos, ultima_actividad
-- y eso queda DENEGADO por la restricción de columnas → 403
-- "permission denied for table perfiles", rompiendo el guardado.
--
-- Solución
-- --------
-- Convertir fn_calcular_reputacion() en SECURITY DEFINER con search_path fijo,
-- para que el recálculo de reputación corra como el propietario de la tabla y
-- pueda escribir los campos derivados pese a la restricción de columnas del
-- navegador. La reputación es un campo calculado por el servidor, no debe
-- depender de los privilegios del usuario que dispara el trigger.
--
-- Esta migración va DESPUÉS de 202608010001_hardening_integridad.sql.
-- Probar en staging antes de producción.
-- ============================================================================

-- Configura el contexto de ejecución como definer con search_path fijo a public
-- (mismo patrón hardened usado en el resto de RPCs de la migración de integridad).
alter function public.fn_calcular_reputacion() security definer;
alter function public.fn_calcular_reputacion() set search_path = public;

-- El propietario por defecto ya tiene los privilegios necesarios sobre public.perfiles
-- para escribir nivel_confianza, badges_automaticos y ultima_actividad.


-- ----- 202608010004_emprendedor_idempotente.sql -----
-- ============================================================================
-- VendeT — Bonus emprendedor idempotente
-- Fecha: 2026-08-01
--
-- El trigger histórico de 011_credito_sistema.sql ponía emprendedor_dado=false
-- al bajar de 10 publicaciones y no revertía los créditos ya entregados.
-- Crear publicaciones después permitía cobrar el bonus varias veces.
--
-- Esta migración conserva los créditos existentes, registra los usuarios que ya
-- recibieron el bonus y hace que el hito de 10 publicaciones solo pueda
-- concederse una vez por usuario.
-- ============================================================================

alter table public.perfiles
  add column if not exists emprendedor_dado boolean not null default false;

alter table public.transacciones_creditos
  add column if not exists motivo_registro text;

-- La migración 011 histórica intentaba usar estos tipos antes de ampliar el
-- constraint original. Dejamos el esquema consistente de forma idempotente.
alter table public.transacciones_creditos
  drop constraint if exists transacciones_creditos_tipo_check;

alter table public.transacciones_creditos
  add constraint transacciones_creditos_tipo_check
  check (tipo in ('compra', 'gasto', 'reembolso', 'bienvenida', 'emprendedor', 'admin_manual'));

create table if not exists public.creditos_bonificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  hito text not null,
  creditos integer not null check (creditos > 0),
  creado_en timestamptz not null default now(),
  unique (user_id, tipo, hito)
);

alter table public.creditos_bonificaciones enable row level security;
revoke all on public.creditos_bonificaciones from anon, authenticated;

-- Reconstruir el ledger mínimo para usuarios que ya tienen evidencia de haber
-- recibido el bonus. No se modifican balances ni se borran transacciones aquí.
insert into public.creditos_bonificaciones (user_id, tipo, hito, creditos)
select distinct user_id, 'emprendedor', '10_publicaciones', 5
from public.transacciones_creditos
where tipo = 'emprendedor'
on conflict (user_id, tipo, hito) do nothing;

update public.perfiles p
set emprendedor_dado = true
where exists (
  select 1
  from public.creditos_bonificaciones b
  where b.user_id = p.id
    and b.tipo = 'emprendedor'
    and b.hito = '10_publicaciones'
);

-- El trigger que reseteaba el flag permitía volver a cobrar. Se elimina.
drop trigger if exists trg_recalc_emprendedor on public.productos;
drop function if exists public.trg_recalcular_emprendedor() CASCADE;

create or replace function public.trg_empaque_emprendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub_count integer;
  v_grant_id uuid;
begin
  select count(*)
    into v_pub_count
  from public.productos
  where user_id = new.user_id
    and activo = true;

  if v_pub_count >= 10 then
    -- La unique constraint y ON CONFLICT hacen que dos publicaciones
    -- simultáneas solo puedan crear un grant.
    insert into public.creditos_bonificaciones (user_id, tipo, hito, creditos)
    values (new.user_id, 'emprendedor', '10_publicaciones', 5)
    on conflict (user_id, tipo, hito) do nothing
    returning id into v_grant_id;

    if v_grant_id is not null then
      update public.perfiles
      set credito_balance = coalesce(credito_balance, 0) + 5,
          emprendedor_dado = true
      where id = new.user_id;

      if not found then
        raise exception 'No existe el perfil del usuario que recibe el bonus';
      end if;

      insert into public.transacciones_creditos (
        user_id, tipo, monto, estado, motivo_registro, creado_en
      ) values (
        new.user_id,
        'emprendedor',
        5,
        'aprobado',
        'Bonus emprendedor - 10 publicaciones',
        now()
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pack_emprendedor on public.productos;
DROP TRIGGER IF EXISTS "trg_pack_emprendedor" ON "public"."productos";

create trigger trg_pack_emprendedor
  after insert on public.productos
  for each row execute function public.trg_empaque_emprendedor();


-- ----- 202608010005_productos_edicion_segura.sql -----
-- ============================================================================
-- VendeT — Las modificaciones de productos pasan por API server-side
-- Fecha: 2026-08-01
--
-- El editor web ya no debe escribir productos directamente con la anon key.
-- La API aplica ownership, validación, sanitización y moderación.
-- Service role y triggers siguen pudiendo actualizar el sistema.
-- ============================================================================

-- Revocar tanto privilegios de tabla como los grants por columna concedidos por
-- la migración de hardening anterior.
revoke update on table public.productos from anon, authenticated;
revoke update (
  titulo,
  descripcion,
  categoria_id,
  subcategoria,
  marca,
  modelo,
  especificaciones,
  estado,
  precio_usd,
  ubicacion_estado,
  ubicacion_ciudad,
  imagen_url,
  imagenes,
  metodos_contacto,
  activo
) on table public.productos from anon, authenticated;

-- Un producto vendido no puede volver a estar activo por una escritura directa
-- o por un bug del cliente. Se marca NOT VALID para no bloquear la migración si
-- existen filas históricas incoherentes; sí protege las filas nuevas y futuras.
alter table public.productos
  drop constraint if exists productos_vendido_activo_check;

alter table public.productos
  add constraint productos_vendido_activo_check
  check (vendido is not true or activo is not true)
  not valid;


-- ----- 202608010006_rate_limit_atomico.sql -----
-- ============================================================================
-- VendeT — Rate limit atómico
-- Fecha: 2026-08-01
--
-- El código anterior hacía COUNT + INSERT asíncrono, por lo que varias
-- peticiones concurrentes podían pasar antes de registrar el contador.
-- Esta función serializa cada (key, identifier) dentro de una transacción.
-- ============================================================================

create or replace function public.check_rate_limit_atomic(
  p_key text,
  p_identifier text,
  p_ip text,
  p_limit integer,
  p_window_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_window_start timestamptz;
  v_count integer := 0;
  v_oldest timestamptz;
  v_reset_ms bigint;
begin
  if coalesce(p_key, '') = ''
     or coalesce(p_identifier, '') = ''
     or p_limit is null
     or p_limit < 1
     or p_window_ms is null
     or p_window_ms < 1 then
    return jsonb_build_object(
      'ok', false,
      'remaining', 0,
      'resetIn', 60000,
      'limit', greatest(coalesce(p_limit, 1), 1)
    );
  end if;

  v_window := (p_window_ms::numeric / 1000) * interval '1 second';
  v_window_start := v_now - v_window;

  -- Advisory lock transaccional: las peticiones del mismo usuario/IP esperan
  -- entre sí, pero las claves distintas siguen siendo concurrentes.
  perform pg_advisory_xact_lock(
    hashtextextended(p_key || ':' || p_identifier, 0)
  );

  delete from public.rate_limit
  where key = p_key
    and identifier = p_identifier
    and created_at < v_window_start;

  select count(*)::integer, min(created_at)
    into v_count, v_oldest
  from public.rate_limit
  where key = p_key
    and identifier = p_identifier
    and created_at >= v_window_start;

  if v_count >= p_limit then
    v_reset_ms := greatest(
      0::bigint,
      ceil(extract(epoch from ((v_oldest + v_window) - v_now)) * 1000)::bigint
    );

    return jsonb_build_object(
      'ok', false,
      'remaining', 0,
      'resetIn', v_reset_ms,
      'limit', p_limit
    );
  end if;

  insert into public.rate_limit (key, identifier, ip, created_at)
  values (p_key, p_identifier, nullif(left(coalesce(p_ip, ''), 200), ''), v_now);

  return jsonb_build_object(
    'ok', true,
    'remaining', greatest(0, p_limit - v_count - 1),
    'resetIn', extract(epoch from v_window) * 1000,
    'limit', p_limit
  );
end;
$$;

revoke execute on function public.check_rate_limit_atomic(text, text, text, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit_atomic(text, text, text, integer, bigint)
  to service_role;


-- ----- 202608010007_anuncios_globales.sql -----
-- ============================================================================
-- VendeT — Anuncios globales del sitio
-- Fecha: 2026-08-30
--
-- Permite al panel admin publicar un banner informativo visible en toda la
-- aplicación sin tocar código en cada despliegue.
--
-- RLS: el público solo puede LEER anuncios activos; la escritura se hace
-- siempre desde /api/admin/anuncios con service_role (admin autenticado).
-- ============================================================================

create table if not exists public.anuncios_globales (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  mensaje text not null,
  emoji text not null default '📢',
  enlace text,
  enlace_texto text,
  activo boolean not null default true,
  expira_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.anuncios_globales enable row level security;

revoke all on public.anuncios_globales from anon, authenticated;

-- Lectura pública limitada a lo estrictamente visible (escrituras solo admin).
grant select on public.anuncios_globales to anon, authenticated;
grant all on public.anuncios_globales to service_role;
DROP POLICY IF EXISTS "Anuncios activos públicos" ON "public"."anuncios_globales";


create policy "Anuncios activos públicos"
on public.anuncios_globales
for select
using (activo = true);

create index if not exists idx_anuncios_globales_activo
on public.anuncios_globales (activo, expira_en)
where activo = true;


-- ----- 20260829000101_add_vendido_fecha.sql -----
-- ============================================================
-- vendido_fecha: timestamp real de venta para prueba social.
--
-- "Vendidos recientemente" en la home necesita ordenar por fecha de
-- venta. Antes solo existía `vendido boolean` y `vendido_en text`
-- (lugar de la venta: plataforma / otra_pagina / no_especificado),
-- sin cuándo ocurrió.
--
-- Backfill: los vendidos históricos no tienen fecha registrada; se
-- aproxima con creado_en (conservador: nunca aparecerán como "más
-- recientes" de lo que son).
-- ============================================================

alter table productos
  add column if not exists vendido_fecha timestamptz;

update productos
  set vendido_fecha = creado_en
  where vendido = true
    and vendido_fecha is null;


-- ----- 20260829000103_busquedas_guardadas.sql -----
-- ============================================================
-- busquedas_guardadas: búsquedas guardadas + alertas de nuevos
-- anuncios ("avísame cuando aparezca").
--
-- Es el mecanismo #1 de retención de compradores: quien no
-- encuentra su artículo hoy deja un "sensor" y vuelve cuando
-- aparece. `ultima_revision` permite al cron procesar cada
-- búsqueda solo desde su última novedad.
-- ============================================================

create table if not exists busquedas_guardadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  q text,
  categoria text,
  subcategoria text,
  marca text,
  condicion text,
  ubicacion_estado text,
  ubicacion_ciudad text,
  precio_min numeric,
  precio_max numeric,
  creada_en timestamptz not null default now(),
  ultima_revision timestamptz not null default now(),
  constraint busquedas_guardadas_tiene_filtro check (
    q is not null or categoria is not null or subcategoria is not null
    or marca is not null or ubicacion_estado is not null or ubicacion_ciudad is not null
  )
);

create index if not exists idx_busquedas_guardadas_user
  on busquedas_guardadas (user_id);

alter table busquedas_guardadas enable row level security;

drop policy if exists "Ver búsquedas propias" on busquedas_guardadas;
DROP POLICY IF EXISTS "Ver búsquedas propias" ON "busquedas_guardadas";

create policy "Ver búsquedas propias" on busquedas_guardadas
  for select using (auth.uid() = user_id);

drop policy if exists "Crear búsquedas propias" on busquedas_guardadas;
DROP POLICY IF EXISTS "Crear búsquedas propias" ON "busquedas_guardadas";

create policy "Crear búsquedas propias" on busquedas_guardadas
  for insert with check (auth.uid() = user_id);

drop policy if exists "Eliminar búsquedas propias" on busquedas_guardadas;
DROP POLICY IF EXISTS "Eliminar búsquedas propias" ON "busquedas_guardadas";

create policy "Eliminar búsquedas propias" on busquedas_guardadas
  for delete using (auth.uid() = user_id);


-- ----- 20260829000105_snapshot_visitas.sql -----
-- ============================================================
-- visitas_snapshot: línea base semanal de visitas por producto.
--
-- El digest semanal del vendedor ("tus anuncios tuvieron N vistas
-- esta semana") necesita comparar visitas actuales vs. la última
-- foto. `visitas` en productos es acumulado; con este snapshot el
-- cron calcula el delta por período.
--
-- Tabla interna (solo service role): RLS activado sin policies.
-- ============================================================

create table if not exists visitas_snapshot (
  producto_id uuid primary key references productos(id) on delete cascade,
  visitas integer not null default 0,
  actualizado_en timestamptz not null default now()
);

alter table visitas_snapshot enable row level security;

create index if not exists idx_visitas_snapshot_producto
  on visitas_snapshot (producto_id);


-- ----- Supabase Storage: bucket productos-fotos -----

-- Insertar bucket público (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('productos-fotos', 'productos-fotos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para storage.objects
-- Autenticados pueden subir a su propia carpeta; cualquiera puede leer; propietario puede borrar/actualizar sus propios archivos.

-- SELECT: fotos públicas, todo el mundo puede leer
DROP POLICY IF EXISTS "productos-fotos: public read" ON storage.objects;
DROP POLICY IF EXISTS "productos-fotos: public read" ON "storage"."objects";

CREATE POLICY "productos-fotos: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'productos-fotos');

-- INSERT: usuarios autenticados pueden subir solo a su carpeta (<user_id>/...)
DROP POLICY IF EXISTS "productos-fotos: authenticated upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "productos-fotos: authenticated upload own folder" ON "storage"."objects";

CREATE POLICY "productos-fotos: authenticated upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'productos-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: propietario
DROP POLICY IF EXISTS "productos-fotos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "productos-fotos: owner update" ON "storage"."objects";

CREATE POLICY "productos-fotos: owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'productos-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: propietario
DROP POLICY IF EXISTS "productos-fotos: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "productos-fotos: owner delete" ON "storage"."objects";

CREATE POLICY "productos-fotos: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'productos-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----- Supabase Storage: bucket foto-perfil -----

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('foto_perfil', 'foto_perfil', true, 3145728, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "foto_perfil: public read" ON storage.objects;
DROP POLICY IF EXISTS "foto_perfil: public read" ON "storage"."objects";

CREATE POLICY "foto_perfil: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'foto_perfil');

DROP POLICY IF EXISTS "foto_perfil: own upload" ON storage.objects;
DROP POLICY IF EXISTS "foto_perfil: own upload" ON "storage"."objects";

CREATE POLICY "foto_perfil: own upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'foto_perfil'
    AND (
      name = (auth.uid()::text || '.jpg')
      OR name LIKE (auth.uid()::text || '/%')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "foto_perfil: own update" ON storage.objects;
DROP POLICY IF EXISTS "foto_perfil: own update" ON "storage"."objects";

CREATE POLICY "foto_perfil: own update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'foto_perfil' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "foto_perfil: own delete" ON storage.objects;
DROP POLICY IF EXISTS "foto_perfil: own delete" ON "storage"."objects";

CREATE POLICY "foto_perfil: own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'foto_perfil' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ----- 202609150001_verificacion_homologacion.sql -----
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

-- ----- 202609160001_reservas.sql -----
-- ============================================================================
-- CamperOcasión — Reserva con señal (Fase 1.2 del plan de confianza)
-- Fecha: 2026-09-16
--
-- Qué resuelve
--   El dolor nº1 del vendedor son los "pisos": compradores que dicen que van en
--   camino, que el vendedor espera y que nunca aparecen. La reserva con señal
--   (300-500 €, muy por debajo del precio del vehículo) resuelve eso sin
--   custodia de fondos: el comprador paga DIRECTAMENTE al vendedor
--   (Bizum/transferencia), sube el comprobante y nuestro equipo lo verifica
--   antes de marcar el anuncio como reservado.
--
-- Decisión de diseño importante (para no inventar un escrow que no toca):
--   La plataforma NO mueve el dinero. Por eso aquí se registra el importe, la
--   comisión prevista (`comision_pct`, 0 por ahora) y el comprobante, pero no hay
--   saldos ni custodia. Cuando se conecte la pasarela (Stripe) no hará falta otra
--   migración: las columnas ya están.
--
-- Aditiva e idempotente: el sitio funciona sin ella (los anuncios simplemente no
-- se pueden reservar y el botón no aparece).
-- ============================================================================

-- ── 1. Estado de reserva en productos (denormalizado para listados) ─────────
-- La verdad vive en `reservas`; estas dos columnas son el cache que necesitan el
-- catálogo y las tarjetas para pintar "Reservado" sin joins. Un trigger las
-- mantiene (ver más abajo).

alter table public.productos
  add column if not exists reservado boolean not null default false,
  add column if not exists reservado_hasta timestamptz;

create index if not exists productos_reservado_idx
  on public.productos (reservado)
  where reservado;

comment on column public.productos.reservado is
  'Cache de "hay una reserva con señal vigente". La fuente es la tabla reservas; '
  'lo mantiene el trigger trg_propagar_reserva.';


-- ── 2. Tabla de reservas ────────────────────────────────────────────────────

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  comprador_id uuid not null references auth.users(id) on delete cascade,
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  -- Importe de la señal acordado (se descuenta del precio en la reunión).
  importe numeric(10,2) not null check (importe > 0 and importe <= 5000),
  -- Comisión prevista de la plataforma. 0 mientras el pago sea directo entre
  -- las partes: no cobramos por un dinero que no movemos.
  comision_pct numeric(4,2) not null default 0 check (comision_pct >= 0 and comision_pct <= 20),
  -- Importe de comisión resultante (0 mientras el pago sea directo).
  comision numeric(10,2) not null default 0 check (comision >= 0),
  metodo_pago text not null default 'bizum'
    check (metodo_pago in ('bizum', 'transferencia', 'efectivo', 'otro')),
  estado text not null default 'pendiente_pago'
    check (estado in (
      'pendiente_pago', 'en_revision', 'activa', 'completada',
      'rechazada', 'cancelada', 'reembolsada', 'expirada'
    )),
  -- Ruta del comprobante en el bucket privado `comprobantes-reserva`.
  comprobante_url text,
  mensaje text,
  motivo_cancelacion text,
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_en timestamptz,
  -- Hasta cuándo bloquea el anuncio. Se renueva al activar la reserva.
  expira_en timestamptz not null default (now() + interval '7 days'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists reservas_producto_idx on public.reservas (producto_id);
create index if not exists reservas_comprador_idx on public.reservas (comprador_id);
create index if not exists reservas_vendedor_idx on public.reservas (vendedor_id);
create index if not exists reservas_estado_idx on public.reservas (estado);

-- Un anuncio no puede tener dos reservas vivas a la vez: es la garantía de que
-- "reservado" significa algo. Los estados terminales no entran en el índice.
create unique index if not exists reservas_producto_viva_key
  on public.reservas (producto_id)
  where estado in ('pendiente_pago', 'en_revision', 'activa');

comment on table public.reservas is
  'Reservas con señal de un anuncio. El comprador paga directamente al vendedor '
  '(Bizum/transferencia) y sube el comprobante; el equipo lo verifica y el '
  'anuncio se marca como reservado. La plataforma no custodia fondos.';

alter table public.reservas enable row level security;

-- Lectura: comprador y vendedor de la reserva, y el admin. Nadie más.
drop policy if exists "reservas: partes" on public.reservas;
create policy "reservas: partes" on public.reservas
  for select to authenticated
  using (auth.uid() = comprador_id or auth.uid() = vendedor_id);

drop policy if exists "reservas: admin" on public.reservas;
create policy "reservas: admin" on public.reservas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Escrituras SOLO con service_role (la API comprueba propiedad, estado y
-- transiciones): el navegador no puede crearse una reserva activa solo.
revoke all on public.reservas from anon;
grant select on public.reservas to authenticated;
grant all on public.reservas to service_role;


-- ── 3. Propagación a productos ──────────────────────────────────────────────
-- Reserva vigente = pendiente_pago / en_revision / activa y sin caducar.

create or replace function public.fn_propagar_reserva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto uuid := coalesce(new.producto_id, old.producto_id);
  v_hasta timestamptz;
begin
  select r.expira_en into v_hasta
    from public.reservas r
   where r.producto_id = v_producto
     and r.estado in ('pendiente_pago', 'en_revision', 'activa')
     and r.expira_en > now()
   order by r.creado_en desc
   limit 1;

  update public.productos
     set reservado = (v_hasta is not null),
         reservado_hasta = v_hasta
   where id = v_producto;

  return null;
end $$;

drop trigger if exists trg_propagar_reserva on public.reservas;
create trigger trg_propagar_reserva
  after insert or update or delete on public.reservas
  for each row execute function public.fn_propagar_reserva();


-- ── 4. Vender cierra las reservas vivas ─────────────────────────────────────
-- Si el anuncio se marca como vendido, las reservas dejan de bloquear nada.

create or replace function public.fn_completar_reservas_al_vender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vendido is true and coalesce(old.vendido, false) is false then
    update public.reservas
       set estado = 'completada',
           actualizado_en = now()
     where producto_id = new.id
       and estado in ('pendiente_pago', 'en_revision', 'activa');
  end if;
  return new;
end $$;

drop trigger if exists trg_completar_reservas_al_vender on public.productos;
create trigger trg_completar_reservas_al_vender
  after update on public.productos
  for each row execute function public.fn_completar_reservas_al_vender();


-- ── 5. Bucket privado para los comprobantes ─────────────────────────────────
-- Ruta: <comprador_id>/<reserva_id>/<archivo>. El comprobante puede ser una
-- captura de Bizum, un justificante de transferencia o un PDF del banco.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-reserva',
  'comprobantes-reserva',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "comprobantes-reserva: owner upload" on storage.objects;
create policy "comprobantes-reserva: owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes-reserva'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprobantes-reserva: owner read" on storage.objects;
create policy "comprobantes-reserva: owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes-reserva'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprobantes-reserva: owner delete" on storage.objects;
create policy "comprobantes-reserva: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprobantes-reserva'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- El vendedor necesita ver el comprobante de la señal de SU anuncio: se
-- autoriza por pertenencia del segundo nivel (la reserva) contra la tabla.
-- Se hace con un helper SECURITY DEFINER para no depender de la RLS de reservas.
create or replace function public.fn_soy_parte_de_la_reserva(p_reserva_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reservas r
    where r.id = p_reserva_id
      and (r.comprador_id = auth.uid() or r.vendedor_id = auth.uid())
  );
$$;

grant execute on function public.fn_soy_parte_de_la_reserva(uuid) to authenticated;

drop policy if exists "comprobantes-reserva: seller read" on storage.objects;
create policy "comprobantes-reserva: seller read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes-reserva'
    and public.fn_soy_parte_de_la_reserva(
      nullif((storage.foldername(name))[2], '')::uuid
    )
  );

drop policy if exists "comprobantes-reserva: admin read" on storage.objects;
create policy "comprobantes-reserva: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes-reserva' and public.is_admin());
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

    begin
      execute 'alter table public.transacciones add column if not exists precio_eur numeric(12,2)';
    exception when duplicate_column then null; end;

    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='transacciones' and column_name='precio_usd') then
      execute 'update public.transacciones set precio_eur = coalesce(precio_eur, precio_usd) where precio_eur is null and precio_usd is not null';
      execute 'update public.transacciones set precio_usd = coalesce(precio_usd, precio_eur) where precio_usd is null and precio_eur is not null';
    end if;

    begin
      execute 'comment on column public.transacciones.precio_eur is ''Canónico ES: precio en euros. Alias legado: precio_usd.''';
    exception when undefined_column then null; when undefined_object then null; end;

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


-- ── 6. Vistas de compatibilidad ── `precio` es canónico (ver triggers arriba).
select 1;


-- ── 7. Inspección precompra + gestoría (plan de confianza §4.1 y §4.2) ──
-- Mismo bloque que supabase/migrations/202609170002_inspecciones_gestoria.sql,
-- idempotente, para fresh installs.
-- ============================================================================
-- CamperOcasión — Inspección precompra + gestoría del cambio de nombre
-- (última fase pendiente del plan de confianza: inspección concierge,
--  contrato de compraventa y gestoría — ver docs/plan-confianza-marketplace.md
--  §4.1 y §4.2).
--
-- Qué resuelve
--   1) El comprador que se gasta 20.000-80.000 € en una camper de particular
--      no tiene forma barata de comprobar "esto está como dicen". La
--      inspección concierge (150-250 €, coordinada por el equipo con talleres
--      y camperizadores colaboradores) valida demanda y precio sin construir
--      una red de inspectores todavía.
--   2) El cambio de nombre en la DGT (y el ITP que lo acompaña) es el trámite
--      que nadie quiere hacer. La gestoría se lanza como captación de leads:
--      el usuario deja sus datos, el equipo contacta y tramita (al principio
--      reenvío manual a la gestoría partner; sin API ni partner aún).
--
-- Decisión de diseño (igual que en reservas):
--   La plataforma NO mueve el dinero de la inspección: el comprador paga al
--   taller/inspector directamente y el equipo marca el estado. `precio` es el
--   presupuesto acordado, no un cobro de la plataforma. Cuando haya red de
--   inspectores con pago online, `informe` (jsonb) ya espera al checklist de
--   50 puntos sin necesitar otra migración.
--
-- Aditiva e idempotente: sin estas tablas el sitio funciona igual (los botones
-- no se ofrecen y los paneles avisan de que falta la migración).
-- ============================================================================

-- ── 1. Solicitudes de inspección precompra ──────────────────────────────────
-- Una fila por (comprador, anuncio) mientras esté viva. El estado vive aquí;
-- nada se escribe en productos (la inspección no bloquea el anuncio: otro
-- comprador puede reservarlo mientras esta se coordina).

create table if not exists public.solicitudes_inspeccion (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  comprador_id uuid not null references auth.users(id) on delete cascade,
  -- Ciclo concierge: solicitada → presupuestada (con precio) → pagada (pago
  -- directo al taller) → en_curso → completada | cancelada (cualquiera).
  estado text not null default 'solicitada'
    check (estado in (
      'solicitada', 'presupuestada', 'pagada', 'en_curso', 'completada', 'cancelada'
    )),
  -- Presupuesto acordado en € (lo fija el equipo al presupuestar). Sin cobro
  -- por la plataforma: es el importe que el comprador paga al inspector.
  precio numeric(8,2) check (precio is null or precio >= 0),
  -- Inspector asignado (un usuario del panel cuando exista la red).
  inspector_id uuid references auth.users(id) on delete set null,
  -- Informe de 50 puntos (fase "red"): secciones + estado + observaciones.
  -- Nulo en el MVP concierge: el informe se entrega por email.
  informe jsonb,
  -- Coordinación: ciudad del vehículo, disponibilidad, teléfono de contacto…
  notas text,
  revisado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  completada_en timestamptz
);

create index if not exists solicitudes_inspeccion_producto_idx
  on public.solicitudes_inspeccion (producto_id);
create index if not exists solicitudes_inspeccion_comprador_idx
  on public.solicitudes_inspeccion (comprador_id);
create index if not exists solicitudes_inspeccion_estado_idx
  on public.solicitudes_inspeccion (estado);

-- Un comprador no necesita dos solicitudes vivas sobre el mismo anuncio.
create unique index if not exists solicitudes_inspeccion_viva_key
  on public.solicitudes_inspeccion (producto_id, comprador_id)
  where estado in ('solicitada', 'presupuestada', 'pagada', 'en_curso');

comment on table public.solicitudes_inspeccion is
  'Inspección precompra (concierge): el comprador pide inspección de un anuncio, '
  'el equipo presupuesta y coordina un taller colaborador, y el comprador paga '
  'directo. El informe estructurado (jsonb) llega con la red de inspectores.';

alter table public.solicitudes_inspeccion enable row level security;

-- Lectura: el comprador ve las suyas; el admin, todas. El vendedor del anuncio
-- NO ve la solicitud (saber que te inspeccionan no le añade nada y evita
-- presiones: si le interesa, el informe acabará publicado con su permiso).
drop policy if exists "inspeccion: comprador" on public.solicitudes_inspeccion;
create policy "inspeccion: comprador" on public.solicitudes_inspeccion
  for select to authenticated
  using (auth.uid() = comprador_id);

drop policy if exists "inspeccion: admin" on public.solicitudes_inspeccion;
create policy "inspeccion: admin" on public.solicitudes_inspeccion
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Escrituras SOLO por service_role (la API comprueba propiedad y transiciones).
revoke all on public.solicitudes_inspeccion from anon;
grant select on public.solicitudes_inspeccion to authenticated;
grant all on public.solicitudes_inspeccion to service_role;


-- ── 2. Leads de la gestoría del cambio de nombre ────────────────────────────
-- Captación de interés en el servicio (89-149 €): el usuario deja sus datos
-- desde la landing, la calculadora de ITP o el contrato de compraventa, y el
-- equipo contacta. Puede venir de un usuario logueado o de un anónimo (el
-- comprador aún no tiene cuenta la mitad de las veces).

create table if not exists public.solicitudes_gestoria (
  id uuid primary key default gen_random_uuid(),
  -- Anónimo de perfiles: no exigimos cuenta para pedir gestoría.
  user_id uuid references auth.users(id) on delete set null,
  producto_id uuid references public.productos(id) on delete set null,
  nombre text not null,
  email text not null,
  telefono text not null,
  -- Provincia de la DGT donde tramitar (donde se va a matricular el vehículo).
  provincia text,
  matricula text,
  mensaje text,
  estado text not null default 'nueva'
    check (estado in ('nueva', 'en_gestion', 'cerrada')),
  notas_admin text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists solicitudes_gestoria_estado_idx
  on public.solicitudes_gestoria (estado);
create index if not exists solicitudes_gestoria_user_idx
  on public.solicitudes_gestoria (user_id);

comment on table public.solicitudes_gestoria is
  'Leads del servicio de gestoría (cambio de nombre DGT + ITP). El equipo '
  'contacta a mano y tramita con la gestoría partner; el estado solo marca el '
  'embudo interno (nueva / en gestión / cerrada).';

alter table public.solicitudes_gestoria enable row level security;

-- El lead es del que lo envió (si estaba logueado) y del admin. Un anónimo no
-- puede leer nada (user_id nulo no cumple auth.uid()).
drop policy if exists "gestoria: propia" on public.solicitudes_gestoria;
create policy "gestoria: propia" on public.solicitudes_gestoria
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "gestoria: admin" on public.solicitudes_gestoria;
create policy "gestoria: admin" on public.solicitudes_gestoria
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Insertar SOLO por service_role: la API valida y rate-limita; el navegador no
-- tiene INSERT directo (evita spam masivo saltándose el rate limit de la API).
revoke all on public.solicitudes_gestoria from anon;
grant select on public.solicitudes_gestoria to authenticated;
grant all on public.solicitudes_gestoria to service_role;


-- ============================================================================
-- CamperOcasión — Filtros de rango numérico del catálogo (202609170003)
-- Cierre del pendiente de la Fase 0.1: columnas generadas espec_km / espec_anio
-- / espec_placa_w / espec_inversor_w + función fn_espec_numero. Ver
-- supabase/migrations/202609170003_rangos_numericos.sql.
-- ============================================================================

create or replace function public.fn_espec_numero(v text)
returns numeric
language sql
immutable
parallel safe
as $$
  select nullif(regexp_replace(trim(v), '[^0-9]', '', 'g'), '')::numeric
$$;

comment on function public.fn_espec_numero(text) is
  'Extrae un número (solo dígitos) de un valor de especificaciones. Uso interno '
  'de las columnas generadas de rangos numéricos.';

alter table public.productos
  add column if not exists espec_km numeric generated always as (
    public.fn_espec_numero(coalesce(
      especificaciones->>'Kilómetros',
      especificaciones->>'Kilometraje (km)',
      especificaciones->>'Kilometraje'
    ))
  ) stored;

create index if not exists productos_espec_km_idx on public.productos (espec_km);

alter table public.productos
  add column if not exists espec_anio numeric generated always as (
    public.fn_espec_numero(coalesce(
      especificaciones->>'Año de matriculación',
      especificaciones->>'Año',
      especificaciones->>'Ano de matriculación'
    ))
  ) stored;

create index if not exists productos_espec_anio_idx on public.productos (espec_anio);

alter table public.productos
  add column if not exists espec_placa_w numeric generated always as (
    public.fn_espec_numero(especificaciones->>'Placa solar (watios)')
  ) stored;

create index if not exists productos_espec_placa_w_idx on public.productos (espec_placa_w);

alter table public.productos
  add column if not exists espec_inversor_w numeric generated always as (
    public.fn_espec_numero(especificaciones->>'Inversor 220V (watios)')
  ) stored;

create index if not exists productos_espec_inversor_w_idx on public.productos (espec_inversor_w);

-- ============================================================================
-- CamperOcasión — Reserva con señal: confirmación por el VENDEDOR (202609170004)
-- Mismo bloque que supabase/migrations/202609170004_reservas_confirmacion_vendedor.sql,
-- idempotente, para fresh installs.
--
-- La plataforma no custodia el dinero, así que no "verifica" el pago: el
-- comprador envía la SOLICITUD; el vendedor la CONFIRMA cuando recibe la señal
-- y solo entonces el anuncio queda reservado. Sin comprobantes ni bucket.
-- ============================================================================

alter table public.reservas
  drop constraint if exists reservas_estado_check;

update public.reservas
   set estado = 'solicitada', actualizado_en = now()
 where estado in ('pendiente_pago', 'en_revision');

update public.reservas
   set estado = 'cancelada', actualizado_en = now()
 where estado = 'reembolsada';

alter table public.reservas
  add constraint reservas_estado_check
  check (estado in ('solicitada', 'activa', 'completada', 'rechazada', 'cancelada', 'expirada'));

alter table public.reservas
  alter column estado set default 'solicitada';

drop index if exists public.reservas_producto_viva_key;

create unique index if not exists reservas_producto_activa_key
  on public.reservas (producto_id)
  where estado = 'activa';

create unique index if not exists reservas_solicitud_unica_key
  on public.reservas (producto_id, comprador_id)
  where estado = 'solicitada';

create or replace function public.fn_propagar_reserva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto uuid := coalesce(new.producto_id, old.producto_id);
  v_hasta timestamptz;
begin
  select r.expira_en into v_hasta
    from public.reservas r
   where r.producto_id = v_producto
     and r.estado = 'activa'
     and r.expira_en > now()
   order by r.creado_en desc
   limit 1;

  update public.productos
     set reservado = (v_hasta is not null),
         reservado_hasta = v_hasta
   where id = v_producto;

  return null;
end $$;

drop trigger if exists trg_propagar_reserva on public.reservas;
create trigger trg_propagar_reserva
  after insert or update or delete on public.reservas
  for each row execute function public.fn_propagar_reserva();

create or replace function public.fn_completar_reservas_al_vender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vendido is true and coalesce(old.vendido, false) is false then
    update public.reservas
       set estado = 'completada',
           actualizado_en = now()
     where producto_id = new.id
       and estado in ('solicitada', 'activa');
  end if;
  return new;
end $$;

drop trigger if exists trg_completar_reservas_al_vender on public.productos;
create trigger trg_completar_reservas_al_vender
  after update on public.productos
  for each row execute function public.fn_completar_reservas_al_vender();

drop policy if exists "comprobantes-reserva: owner upload" on storage.objects;
drop policy if exists "comprobantes-reserva: owner read" on storage.objects;
drop policy if exists "comprobantes-reserva: owner delete" on storage.objects;
drop policy if exists "comprobantes-reserva: seller read" on storage.objects;
drop policy if exists "comprobantes-reserva: admin read" on storage.objects;

drop function if exists public.fn_soy_parte_de_la_reserva(uuid);

-- ═══════════════════════════════════════════════════════════════════════
-- CamperOcasión — Limpieza de categorías legadas (202609170005)
-- Mismo bloque que supabase/migrations/202609170005_limpieza_categorias_legado.sql,
-- anexado aquí para instalaciones frescas: el vertical es 100% camper y la
-- única categoría real es `camper`. Se borran las del marketplace
-- generalista original SOLO si ningún producto las referencia.
-- ═══════════════════════════════════════════════════════════════════════

delete from public.categorias c
where c.nombre in (
  'vehiculos',
  'tecnologia',
  'moda',
  'hogar',
  'herramientas',
  'otros',
  'repuestos',
  'materiales'
)
and not exists (
  select 1 from public.productos p where p.categoria_id = c.id
);


-- ----- 202609180001_tipo_vendedor.sql -----
-- ═══════════════════════════════════════════════════════════════════════════
-- 202609180001 — Tipo de vendedor: particulares, camperizadores y profesionales
--
-- Fase 2 del posicionamiento "abierto a todos": cada perfil declara QUÉ tipo
-- de vendedor es y ese dato se muestra en las tarjetas y fichas de anuncio,
-- para que el comprador sepa de un vistazo quién le vende.
--
--   · perfiles.tipo_vendedor   → fuente de verdad (lo elige el usuario).
--   · productos.vendedor_tipo  → copia denormalizada para pintar el chip en
--     las cards SIN joins (mismo patrón que `vendedor_verificado`, migración
--     010), con triggers que la mantienen sincronizada en ambas direcciones.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columna en perfiles (fuente de verdad) ──────────────────────────────
alter table public.perfiles
  add column if not exists tipo_vendedor text not null default 'particular';

do $$
begin
  alter table public.perfiles
    add constraint perfiles_tipo_vendedor_check
    check (tipo_vendedor in ('particular', 'camperizador', 'profesional'));
exception
  when duplicate_object then null;
end $$;

-- ── 2. Columna denormalizada en productos (para cards sin joins) ───────────
alter table public.productos
  add column if not exists vendedor_tipo text not null default 'particular';

do $$
begin
  alter table public.productos
    add constraint productos_vendedor_tipo_check
    check (vendedor_tipo in ('particular', 'camperizador', 'profesional'));
exception
  when duplicate_object then null;
end $$;

-- ── 3. Sincronizar anuncios existentes ─────────────────────────────────────
update public.productos p
set vendedor_tipo = coalesce(pr.tipo_vendedor, 'particular')
from public.perfiles pr
where p.user_id = pr.id
  and p.vendedor_tipo is distinct from coalesce(pr.tipo_vendedor, 'particular');

-- ── 4. Triggers de sincronización ──────────────────────────────────────────
-- 4a. Si el usuario cambia su tipo en el perfil, sus anuncios lo heredan.
create or replace function public.fn_propagar_tipo_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_vendedor is distinct from old.tipo_vendedor then
    update public.productos
    set vendedor_tipo = new.tipo_vendedor
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propagar_tipo_vendedor on public.perfiles;
create trigger trg_propagar_tipo_vendedor
  after update of tipo_vendedor on public.perfiles
  for each row
  execute function public.fn_propagar_tipo_vendedor();

-- 4b. Un anuncio nuevo hereda el tipo del perfil de su vendedor.
create or replace function public.fn_producto_hereda_tipo_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.vendedor_tipo := coalesce(
    (select tipo_vendedor from public.perfiles where id = new.user_id),
    'particular'
  );
  return new;
end;
$$;

drop trigger if exists trg_producto_hereda_tipo_vendedor on public.productos;
create trigger trg_producto_hereda_tipo_vendedor
  before insert on public.productos
  for each row
  execute function public.fn_producto_hereda_tipo_vendedor();

-- ── 5. RPC del detalle: el objeto `vendedor` incluye el tipo ───────────────
-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE; se
-- elimina la sobrecarga exacta antes de recrearla (mismo patrón que el
-- hardening 202608010001).
drop function if exists public.obtener_detalle_producto(uuid, uuid) cascade;
create or replace function public.obtener_detalle_producto(
  p_producto_id uuid,
  p_user_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_user_id uuid;
  v_vendedor json;
  v_vendidas integer;
  v_activas integer;
  v_resenas_data json;
  v_resenas_count integer;
  v_es_favorito boolean := false;
  v_historial json;
  v_effective_user uuid;
begin
  select user_id into v_producto_user_id
  from public.productos
  where id = p_producto_id
    and activo = true
    and (estado_moderacion is null or estado_moderacion in ('aprobado', 'pendiente'));

  if v_producto_user_id is null then
    return null;
  end if;

  v_effective_user := auth.uid();
  if p_user_id is not null and p_user_id = v_effective_user then
    v_effective_user := p_user_id;
  end if;

  select json_build_object(
    'id', id,
    'nombre', nombre,
    'telefono', case when coalesce(telefono_visible, false) then telefono else null end,
    'ciudad', ciudad,
    'estado', estado,
    'whatsapp_disponible', whatsapp_disponible,
    'telefono_visible', coalesce(telefono_visible, false),
    'email_visible', coalesce(email_visible, false),
    'foto_perfil_url', foto_perfil_url,
    'verificado', verificado,
    'verificado_desde', verificado_desde,
    'tipo_vendedor', coalesce(tipo_vendedor, 'particular'),
    'nivel_confianza', nivel_confianza,
    'badges_automaticos', badges_automaticos,
    'ultima_actividad', ultima_actividad,
    'creado_en', creado_en
  ) into v_vendedor
  from public.perfiles
  where id = v_producto_user_id;

  select count(*) into v_vendidas
  from public.productos
  where user_id = v_producto_user_id
    and activo = false
    and vendido = true
    and (estado_moderacion is null or estado_moderacion <> 'rechazado');

  select count(*) into v_activas
  from public.productos
  where user_id = v_producto_user_id and activo = true;

  select coalesce(json_agg(json_build_object('puntuacion', puntuacion)), '[]'::json), count(*)
    into v_resenas_data, v_resenas_count
  from public.resenas
  where vendedor_id = v_producto_user_id;

  if v_effective_user is not null then
    select exists(
      select 1 from public.favoritos
      where user_id = v_effective_user and producto_id = p_producto_id
    ) into v_es_favorito;
  end if;

  select coalesce(json_agg(row_data order by row_data->>'creado_en' desc), '[]'::json)
    into v_historial
  from (
    select json_build_object(
      'id', id,
      'precio_anterior', precio_anterior,
      'precio_nuevo', precio_nuevo,
      'creado_en', creado_en
    ) as row_data
    from public.historial_precios
    where producto_id = p_producto_id
    order by creado_en desc
    limit 10
  ) history;

  return json_build_object(
    'vendedor', v_vendedor,
    'stats', json_build_object(
      'vendidas', v_vendidas,
      'activas', v_activas,
      'resenasCount', v_resenas_count,
      'resenasAvg', coalesce((select avg(puntuacion) from public.resenas where vendedor_id = v_producto_user_id), 0)
    ),
    'totalResenas', v_resenas_count,
    'esFavorito', v_es_favorito,
    'historial', v_historial
  );
end;
$$;

grant execute on function public.obtener_detalle_producto(uuid, uuid) to anon, authenticated;
