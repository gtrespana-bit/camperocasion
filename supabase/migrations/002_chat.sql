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

create policy "Ver conversaciones propias" on conversaciones for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "Crear conversaciones" on conversaciones for insert
  with check (auth.uid() = user1_id);

create policy "Actualizar conversaciones" on conversaciones for update
  using (auth.uid() = user1_id or auth.uid() = user2_id);

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

create trigger trigger_crear_conversacion
  before insert on mensajes
  for each row
  execute function crear_conversacion_si_no_existe();

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

create trigger trigger_ultimo_mensaje
  after insert on mensajes
  for each row
  execute function actualizar_ultimo_mensaje();

-- RLS mensajes (actualizar para incluir conversacion_id)
drop policy if exists "Ver mensajes" on mensajes;
create policy "Ver mensajes" on mensajes for select
  using (
    auth.uid() in (
      select user1_id from conversaciones where id = mensajes.conversacion_id
      union
      select user2_id from conversaciones where id = mensajes.conversacion_id
    )
  );

drop policy if exists "Enviar mensajes" on mensajes;
create policy "Enviar mensajes" on mensajes for insert
  with check (auth.uid() = remitente_id);
