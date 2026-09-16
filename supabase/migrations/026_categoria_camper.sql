-- Relanzamiento CamperOcasión (2026-09): marketplace vertical camper.
-- La categoría única del formulario de publicación es `camper`.
-- (El api/publicar también crea la categoría bajo demanda, pero el seed
-- aquí evita el 406 de PostgREST en la primera lectura y documenta el
-- contrato front ↔ tabla `categorias`.)
insert into categorias (nombre) values
  ('camper')
on conflict (nombre) do nothing;
