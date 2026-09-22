-- ══════════════════════════════════════════════════════════════════════════
-- Avisos por email de mensajes no leídos
--
-- Hasta ahora, recibir un mensaje solo generaba una notificación in-app y un
-- push (que únicamente llega a quien aceptó notificaciones del navegador).
-- Un vendedor que no vuelve a entrar en la web no se entera de que tiene un
-- comprador esperando, y el comprador se va a otro portal.
--
-- Estrategia: aviso DIFERIDO. Un cron avisa solo de lo que sigue sin leer
-- pasados unos minutos, así que quien estaba en la web y ya respondió no
-- recibe nada.
--
-- Idempotente: se puede ejecutar varias veces sin efecto adicional.
-- ══════════════════════════════════════════════════════════════════════════

-- 1) Preferencia del usuario. Por defecto activada: es un aviso transaccional
--    que el usuario espera recibir (alguien quiere comprarle algo), pero
--    siempre debe poder apagarlo desde su perfil.
alter table perfiles
  add column if not exists email_avisos_mensajes boolean not null default true;

comment on column perfiles.email_avisos_mensajes is
  'Si false, el usuario no recibe emails de aviso por mensajes no leídos.';

-- 2) Marca de aviso enviado en el propio mensaje. Evita avisar dos veces del
--    mismo mensaje aunque el cron se solape o se reintente.
alter table mensajes
  add column if not exists aviso_email_en timestamp with time zone;

comment on column mensajes.aviso_email_en is
  'Momento en que se envió el email de aviso por este mensaje. Null = pendiente.';

-- 3) Índice parcial: el cron solo busca mensajes sin leer y sin avisar.
--    Al ser parcial se mantiene diminuto (los mensajes ya leídos o ya
--    avisados, que son la inmensa mayoría, no ocupan sitio en el índice).
create index if not exists mensajes_pendientes_aviso_idx
  on mensajes (creado_en)
  where leido = false and aviso_email_en is null;
