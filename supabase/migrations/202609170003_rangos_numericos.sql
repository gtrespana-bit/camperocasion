-- ============================================================================
-- CamperOcasión — Filtros de rango numérico del catálogo
-- (cierre del pendiente de la Fase 0.1: "kilómetros máximos, año mínimo y
--  watios de placa/inversor" — ver docs/plan-confianza-marketplace.md §2.1 y
--  docs/PENDIENTES-DESPLIEGUE.md §5).
--
-- Qué resuelve
--   Los campos numéricos de la ficha camper (Kilómetros, Año de matriculación,
--   Placa solar (watios), Inversor 220V (watios)) se capturan como número en
--   /publicar pero se guardan como TEXTO dentro del JSONB
--   `productos.especificaciones`. Compararlos con `->>` en PostgreSQL es
--   comparación ALFABÉTICA de texto ('9' > '10') y no usa índice: filtrar
--   "menos de 150.000 km" sobre el JSONB es lento y devuelve mal los tramos.
--
-- Solución (aditiva, idempotente, sin downtime)
--   Columnas GENERATED que extraen el número del JSONB (casteado a numeric) y
--   lo mantienen siempre al día sin triggers. El JS filtra por `espec_km`,
--   `espec_anio`, `espec_placa_w`, `espec_inversor_w` con comparación numérica
--   real, cada una con su propio índice funcional.
--
--   La extracción lee las claves canónicas Y las históricas (COALESCE), de modo
--   que los anuncios publicados antes de la normalización (p. ej. con
--   "Kilometraje (km)") también quedan cubiertos.
--
-- Aditiva e idempotente: sin estas columnas el sitio funciona igual (los
-- filtros de rango no se ofrecen y, si se fuerzan por URL, la query cae al
-- plan B sin rangos — ver src/lib/catalog-consulta.ts).
-- ============================================================================

-- helper interno para no repetir la regex de extracción en las 4 columnas.
-- `->>` devuelve NULL si la clave no existe; regexp_replace deja solo dígitos.
-- (mantiene el signo negativo por si un dato viniera mal formado; los
-- kilometrajes y watios son siempre positivos.)
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
  'de las columnas generadas de rangos numéricos: los '.' de millares y las comas '
  'decimales de la captura en español se normalizan a entero.';

-- ── 1. Kilómetros ───────────────────────────────────────────────────────────
alter table public.productos
  add column if not exists espec_km numeric generated always as (
    public.fn_espec_numero(coalesce(
      especificaciones->>'Kilómetros',
      especificaciones->>'Kilometraje (km)',
      especificaciones->>'Kilometraje'
    ))
  ) stored;

comment on column public.productos.espec_km is
  'Kilómetros extraídos del JSONB especificaciones (número, para filtrar con '
  'lte en vez de comparar texto). Claves leídas: Kilómetros, Kilometraje (km), Kilometraje.';

create index if not exists productos_espec_km_idx
  on public.productos (espec_km);

-- ── 2. Año de matriculación ─────────────────────────────────────────────────
alter table public.productos
  add column if not exists espec_anio numeric generated always as (
    public.fn_espec_numero(coalesce(
      especificaciones->>'Año de matriculación',
      especificaciones->>'Año',
      especificaciones->>'Ano de matriculación'
    ))
  ) stored;

comment on column public.productos.espec_anio is
  'Año de matriculación extraído del JSONB especificaciones (número, para '
  'filtrar con gte). Claves leídas: Año de matriculación, Año, Ano de matriculación.';

create index if not exists productos_espec_anio_idx
  on public.productos (espec_anio);

-- ── 3. Placa solar (watios) ─────────────────────────────────────────────────
alter table public.productos
  add column if not exists espec_placa_w numeric generated always as (
    public.fn_espec_numero(especificaciones->>'Placa solar (watios)')
  ) stored;

comment on column public.productos.espec_placa_w is
  'Watios de placa solar extraídos del JSONB especificaciones (para filtrar con gte).';

create index if not exists productos_espec_placa_w_idx
  on public.productos (espec_placa_w);

-- ── 4. Inversor 220V (watios) ───────────────────────────────────────────────
alter table public.productos
  add column if not exists espec_inversor_w numeric generated always as (
    public.fn_espec_numero(especificaciones->>'Inversor 220V (watios)')
  ) stored;

comment on column public.productos.espec_inversor_w is
  'Watios del inversor extraídos del JSONB especificaciones (para filtrar con gte).';

create index if not exists productos_espec_inversor_w_idx
  on public.productos (espec_inversor_w);
