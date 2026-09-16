-- ============================================================
-- vendido_fecha: timestamp real de venta para prueba social.
--
-- "Vendidos recientemente" en la home necesita ordenar por fecha de
-- venta. Antes solo existía `vendido boolean` y `vendido_en text`
-- (lugar de la venta: plataforma / otra_pagina / no_especificado),
-- sin cuándo ocurrió.
--
-- Backfill: los vendidos históricos no tienen fecha registrada; se
-- aproxima con creado_en (conservador: nunca aparecerán como "más
-- recientes" de lo que son).
-- ============================================================

alter table productos
  add column if not exists vendido_fecha timestamptz;

update productos
  set vendido_fecha = creado_en
  where vendido = true
    and vendido_fecha is null;
