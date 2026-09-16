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

create policy "Ver perfiles" on perfiles for select using (true);
create policy "Editar propio perfil" on perfiles for update using (auth.uid() = id);

-- Productos: visibles todos, el dueño puede CRUD
alter table productos enable row level security;

create policy "Ver productos" on productos for select using (activo = true) with check (true);
create policy "Ver propios" on productos for select using (auth.uid() = user_id);
create policy "Insert propios" on productos for insert with check (auth.uid() = user_id);
create policy "Editar propios" on productos for update using (auth.uid() = user_id);
create policy "Eliminar propios" on productos for delete using (auth.uid() = user_id);

-- Favoritos
alter table favoritos enable row level security;
create policy "Ver favoritos propios" on favoritos for select using (auth.uid() = user_id);
create policy "Insert favoritos propios" on favoritos for insert with check (auth.uid() = user_id);
create policy "Eliminar favoritos propios" on favoritos for delete using (auth.uid() = user_id);

-- Mensajes
alter table mensajes enable row level security;
create policy "Ver mensajes" on mensajes for select using (
  auth.uid() = remitente_id or auth.uid() = destinatario_id
);
create policy "Enviar mensajes" on mensajes for insert with check (auth.uid() = remitente_id);

-- Transacciones créditos
alter table transacciones_creditos enable row level security;
create policy "Ver transacciones propias" on transacciones_creditos for select using (auth.uid() = user_id);
create policy "Insert propias" on transacciones_creditos for insert with check (auth.uid() = user_id);

-- Trigger para actualizar actualizado_en
create or replace function actualizar_timestamp()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

create trigger actualizar_productos_ts before update on productos
  for each row execute procedure actualizar_timestamp();

create trigger actualizar_perfiles_ts before update on perfiles
  for each row execute procedure actualizar_timestamp();

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure crear_perfil();

-- Habilitar Realtime para chat
alter publication supabase_realtime add table mensajes;
