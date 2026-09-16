# CamperOcasión — Proyecto

> Documentación completa en [`README.md`](./README.md).

## General
- **Repo:** `gtrespana-bit/camperocasion` (GitHub)
- **Producto:** Marketplace vertical de furgonetas camper y autocaravanas de ocasión en España
- **Dominio canónico:** `https://camperocasion.es`
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
