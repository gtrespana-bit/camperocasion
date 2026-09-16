# CamperOcasión — Proyecto

> Documentación completa en [`README.md`](./README.md).

## General
- **Repo:** `gtrespana-bit/camperocasion` (GitHub)
- **Producto:** Marketplace vertical de furgonetas camper y autocaravanas de ocasión en España
- **Dominio canónico:** `https://camperocasion.online` (cambiado el 2026-09-16
  desde `camperocasion.es`, que no llegó a servir; 301 de `.es` y `vendet.online`
  en `next.config.js`)
- **Idiomas:** `es` (canónico, indexado) y `en` (disponible, noindex)
- **Moneda:** Euro (€) — formato `X.XXX €`

## Relanzamiento (2026-09)
El proyecto nace de la base del marketplace generalista venezolano,
relanzado como vertical camper español:

1. **Marca:** CamperOcasión — "El marketplace especializado en furgonetas
   camper y autocaravanas de ocasión en España". Paleta grafito + verde
   bosque + naranja camper.
2. **Moneda única:** Euro. Eliminado el sistema de tasa BCV / Bolívares
   (`tasaBCV.ts`, `/api/tasa-bcv`) y los pagos manuales venezolanos
   (Pago Móvil, Banesco/Provincial, Binance Pay) → Bizum, transferencia
   y PayPal.
3. **Geografía:** España — 17 CC.AA. + 50 provincias + Ceuta/Melilla, con
   landings SEO provinciales y programáticas por subcategoría.
4. **Categorías:** 100% camper (7 subcategorías) con ficha técnica
   específica (DGT, homologación, plazas, autonomía…).
5. **Vistas:** Home con buscador por tipo/provincia/precio, catálogo con
   filtros técnicos, ficha con bloques "Mecánica del Vehículo" y
   "Equipamiento Camper y Autonomía", perfil de vendedor
   Particular/Profesional-Camperizador.
6. **Filtros técnicos (2026-09):** 16 filtros agrupados en mecánica,
   habitabilidad y autonomía, sobre el JSONB `productos.especificaciones`
   (contención `@>` con índice GIN). Registro único en
   `src/lib/filtros-tecnicos.ts`: captura en `/publicar`, filtros del catálogo,
   opciones y traducción a la consulta salen del mismo sitio.
7. **Homologación verificada (2026-09):** expediente documental del vehículo
   (bucket privado `documentos-vehiculo` + tabla `documentos_vehiculo` +
   `productos.verificacion_homologacion`). El vendedor sube ficha técnica, ITV y
   —si declara "Vehículo Vivienda (2448/3148)"— proyecto de homologación; el
   admin lo revisa en `/admin` → *Homologación* y el anuncio recibe el sello
   (`src/components/BadgeHomologacion.tsx`) más el filtro "solo homologación
   verificada" del catálogo. Cualquier cambio en el expediente devuelve el
   anuncio a revisión.
8. **Calculadora de ITP y compra segura (2026-09):** `/calcular-itp` con el tipo
   por comunidad autónoma (registro de 19 territorios en `src/lib/itp.ts`,
   coeficientes de depreciación del anexo IV, cuotas fijas para vehículos
   antiguos y tipos incrementados), 19 landings por CCAA, checklist de compra
   segura de camper (`/compra-segura-camper`) y enlace desde cada anuncio con el
   precio precargado.
9. **Canonización del esquema ES sin downtime (2026-09-17):** migración `supabase/migrations/202609170001_rename_legado_camperocasion.sql` (y mismo bloque anexado a `setup-camperocasion.sql` para fresh installs) introduce columnas canónicas españolas (`productos.precio` / `precio_eur`, `perfiles.dni` / `telefono_verificacion` / `banco_verificacion` / `dni_foto_url`, `solicitudes_verificacion.telefono` / `dni` / `banco` / `dni_foto_*`, bucket `documentos-identidad`, `transacciones.precio_eur`) con triggers `fn_sync_*` que mantienen los aliases legados `precio_usd` / `pago_movil_*` / `cedula_*` / bucket `cedulas` sincronizados. Código nuevo usa el canónico (src/lib/precio.ts: getPrecioEur/COLUMNAS_PRECIO, src/app/api/publicar + src/app/api/productos/editar + src/components/SolicitarVerificacion con fallback al bucket legado, src/app/api/admin/cedula intenta documentos-identidad antes que cedulas). Sin borrado: ambos nombres funcionan.
