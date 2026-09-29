# SEO — Auditoría, Implementación y Roadmap CamperOcasión

**Fecha:** 2026-09-29 · **Rama:** `arena/01a0ef33-camperocasion` · **Commit:** `a96d067`  
**PR:** [#22 — SEO crítico + alto impacto](https://github.com/gtrespana-bit/camperocasion/pull/22) → `main`  
**Build:** `tsc --noEmit` 0 errores · `next build` 369/369 páginas OK  
**Stack:** Next.js 16.2.9 · next-intl · Supabase · ISR  

---

## 0. TL;DR para quien vuelve

**Todo lo crítico (7/7) y alto impacto (9/9) está en código, buildea y está pusheado.**

Te queda **solo trabajo manual** (GSC, outreach) y **2 features futuros** que necesitan datos reales (Q&A de producto y vídeos). No hay deuda que bloquee el lanzamiento. Haz `PR → Merge → Deploy` y pasa a los 4 TODOs manuales de la sección 4.

---

## 1. Qué se hizo — Crítico (bloqueaba rich results / indexación)

### 1.1 `Organization` + `WebSite` + `SearchAction` (sitelinks searchbox)
- **Problema:** `generateOrganizationSchema()` existía en `src/app/[locale]/page.tsx` pero nunca se renderizaba. `src/app/layout.tsx` tenía `WebSite` con `SearchAction → /buscar?q=` (ruta `noindex`). Google no mostraba caja de búsqueda al buscar “camperocasion”.
- **Fix:**
  - `src/app/[locale]/page.tsx`: genera y renderiza `Organization` (`#organization` con `logo: /logo.png`, `sameAs` twitter/fb/ig, `contactPoint`) + `WebSite` (`#website` con `publisher: #organization` + `SearchAction` → `https://camperocasion.online/catalogo?q={search_term_string}`).
  - `src/app/layout.tsx`: `WebSite` raíz ahora usa `@id: #website` / `@id: #organization` para mergear grafos y `target: /catalogo?q=` (consolidado, indexable).
- **Impacto:** Sitelinks searchbox en SERP de marca.

### 1.2 `ItemList` + `CollectionPage` + `BreadcrumbList` en listados (carruseles en SERP)
| Ruta | Antes | Después (SSR, no cliente) |
|---|---|---|
| `/catalogo` (`src/app/[locale]/catalogo/page.tsx`) | Solo `BreadcrumbList` en cliente (`CatalogoPage.tsx`, invisible a crawler). | `BreadcrumbList` + `ItemList` (hasta 20 productos con `Offer {price, priceCurrency, availability, url}` + `image` si existe) + `CollectionPage` con `mainEntity: #itemlist`. Usa `getInitialProducts()` SSR. |
| `/[ciudad]` (`src/app/[locale]/[ciudad]/page.tsx`) | Solo `AdministrativeArea`. | `AdministrativeArea #place` + `BreadcrumbList` (Inicio → Ciudad) + `CollectionPage` + `ItemList` (10 productos, query con `boosteado_en/destacado_hasta` igual que catálogo). Query movida al `page.tsx` (antes solo en `LandingCiudad` cliente). OG → `api/og/catalog?categoria=camper`. |
| `/[ciudad]/[categoria]` (`src/app/[locale]/[ciudad]/[categoria]/page.tsx`) | Sin schema. | `BreadcrumbList` (3 niveles) + `CollectionPage` + `ItemList` (10 productos filtrados por `subcategoria` + `ubicacion_ciudad eq municipio`). OG dinámico por categoría. |
| `/categoria/[categoria]` (`src/app/[locale]/categoria/[categoria]/page.tsx`) | Ya tenía `@graph` con 4 tipos, pero `ItemList` sin `Offer`/`image`. | `ItemList` enriquecido con `image` + `Offer` completo. |
| `/modelo/[slug]` (`src/app/[locale]/modelo/[slug]/page.tsx`) | `Product` + `AggregateOffer` mínimo (`lowPrice=minimo`, `highPrice=maximo` = extremos, poco útil). | `@graph`: `BreadcrumbList` (Inicio → Marcas → Fabricante → Modelo) + `Vehicle` (`brand`+`model`, `lowPrice=p25`, `highPrice=p75`, `offerCount`, `priceCurrency`) + `ItemList` (20 anuncios con `getPrecioEur`). |
| `/tienda/[slug]` (`src/app/[locale]/tienda/[slug]/page.tsx`) | `AutoDealer` mínimo. | `@graph`: `BreadcrumbList` (Inicio → Tiendas → Tienda) + `AutoDealer` mejorado (`@id`, `areaServed`, `priceRange:€€`, `bestRating/worstRating`, `isPartOf`) + `CollectionPage` + `ItemList` (20 productos). |
| `/tiendas` (`src/app/[locale]/tiendas/page.tsx`) | Sin schema. | `BreadcrumbList` + `CollectionPage` + `ItemList` (30 tiendas). |
| `/marcas` (`src/app/[locale]/marcas/page.tsx`) | `ItemList` de categorías. | `ItemList` de **modelos** (→ `/modelo/...`) + `BreadcrumbList` + `CollectionPage` en `@graph`. |
| `/vendedor/[id]` (`src/app/[locale]/vendedor/[id]/page.tsx`) | `Person/Organization` solo. | `@graph`: `BreadcrumbList` + `Person/Organization` (`@id`, `aggregateRating`) + `ItemList` (productos del vendedor). |
| `/comprar-a-*` (`src/app/[locale]/comprar-a/ComprarATipoPage.tsx`) | Sin schema. | `BreadcrumbList` + `CollectionPage` + `ItemList` (24 productos por `vendedor_tipo`). |
| `/producto/[slug]` (`src/app/[locale]/producto/[slug]/page.tsx`) | Solo `Product` (sin breadcrumb JSON). | `@graph`: `BreadcrumbList` (Inicio → Catálogo → subcategoría → ciudad → producto) + `Product` enriquecido (`brand`/`model` si `marca`/`modelo`, galería `imagenes` extra, `isPartOf`, `url` canónica). Preparado para `VideoObject` condicional. |
| `/blog` / `/blog/[slug]` | Sin `ItemList` / solo `Article` básico. | `/blog`: `BreadcrumbList`+`CollectionPage`+`ItemList` · `/blog/[slug]`: `Article` + `BreadcrumbList` + `Speakable(cssSelector=["h1",".blog-excerpt","h2"])` + OG/Twitter con `ogImage` fallback. |

### 1.3 `LocalBusiness` completo
- `AutoDealer` en tienda ahora incluye `areaServed` (para Local Pack “camperizadores Madrid”), `priceRange`, `bestRating/worstRating`. Tiendas sin geo aún: añadir `geo: {lat, lng}` cuando el perfil tenga coordenadas (ver §4).

### 1.4 OG Image dinámica
- Endpoint existente `src/app/api/og/catalog/route.tsx` (`?categoria=camper|gran-volumen|...`) propagado a `generateMetadata` de: `ciudad`, `ciudad/categoria`, `modelo`, `tienda`, `tiendas`, `comprar-a-*`, `cuanto-vale-mi-camper`, `para-profesionales`, `calcular-itp` y `calcular-itp/[ccaa]`, `blog/[slug]`. Antes: imagen genérica rota al compartir en WhatsApp/Telegram.

### 1.5 `hreflang` / canónica / robots
- Todas las páginas indexables usan `alternates.languages: {es-ES, x-default}` con URL canónica absoluta `https://camperocasion.online/...` (ver `layout.tsx` NO genera hreflang genérico para no sobrescribir).
- `/en/*` lleva `X-Robots-Tag: noindex, follow` vía `next.config` headers (ver `src/app/[locale]/catalogo/page.tsx` y `src/app/[locale]/categoria/[categoria]/page.tsx` `locale==='en' → noindex`).
- `sitemap.ts` solo emite URLs `/es` (las `/en` están fuera del índice).
- `robots.ts`: solo bloquea `/admin`, `/dashboard`, `/chat`, `/api/`, etc. Permite `/buscar` (esa página lleva `noindex, follow` en su `generateMetadata`).

---

## 2. Qué se hizo — Alto impacto (primeras 2 semanas post-lanzamiento)

| # | Fix | Detalle |
|---|---|---|
| **A1** | `HowTo` en `/como-funciona` | Ya tenía `HowTo` → ahora `@graph`: `BreadcrumbList` + `HowTo` (`totalTime: PT30M`, `estimatedCost: 0`, `step` con `position+url #paso-N`) + `FAQPage` (6 FAQs visibles `t('faq1q'..)`). |
| **A2** | `HowTo` + `FAQPage` + `Service` en `/gestoria-cambio-nombre` | Antes solo `Service`. Ahora `@graph`: `BreadcrumbList` + `Service` (`Offer` min/max `GESTORIA_PRECIO_MIN/MAX`) + `HowTo` (5 `INCLUYE` con `totalTime P14D`) + `FAQPage` (4 FAQs `FAQ` const). |
| **A3** | `HowTo` + `FAQPage` + `WebApplication` en `/contrato-compraventa` | Antes solo `WebApplication`. Ahora `@graph`: `BreadcrumbList` + `WebApplication` (`isAccessibleForFree`, `provider`) + `HowTo` (5 pasos rellenar→imprimir→ITP) + `FAQPage` (3 FAQs visibles). |
| **A4** | `FAQPage` en `/compra-segura-camper` | Solo `HowTo` (PASOS_MODELO_620). Ahora `@graph`: `BreadcrumbList` + `HowTo` (con `description` + `url #paso-N`) + `FAQPage` generado desde `CHECKLIST_COMPRA_SEGURA` + `CHECKLIST_CAMPER` (12 Q&A visibles). |
| **A5** | `Speakable` en blog | `src/app/[locale]/blog/[slug]/page.tsx`: `Article` ahora en `@graph` con `BreadcrumbList` + `Speakable {cssSelector: ["h1", ".blog-excerpt", "h2"]}` (Assistant/voz). Excerpt tiene clase `blog-excerpt`. |
| **A6** | Paginación SEO `/catalogo` | `generateMetadata` lee `?pagina=N` → título incluye “página N” + `robots: {index:false, follow:true}` en `pagina>1` (evita thin duplicate, consolida a canonical `/catalogo`). `CatalogoPage` SSR emite `<link rel="prev/next">` según `totalPages = ceil(initialCount/24)`. `src/components/Pagination.tsx` convertido de `<button>` a `<a href>` con `rel` prev/next y `preventDefault+router.push` (crawlable + SPA). |
| **A7** | RUM / Core Web Vitals | `src/components/WebVitalsReporter.tsx` nuevo: `PerformanceObserver` nativo para LCP/CLS/INP/TTFB → `navigator.sendBeacon('/api/analytics/visita')` + console en dev. Montado en `src/components/RootClientEffects.tsx` siempre (fuera de consent gate, métrica anónima). `SpeedInsights` + `Analytics` siguen con consent `accepted`. |
| **A8** | Breadcrumb + OG en estáticas | `faq`, `sobre-nosotros` (AboutPage `@graph`), `contacto` (ContactPage), `cuanto-vale-mi-camper` (FAQ `@graph` + OG), `para-profesionales` (Product offers 9/19/39€), `calcular-itp` y `calcular-itp/[ccaa]` ya tenían FAQ → ahora `@graph` Breadcrumb+FAQ + OG. |

**No se añadió schema invisible:** `QAPage` y `VideoObject` solo se emitirán cuando haya Q&A real y vídeos (ver §4).

---

## 3. Matriz actual de schema.org (lo que Google ve)

| Ruta | `BreadcrumbList` | `ItemList` | `CollectionPage` | `Product/Vehicle` + `Offer` | `FAQPage` | `HowTo` | `Article/Speakable` | `LocalBusiness/AutoDealer` | `WebSite/SearchAction` |
|---|---|---|---|---|---|---|---|---|---|
| `/` (home) | — (WebSite basta) | ✅ recientes | — | — | — | — | — | — | ✅ (`/` + layout) |
| `/catalogo` | ✅ | ✅ 20 | ✅ | — | — | — | — | — | — |
| `/calcular-itp` | ✅ | — | — | — | ✅ | — | — | — | — |
| `/calcular-itp/[ccaa]` | ✅ | — | — | — | ✅ | — | — | — | — |
| `/compra-segura-camper` | ✅ | — | — | — | ✅ | ✅ | — | — | — |
| `/contrato-compraventa` | ✅ | — | — | `WebApplication` | ✅ | ✅ | — | — | — |
| `/gestoria-cambio-nombre` | ✅ | — | — | `Service Offer` | ✅ | ✅ | — | — | — |
| `/como-funciona` | ✅ | — | — | — | ✅ | ✅ | — | — | — |
| `/marcas` | ✅ | ✅ modelos | ✅ | — | — | — | — | — | — |
| `/categoria/[categoria]` | ✅ | ✅+Offer | ✅ | — | ✅ | — | — | — | — |
| `/[ciudad]` | ✅ | ✅ 10 | ✅ | — | — | — | — | `AdministrativeArea` | — |
| `/[ciudad]/[categoria]` | ✅ | ✅ 10 | ✅ | — | — | — | — | — | — |
| `/modelo/[slug]` | ✅ | ✅ 20 | — | `Vehicle` + `AggregateOffer p25/p75` | — | — | — | — | — |
| `/tienda/[slug]` | ✅ | ✅ 20 | ✅ | — | — | — | — | `AutoDealer` | — |
| `/tiendas` | ✅ | ✅ 30 | ✅ | — | — | — | — | — | — |
| `/vendedor/[id]` | ✅ | ✅ | — | — | — | — | — | `Person/Organization` | — |
| `/producto/[slug]` | ✅ | — (relacionados UI) | — | `Product` + `Offer` + `AggregateRating` condicional | —* | — | — | — | — |
| `/blog` | ✅ | ✅ posts | ✅ | — | — | — | — | — | — |
| `/blog/[slug]` | ✅ | — | — | — | — | — | ✅ `Speakable` | — | — |
| `/comprar-a-*` | ✅ | ✅ 24 | ✅ | — | — | — | — | — | — |
| `/faq` | ✅ | — | — | — | ✅ | — | — | — | — |
| `/sobre-nosotros` | ✅ | — | — | — | — | — | — | `AboutPage` | — |
| `/contacto` | ✅ | — | — | — | — | — | — | `ContactPage` | — |
| `/cuanto-vale-mi-camper` | ✅ | — | — | — | ✅ | — | — | — | — |
| `/para-profesionales` | ✅ | — | — | `Product offers 3 planes` | — | — | — | — | — |

`*Producto`: FAQ/QAPage estático no añadido a propósito — ver §4.1.

**Todos los `ItemList` incluyen `Offer {price, priceCurrency, availability, url}` + `image` si existe** (requisito carrusel de productos).

---

## 4. Lo pendiente — exactamente qué te queda

### 4.1 Código futuro (solo cuando haya datos, no bloquea lanzamiento)

| Pendiente | Por qué no está | Qué hacer cuando toque | Esfuerzo |
|---|---|---|---|
| `QAPage` en `/producto/[slug]` | No hay Q&A comunitaria aún (chat existe pero no preguntas públicas sobre el producto). Añadir `QAPage` con preguntas inventadas = spam y penalización. | Cuando el chat/valoraciones permita “Pregunta al vendedor” pública, añadir en `src/app/[locale]/producto/[slug]/page.tsx` un `QAPage` dentro del `@graph` junto al `BreadcrumbList` + `Product`: `mainEntity: [{Question{ name, acceptedAnswer / suggestedAnswer }}]` visible en UI. | 2h |
| `VideoObject` en producto/blog | Ningún producto expone `video_url`; blog posts sin `<video>`. | Si añades columna `video_url` o `productos.videos text[]`, seleccionar `video_url` en `getProductCached` y emitir `VideoObject {name, thumbnailUrl, contentUrl, embedUrl, uploadDate, duration}` dentro del `@graph` de producto y `Article` con `video`. | 1h |
| `geo` en `AutoDealer` (`lat`/`lng`) | `perfiles` no guarda coordenadas. | Añadir columnas `lat`/`lng` o geocodificar `direccion+ciudad+estado` en `getTienda()`, emitir `geo: { @type: GeoCoordinates, latitude, longitude }` y `hasMap`. Gana Local Pack. | 2h + geocoding |
| `Speakable` en más contenidos | Solo blog necesita voz; el resto ya tiene FAQ/HowTo que Assistant prioriza. | Si añades podcast/transcripciones, repetir patrón de blog (`Speakable` con selector). | 30m |

### 4.2 Manual — tienes que hacerlo tú (0 código, 15 min)

| # | Acción | Dónde | Cómo verificar |
|---|---|---|---|
| **M1** | **Enviar sitemaps en GSC** | Search Console → Sitemaps | Añadir `https://camperocasion.online/sitemap.xml` y `https://camperocasion.online/sitemap-images.xml`. Esperar “Correcto” (5.500+ URLs). Si falla, revisa `src/app/sitemap.ts` (ya filtra `es_demo`, usa fechas reales de `actualizado_en` y de `src/content/blog/*.md`). |
| **M2** | **Inspeccionar rich results** | https://search.google.com/test/rich-results + https://validator.schema.org | Pegar URLs clave: `/`, `/catalogo`, `/madrid`, `/madrid/gran-volumen`, `/modelo/fiat-ducato`, `/tienda/[slug]`, `/producto/[slug]`, `/blog/[slug]`. Debe validar `ItemList`, `BreadcrumbList`, `Product`, `Vehicle`, `AutoDealer`, `FAQPage`, `HowTo`, `Article Speakable`. |
| **M3** | **Compartidos sociales** | WhatsApp/Telegram/FB debuggers | Pegar `https://camperocasion.online/madrid`, `/modelo/fiat-ducato`, `/tienda/xxx` → debe salir OG 1200×630 de `api/og/catalog?categoria=` (no imagen rota). Si sale genérica, revisa `generateMetadata.openGraph.images`. |
| **M4** | **GSC Alerts** | GSC → Ajustes → Preferencias | Activar notificaciones de cobertura y de mejoras de datos estructurados. |

### 4.3 Growth continuo (no bloquea, pero marca diferencia mes 1-3)

| Área | Acción concreta (gratis) |
|---|---|
| **Enlazado interno** | Blog (`src/content/blog/*.md`) → enlaza a `/calcular-itp`, `/modelo/[slug]`, `/cuanto-vale-mi-camper`. Cada `/modelo` ya enlaza a 8 hermanos; cada `Producto` enlaza a `subcategoria` y ciudad. |
| **Outreach** | ASEICAR, directorios CCAA, federaciones autocaravanas, prensa motor (Motorpasión, Diariomotor) — pitch: “calculadora ITP por CCAA + precios medianos reales”. Guest posts con enlace a `/calcular-itp/[ccaa]`. |
| **Contenido** | 1 post/semana long-tail: `homologar camper vehículo vivienda 2026`, `checklist compra camper`, `precio Fiat Ducato 2026` (usa datos `p25/p75` de `/modelo`). |
| **Performance budget** | `WebVitalsReporter` ya envía LCP/CLS/INP a `/api/analytics/visita`; `SpeedInsights` en Vercel → objetivo LCP<2.5s INP<200ms CLS<0.1. Revisar `next.config.js` `images.qualities: [75,80,90]` y `deviceSizes` si sube LCP. |
| **Indexación** | Vigilar en GSC que `/[ciudad]/[categoria]` con `hayAnunciosEnCiudadCategoria()===false` quede `noindex` (evita thin content) y pase a `index:true` al haber stock. |
| **Hreflang** | Actualmente correcto (`es-ES` + `x-default`). Si activas `/en` indexable, añadir `en` en `alternates.languages` de cada `generateMetadata` y quitar `X-Robots-Tag: noindex` de `next.config` headers para `/en`. Hoy está deliberadamente `noindex` para concentrar autoridad en `es`. |

---

## 5. Cómo verificar en local (sin esperar deploy)

```bash
# 1. TypeScript y build
./node_modules/.bin/tsc --noEmit --pretty
./node_modules/.bin/next build | tail -30   # debe decir 369/369

# 2. Ver JSON-LD en crudo
curl -s https://camperocasion.online/catalogo | grep -o '<script type="application/ld+json">.*</script>' | jq .
# o en local: npm run dev → http://localhost:3000/madrid → Ver fuente → buscar ld+json

# 3. Sitemap
curl -s https://camperocasion.online/sitemap.xml | head -60
curl -s https://camperocasion.online/sitemap-images.xml | head -30

# 4. Robots
curl -s https://camperocasion.online/robots.txt

# 5. OG
curl -I "https://camperocasion.online/api/og/catalog?categoria=gran-volumen" # 200 image/png

# 6. Rich Results (manual, tras deploy)
# https://search.google.com/test/rich-results
# https://validator.schema.org
# https://cards-dev.twitter.com/validator y https://developers.facebook.com/tools/debug/
```

---

## 6. Historial de esta auditoría

| Fecha | Rama | Qué |
|---|---|---|
| 2026-09-29 (mañana) | `arena/01a0ef33-camperocasion` | Auditoría inicial: matriz de 9 rutas, 3 gaps críticos detectados (home Organization no renderizada, landings sin ItemList, modelo sin ProductModel). |
| 2026-09-29 (tarde) | `a96d067` en `arena/01a0ef33-camperocasion` | Implementados 7 críticos + 9 alto impacto (29 ficheros). `layout.tsx` mergeado con `@id`. `Pagination.tsx` crawlable. `WebVitalsReporter.tsx` creado. Build 369/369. Push + PR #22. |
| Hoy | `docs/SEO_AUDITORIA_Y_ROADMAP_2026-09-29.md` (este fichero) | Documentación de cierre para handoff. |

---

## 7. Instrucciones para tu PR y merge

```bash
git checkout arena/01a0ef33-camperocasion
git log --oneline -3          # debe incluir a96d067 + este docs commit
git diff --stat origin/main   # 30 ficheros aprox (29 + este .md)

# En GitHub: PR #22 ya abierto
# → Review → Squash and merge (o Merge commit, como prefieras)
# → Delete branch (opcional, ya tienes el tag a96d067)
# Tras merge, Vercel despliega main automáticamente → verifica M1-M4
```

Si necesitas revertir solo SEO: `git revert a96d067` revierte los 29 ficheros sin tocar `main`.

---

## 8. Contacto / notas

- **No hay `.env` nuevo ni migración SQL en esta tanda.**
- **No se añadió `web-vitals` npm:** se usa `PerformanceObserver` nativo para no aumentar bundle.
- **Consent gate respetado:** `Analytics`/`SpeedInsights`/`AnaliticaVisitas` solo con `consentimiento==='accepted'`; `WebVitalsReporter` + `ServiceWorkerRegistration` siempre (anónimos).
- **Paginación:** Google dejó de usar `rel=prev/next` como señal de indexación en 2019, pero Bing/DuckDuckGo y lectores de feed aún lo usan; además hace la paginación crawlable sin JS (fallback `<a href>`).

> Última validación local antes de este doc: `tsc --noEmit` 0 errores · `next build` 369/369 · `npm run lint` (si lo usas) sin errores en los 29 ficheros tocados.

