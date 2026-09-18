-- ============================================================================
-- 202609180003 — Anuncios de demostración identificados (`es_demo`)
--
-- PROBLEMA QUE RESUELVE
-- =====================
-- El proyecto trae una semilla con 20 anuncios y 14 vendedores de ejemplo
-- (`src/lib/semilla-datos.js`, `/api/admin/semilla`) para que el sitio no se
-- vea vacío al enseñarlo. Esos anuncios traían:
--
--   · teléfonos móviles españoles inventados (formato +34 6XX …) — números que
--     hoy pertenecen a personas reales;
--   · perfiles marcados como «verificado» sin ninguna verificación detrás;
--   · textos escritos como si fueran anuncios reales de particulares;
--   · nada que los distinguiera de un anuncio real.
--
-- En una web pública y monetizada eso es publicidad engañosa (Ley 3/1991) y,
-- además, el peor arranque posible para un marketplace cuyo argumento es la
-- confianza: el comprador llama, no le contestan o le contesta un desconocido.
--
-- SOLUCIÓN
-- ========
--   1) Marca explícita `es_demo` en `productos` y `perfiles`.
--   2) Backfill de lo ya sembrado, detectando a los vendedores creados por la
--      semilla (`auth.users.raw_user_meta_data->>'semilla' = 'true'`).
--   3) Se vacían los teléfonos de esos perfiles/anuncios: son inventados y no
--      deben poder marcarse nunca.
--
-- El código que la usa:
--   · `src/app/sitemap.ts`               → los anuncios demo no se indexan.
--   · `src/app/[locale]/producto/[slug]` → banner "anuncio de ejemplo" y sin
--                                          datos de contacto.
--   · tarjetas del catálogo              → etiqueta "Ejemplo".
--   · `/api/admin/semilla`               → marca lo que siembra y ya no
--                                          publica teléfonos ni verificados.
--
-- Idempotente: se puede aplicar más de una vez.
-- ============================================================================

-- ── 1. Columnas de marca ───────────────────────────────────────────────────
alter table public.productos add column if not exists es_demo boolean not null default false;
alter table public.perfiles  add column if not exists es_demo boolean not null default false;

comment on column public.productos.es_demo is
  'Anuncio de demostración (semilla). No se indexa en el sitemap, se etiqueta como ejemplo y no expone contacto.';
comment on column public.perfiles.es_demo is
  'Perfil de demostración (semilla). No se indexa y nunca debe mostrar el sello de verificado.';

-- ── 2. Backfill: lo sembrado antes de esta migración ───────────────────────
update public.perfiles p
   set es_demo = true,
       verificado = false,
       verificado_desde = null,
       telefono = null,
       telefono_visible = false,
       whatsapp_disponible = false
  from auth.users u
 where u.id = p.id
   and coalesce(u.raw_user_meta_data->>'semilla', '') = 'true';

update public.productos pr
   set es_demo = true,
       metodos_contacto = jsonb_build_object('email', coalesce(pr.metodos_contacto->>'email', ''))
  from auth.users u
 where u.id = pr.user_id
   and coalesce(u.raw_user_meta_data->>'semilla', '') = 'true';

-- ── 3. Índices: el sitemap y el catálogo filtran por esta columna ──────────
create index if not exists productos_es_demo_idx on public.productos (es_demo);
create index if not exists perfiles_es_demo_idx on public.perfiles (es_demo);
