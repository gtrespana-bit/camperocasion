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
