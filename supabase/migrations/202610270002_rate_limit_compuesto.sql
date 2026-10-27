-- ============================================================================
-- CamperOcasión — Rate limit compuesto usuario + IP (2026-10-27)
--
-- Problema (auditoría externa, punto 7):
--   `check_rate_limit_atomic()` guardaba `p_ip` solo como metadato para análisis;
--   el bucket era siempre (p_key, p_identifier) y en /api/publicar el
--   identificador es el userId. Crear N cuentas desde la misma IP permitía
--   esquivar el límite por usuario.
--
--   Hacer DOS llamadas desde TypeScript (una por usuario y otra por IP) dejaría
--   un hueco: la primera consume su cupo aunque la segunda falle, y entre ambas
--   hay una ventana de concurrencia. Por eso los DOS buckets se deciden y se
--   escriben en la MISMA transacción, con advisory locks ordenados.
--
-- Contrato:
--   · p_limit     → límite del bucket de usuario (p_key, p_identifier)
--   · p_ip_limit  → límite del bucket de IP     (p_key || ':ip', 'ip:' || md5(p_ip))
--   · Si cualquiera de los dos está lleno: ok = false y NO se inserta nada.
--   · La IP se guarda hasheada como identificador (no queremos IPs en claro en
--     la columna `identifier`); la columna `ip` sigue guardando la IP para
--     análisis, igual que la función atómica original.
--
-- La ventana (p_window_ms) es compartida por los dos buckets; los límites se
-- pasan desde `src/lib/rate-limit.ts` (LIMITES_IP).
-- ============================================================================

create or replace function public.check_rate_limit_dual(
  p_key text,
  p_identifier text,
  p_ip text,
  p_limit integer,
  p_window_ms bigint,
  p_ip_limit integer
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
  v_key_ip text;
  v_id_ip text;
  v_lock_a bigint;
  v_lock_b bigint;
  v_count_user integer := 0;
  v_count_ip integer := 0;
  v_oldest_user timestamptz;
  v_oldest_ip timestamptz;
  v_reset_ms bigint := 0;
begin
  -- Parámetros inválidos = fallar cerrado, igual que check_rate_limit_atomic.
  if coalesce(p_key, '') = ''
     or coalesce(p_identifier, '') = ''
     or coalesce(p_ip, '') = ''
     or p_limit is null or p_limit < 1
     or p_window_ms is null or p_window_ms < 1
     or p_ip_limit is null or p_ip_limit < 1 then
    return jsonb_build_object(
      'ok', false,
      'remaining', 0,
      'resetIn', 60000,
      'limit', greatest(coalesce(p_limit, 1), 1)
    );
  end if;

  v_key_ip := p_key || ':ip';
  v_id_ip := 'ip:' || md5(p_ip);
  v_window := (p_window_ms::numeric / 1000) * interval '1 second';
  v_window_start := v_now - v_window;

  -- Orden de locks por valor numérico (protocolo sin deadlocks) para que dos
  -- peticiones que comparten usuario o IP se serialicen entre sí.
  v_lock_a := hashtextextended(p_key || ':' || p_identifier, 0);
  v_lock_b := hashtextextended(v_key_ip || ':' || v_id_ip, 0);
  perform pg_advisory_xact_lock(least(v_lock_a, v_lock_b));
  perform pg_advisory_xact_lock(greatest(v_lock_a, v_lock_b));

  delete from public.rate_limit
   where ((key = p_key and identifier = p_identifier)
       or (key = v_key_ip and identifier = v_id_ip))
     and created_at < v_window_start;

  select
    count(*) filter (where key = p_key and identifier = p_identifier),
    count(*) filter (where key = v_key_ip and identifier = v_id_ip),
    min(created_at) filter (where key = p_key and identifier = p_identifier),
    min(created_at) filter (where key = v_key_ip and identifier = v_id_ip)
    into v_count_user, v_count_ip, v_oldest_user, v_oldest_ip
  from public.rate_limit
   where (key = p_key and identifier = p_identifier)
      or (key = v_key_ip and identifier = v_id_ip);

  if v_count_user >= p_limit or v_count_ip >= p_ip_limit then
    if v_count_user >= p_limit then
      v_reset_ms := greatest(v_reset_ms,
        ceil(extract(epoch from ((v_oldest_user + v_window) - v_now)) * 1000)::bigint);
    end if;
    if v_count_ip >= p_ip_limit then
      v_reset_ms := greatest(v_reset_ms,
        ceil(extract(epoch from ((v_oldest_ip + v_window) - v_now)) * 1000)::bigint);
    end if;

    return jsonb_build_object(
      'ok', false,
      'remaining', 0,
      'resetIn', greatest(0::bigint, v_reset_ms),
      'limit', least(p_limit, p_ip_limit)
    );
  end if;

  -- Solo se escriben los dos registros si AMBOS buckets tienen sitio.
  insert into public.rate_limit (key, identifier, ip, created_at)
  values
    (p_key, p_identifier, left(p_ip, 200), v_now),
    (v_key_ip, v_id_ip, left(p_ip, 200), v_now);

  return jsonb_build_object(
    'ok', true,
    'remaining', greatest(0, least(p_limit - v_count_user - 1, p_ip_limit - v_count_ip - 1)),
    'resetIn', extract(epoch from v_window) * 1000,
    'limit', least(p_limit, p_ip_limit)
  );
end;
$$;

comment on function public.check_rate_limit_dual(text, text, text, integer, bigint, integer) is
  'Rate limit atómico de dos buckets (usuario + IP). Solo service_role.';

revoke all on function public.check_rate_limit_dual(text, text, text, integer, bigint, integer)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.check_rate_limit_dual(text, text, text, integer, bigint, integer) to service_role';
  end if;
end $$;
