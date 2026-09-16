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
