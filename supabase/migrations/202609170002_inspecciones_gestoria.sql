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
