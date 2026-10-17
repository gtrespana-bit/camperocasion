# SEO — Contenido y landings enriquecidas (2026-10-17)

**Contexto:** el sitio ya aparece en búsqueda pero con posición media 50–60.
La auditoría 2026-09-29 (`SEO_AUDITORIA_Y_ROADMAP_2026-09-29.md`) dejó la
capa técnica y de datos estructurados completa. Esta tanda ataca la otra
mitad del ranking: **contenido, topicalidad y enlazado interno**.

**Rama:** `arena/e443c916-camperocasion` · **Stack:** Next.js 16.2.9 · next-intl · Supabase

--

## Diagnóstico (por qué se estanca en puesto 50–60)

| Síntoma | Causa encontrada |
|---|---|
| Landings provinciales en posiciones bajas | `/[ciudad]` era H1 + 1 frase + grid: contenido *thin* y casi idéntico entre 52 provincias (riesgo de contenido duplicado programático). |
| Poca captura de long-tail | Solo 4 posts de blog y sin sección de guías en home. |
| Blog con metadatos heredados del marketplace generalista venezolano ("…todo sobre emprendimiento y comercio electrónico") → tópico equivocado. |
| Fichas de producto con título `titulo — precio — ciudad` | Sin año ni kilómetros: pierde CTR frente a Milanuncios/Coches.net en SERP. |
| Fichas sin enlaces contextuales | El crawler no ve jerarquía producto → ciudad/modelo/ITP. |

--

## Qué se implementó

### 1. Landings `/[ciudad]` enriquecidas (`LandingCiudad.tsx` + `seo-landings.ts`)
- **Estadísticas reales por provincia** (SSR, nueva helper `estadisticasCiudad()`): nº de anuncios, precio medio, mínimo y máximo — agregados de la BD, excluyendo `es_demo`. Fail-open: si la DB falla, las secciones se omiten.
- **H2 "Comprar una camper en {ciudad}"**: párrafo único por provincia con datos reales.
- **H2 "Camper de ocasión en {ciudad} por tipo"**: las 7 subcategorías **con conteo real** → enlaza a `/[ciudad]/[categoria]`.
- **H2 "Marcas más habituales en {ciudad}"** → enlaza a `/catalogo?ciudad=…&marca=…`.
- **H2 FAQ dinámica** (5 Q&A, dos generadas con agregados reales) + **JSON-LD `FAQPage`** → objetivo "La gente también pregunta".
- **H2 "Otras provincias de {CC.AA.}"**: enlazado entre landings hermanas (topicalidad regional).
- **Cierre con enlaces de confianza**: checklist de compra segura, calculadora ITP de la CC.AA. y contrato de compraventa.

### 2. Landings `/[ciudad]/[categoria]` enriquecidas (`LandingCategoria.tsx` + `categorias-seo.ts`)
- `SubcategoriaSEO` gana `introduccion[]` y `faq[]` para las **7 subcategorías** (textos redactados a mano, no spinners).
- La landing muestra: datos reales de la categoría en esa provincia (nº anuncios, precio medio, rango, marcas top), la introducción de la subcategoría, y **FAQ híbrida** (categoría + precio de la provincia) con `FAQPage` schema.
- Enlaces nuevos: volver a la landing de la provincia y al catálogo nacional de esa categoría.

### 3. Fichas de producto (`producto/[slug]/page.tsx`)
- **Título enriquecido**: `titulo — año · km — precio — ciudad` leyendo `especificaciones` (claves canónicas e históricas de `filtros-tecnicos.ts`).
- **Sección "Explora más sobre este vehículo"**: enlaces contextuales a la landing de la provincia, la página del modelo (`/modelo/[slug]` vía `modeloPorValor`+`slugModelo`), la calculadora de ITP de su CC.AA. (`TIPOS_ITP` por nombre de comunidad), checklist de compra segura y contrato.

### 3. Blog
- **Metadatos corregidos** (`blog/page.tsx`): eliminado el texto heredado venezolano; título y descripción ahora topicals camper.
- **3 posts nuevos** (~900–1.100 palabras cada uno, con tablas, H2/H3 y enlaces internos a landings, catálogo, calculadora ITP, contrato y valorador):
  - `camperizar-furgoneta-presupuesto-2026.md` — presupuesto de camperización DIY vs profesional + homologación.
  - `camper-barata-menos-25000-euros.md` — modelos base, señales de alarma, costes ocultos (ITP).
  - `camper-vs-autocaravana.md` — comparativa por precio, permiso, autonomía y costes.

### 4. Home (`page.tsx` + diccionarios es/en)
- Nueva sección **"Guías y consejos de camper"** con las 3 últimas entradas del blog (frescor + enlazado interno al blog).

--

## Segunda tanda (2026-10-16, mismo día)

- **`/modelo/[slug]`**: FAQ dinámica visible + `FAQPage` schema (precio
  mediano/rango solo si hay muestra ≥ 3; nº de anuncios; qué revisar;
  permiso de conducción según MMA).
- **Blog**: 4 guías largas más →
  `homologar-vehiculo-vivienda-2026.md` (pasos, costes y errores de la
  homologación 2448/3148), `itp-autocaravana-camper-comunidad.md`
  (cálculo por CC.AA., tipos incrementados, base liquidable),
  `mejores-campers-familiares-2026.md` (gran volumen y perfiladas
  familiares) y `vivir-en-camper-espana.md` (legalidad del vanlife:
  pernocta, ITV de vehículo vivienda, seguro, residencia fiscal).
  Todas con tablas, H2/H3 y enlaces internos a landings, modelos,
  calculadora ITP y checklist. Total: **11 posts**.
- **`/marcas`**: sección guía "Cómo elegir la marca de tu camper",
  FAQ visible (6 Q&A) + `FAQPage` schema en el `@graph`, y
  `alternates.languages` (hreflang) que faltaba en su metadata.

--

## Verificación

- `tsc --noEmit` → **0 errores**.
- `next build` → todas las rutas OK (verificar en logs del CI).
- En local: `npm run dev` → `/madrid`, `/madrid/gran-volumen`, `/producto/[slug]`, `/blog`, home → secciones nuevas visibles; JSON-LD `FAQPage` presente en landings (Ver fuente → `application/ld+json`).

## Manual (no código) — pendiente para el equipo
1. **GSC**: re-inspeccionar y *Solicitar indexación* de landings ya conocidas tras el deploy (cambió su contenido).
2. **Rich Results Test**: probar `/madrid` y `/madrid/gran-volumen` (FAQPage) y una ficha de producto (Product).
3. **GSC → Rendimiento**: en 3–4 semanas, comparar posición media de las queries de landings (antes vs después). Objetivo: 50–60 → < 30 en long-tail provincial.
4. **Off-page** (el code no lo arregla): fichas en ASEICAR y federaciones, directorios de CCAA, y outreach a prensa motor con la calculadora de ITP como gancho.
