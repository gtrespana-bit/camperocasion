# CamperOcasión 🚐

**El marketplace especializado en furgonetas camper y autocaravanas de ocasión en España.**

CamperOcasión es un marketplace vertical (Next.js App Router) 100% orientado al
mundo camper: compra, venta y publicación de **furgonetas camperizadas y
autocaravanas de ocasión** en todo el territorio español (50 provincias +
Ceuta y Melilla), en una única moneda: **el euro (€)**.

## Subcategorías

| Subcategoría | Ejemplos |
|---|---|
| 🚐 Gran Volumen | Fiat Ducato, Peugeot Boxer, Citroën Jumper, Renault Master, VW Crafter, Mercedes Sprinter, MAN TGE (L2H2 – L4H3) |
| 🏕️ Camper Mediana / Compacta | VW California, Mercedes Marco Polo, Ford Transit Custom, Renault Trafic, Toyota Proace |
| 🚙 Minicamper | Berlingo, Rifter/Partner, Kangoo, Caddy, Dokker |
| 🛖 Autocaravana Perfilada | Perfiladas sobre furgón (Ducato, Transit, Crafter…) |
| 🚌 Autocaravana Capuchina | Capuchinas con litera superior |
| 🏭 Autocaravana Integral | Adria, Hymer, Challenger, Laika, Swift, Profile, PIK… |
| 🌍 Célula y 4x4 Overland | Células sobre pick-up, Toyota, Mitsubishi, Defender… |

## Ficha técnica camper

Cada anuncio recoge un bloque técnico específico, usado tanto en el
formulario de publicación como en los filtros del catálogo y en la ficha
del producto:

- **Mecánica**: año de matriculación, kilómetros, combustible (Diésel /
  Gasolina / Híbrido / Eléctrico), transmisión (Manual / Automática),
  potencia (CV), tamaño de chasis, tracción (4x2 / 4x4), **MMA** (tramos de
  peso máximo autorizado, con la frontera de los 3.500 kg del carnet B),
  **longitud** y **altura exterior** (tramos para garaje y ferry),
  **distintivo ambiental DGT** (Cero Emisiones / ECO / C / B / Sin) y
  **homologación** (Vehículo Vivienda 2448/3148, Turismo 1000, Mixto
  Adaptable 3100, Furgón 2400).
- **Habitabilidad**: plazas homologadas para viajar y plazas para dormir.
- **Equipamiento Camper y Autonomía**: calefacción estacionaria (Diésel /
  Gas / No), agua caliente, tipo de baño, depósito de agua limpia (L),
  batería auxiliar (Litio / AGM / Gel / No), placa solar (Sí/W), inversor
  220V (Sí/W) y tipo de nevera.

Todos estos campos se capturan en `/publicar`, se muestran en la ficha del
producto y **son filtros del catálogo**. La lista de filtros, sus opciones y su
traducción a la consulta viven en un único registro:
`src/lib/filtros-tecnicos.ts` (ver
[`docs/plan-confianza-marketplace.md`](./docs/plan-confianza-marketplace.md) §2.1).

## Confianza: homologación verificada

Además de los filtros, el anuncio puede acreditar su documentación:

- El vendedor sube **ficha técnica**, **última ITV** y —si el anuncio declara
  "Vehículo Vivienda (2448/3148)"— el **proyecto de homologación**, desde
  `/producto/editar/[id]` (expediente del vehículo).
- Los documentos van a un **bucket privado** (`documentos-vehiculo`) y se abren
  siempre con URL firmada de 5 minutos.
- El equipo los revisa en `/admin` → pestaña **Homologación** y entonces el
  anuncio muestra el sello *Homologación verificada* y aparece en el filtro
  "Solo homologación verificada" del catálogo.
- Si el vendedor reemplaza un documento, el expediente vuelve a revisión: el
  sello acredita unos documentos concretos, no el anuncio para siempre.

Detalle y decisiones en
[`docs/plan-confianza-marketplace.md`](./docs/plan-confianza-marketplace.md) §2.2.

## Precios

Moneda única: **euro**. Formato `X.XXX €` (p. ej. `38.500 €`). Rango
habitual del catálogo: 20.000 € – 80.000 €. Los importes se guardan en la
columna legada `precio_usd` (se mantiene por compatibilidad con el esquema
de la base de datos) y se tratan como **euros**; la capa de presentación
los formatea siempre con `formatPrecio()` de `src/lib/precio.ts`.

## Geografía

- 17 Comunidades Autónomas + Ceuta y Melilla (`src/lib/ubicaciones.ts`).
- Una landing SEO por cada provincia (`/[provincia]`, p. ej.
  `https://camperocasion.es/madrid`) con keywords como
  *"furgonetas camper segunda mano madrid"*,
  *"camper gran volumen valencia"*, *"autocaravanas ocasión barcelona"*.
- Landings programáticas provincia + subcategoría
  (`/[provincia]/gran-volumen`, …) → `src/lib/ubicaciones-seo.ts` +
  `src/lib/categorias-seo.ts`.

## Stack

- Next.js 16 (App Router, `output: 'standalone'`) + TypeScript
- next-intl (`es` canónico, `en` sin indexar)
- Supabase (Postgres + Auth + Storage + Realtime)
- Tailwind CSS 3 — paleta: grafito `#0F172A` / pizarra `#1E293B`,
  verde bosque `#16A34A` / `#15803D`, naranja camper `#EA580C`
- Jest (tests unitarios en `tests/unit`)

## Desarrollo

```bash
npm install
cp .env.example .env   # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY…
npm run dev            # http://localhost:3000
```

Sin variables de entorno de Supabase la web arranca igualmente: las
páginas públicas se renderizan vacías (sin datos) en lugar de fallar.

### Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (standalone) |
| `npm start` | Servidor de producción |
| `npm test` | Tests unitarios (Jest) |
| `npx tsc --noEmit` | Comprobación de tipos |

## Estructura clave

```
src/
  app/
    layout.tsx                 # Metadata raíz (OG, Twitter, schema, ES)
    sitemap.ts, robots.ts      # Sitemaps (incluye landings provinciales)
    api/                       # Rutas: publicar, comprar-creditos, datos-pago…
    [locale]/
      page.tsx                 # Home: buscador + módulos por subcategoría
      catalogo/                # Catálogo con filtros técnicos (JSONB)
      buscar/                  # Búsqueda
      producto/[slug]/         # Ficha con "Mecánica" + "Equipamiento Camper"
      publicar/                # Formulario en 4 pasos
      [ciudad]/                # Landings SEO provinciales
      categoria/               # Landing de categoría
      creditos/ dashboard/     # Créditos y panel del vendedor
  components/                  # Header, Footer, filtros, selector de ubicación…
  lib/
    categorias.ts              # Subcategorías camper + campos técnicos
    categorias-seo.ts          # SEO de categorías/subcategorías
    ubicaciones.ts             # 17 CC.AA. + 52 provincias
    ubicaciones-seo.ts         # Landings provinciales (keywords camper)
    precio.ts                  # formatPrecio() → "38.500 €"
    creditos.ts                # Paquetes de créditos (€) + métodos de pago
  content/blog/                # Guías camper (markdown con frontmatter)
public/                        # Logo, iconos PWA, og-image, manifest
```

## Monetización

Publicar es gratis. Opcionalmente, los vendedores compran **créditos**
(boost al #1 y destacados) por **Bizum, transferencia o PayPal**, con
comprobante y aprobación. Paquetes: 2 / 15 / 40 / 100 créditos.
