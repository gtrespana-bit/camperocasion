-- ═══════════════════════════════════════════════════════════════════════════
-- 202609170005 — Limpieza de categorías legadas del marketplace generalista
--
-- CamperOcasión es un vertical 100% camper: la única categoría real es
-- `camper` (migración 026). Las categorías del marketplace generalista
-- original (vehiculos, tecnologia, moda, hogar, herramientas, otros,
-- repuestos, materiales) quedaron en la tabla `categorias` sin uso: el
-- formulario de publicación, los filtros y la navegación ya no las exponen.
--
-- Borrado SEGURO: solo elimina las que ningún producto referencia. Si algún
-- anuncio antiguo todavía apunta a una de ellas, la fila se conserva para no
-- dejar `productos.categoria_id` huérfanos. Ejecutarla es opcional y no
-- afecta a la app (la UI ya no presenta estas categorías).
-- ═══════════════════════════════════════════════════════════════════════════

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
