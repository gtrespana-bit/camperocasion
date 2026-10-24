# Duplicar CamperOcasión para maquinaria y herramientas

> Decisión, evidencia y plan de ejecución — 2026-10-24
> Pregunta de partida: ¿duplicamos esta web para maquinaria agrícola / de obra /
> herramientas, o empezamos de cero?

---

## 1. Veredicto

**Duplicar, no empezar de cero.** Pero duplicar *con una fase de limpieza previa*,
no copiar-pegar y ponerse a editar.

El motivo no es el diseño ni el CSS (eso son dos semanas). El motivo es que **el
80 % del coste de esta web es un motor de marketplace que no tiene nada que ver
con las campers** y que ya está construido, probado y en producción:

| Pieza | Dónde vive | Líneas | ¿Sirve para maquinaria? |
|---|---|---|---|
| API (109 rutas) | `src/app/api/**` | 12.013 | Sí, casi tal cual |
| Panel de administración | `src/app/[locale]/admin/**` | 6.907 | Sí |
| Área de usuario | `src/app/[locale]/dashboard/**` | 5.231 | Sí |
| Chat / mensajería | `src/app/[locale]/chat` + `api/chat` | ~1.600 | Sí |
| Auth, Stripe, planes, cupones, push, emails, auditoría, moderación, rate-limit | `src/lib/*` | ~8.800 | Sí |
| Componentes compartidos (galería, cards, filtros, header/footer, PWA) | `src/components/**` | 5.905 | Sí, con retoques |
| **Capa de dominio camper** | `src/lib/{categorias,categorias-seo,marcas,filtros-tecnicos}.ts` | ~1.365 | **No — se reescribe** |
| **Páginas editoriales camper** | ITP, valorador, gestoría, homologación, contrato | ~4.700 | **No — se tiran** |

Solo **23 de las 109 rutas de API** mencionan "camper", y en la mayoría es un
comentario o una cadena de texto. El panel admin (41 rutas), el chat, las
notificaciones, los pagos y la moderación son agnósticos al producto.

### El precedente ya está en tu propio repo

`PROJECT.md` lo dice: *"El proyecto nace de la base del marketplace generalista
venezolano, relanzado como vertical camper español"*. Ya hicisteis exactamente
este movimiento una vez, y funcionó. Un vertical nuevo sobre este motor es la
segunda iteración del mismo patrón, no un experimento.

### Por qué NO empezar de cero

Empezar de cero significa reescribir, desde la nada y con las mismas reglas de
negocio ya aprendidas a golpes:

- 19 tablas, **112 políticas RLS** y **70 funciones/triggers** en
  `setup-camperocasion.sql` (6.626 líneas) — el RLS multiusuario es, con
  diferencia, lo más caro y lo más fácil de hacer mal.
- Autenticación + verificación de identidad + perfiles particular/profesional.
- Cobros: Stripe, planes, cupones, packs, regalo de planes, conciliación manual.
- Chat con tiempo real, notificaciones push, emails transaccionales, Telegram.
- SEO programático: sitemaps, JSON-LD, canónicas, landings provincia × categoría.
- Panel admin con 14 pestañas operativas.

Eso son meses. Duplicarlo y readaptar la capa de dominio son semanas.

### El coste real de duplicar

No es "copiar la carpeta". Son **1.653 menciones a "camper"** repartidas en 165
de los 412 ficheros de `src`, y **"camperocasion" aparece en 125 ficheros**
(dominio, marca, textos legales, metadata, emails, manifest PWA, schema.org…).
Hay que hacer un barrido sistemático, y hay que hacerlo *antes* de escribir el
contenido, no después.

---

## 2. La única decisión de arquitectura que hay que cambiar sí o sí

Tienes suerte con el modelo de datos: `productos` es genérico
(`titulo, descripcion, categoria_id, subcategoria, marca, modelo, estado,
precio, ubicacion_*, imagenes[], especificaciones JSONB`). **El JSONB
`especificaciones` ya absorbe cualquier ficha técnica sin tocar el esquema.**

El problema es otro, y es de producto:

> **Camper es homogéneo. La maquinaria no.**

En CamperOcasión hay *una* categoría (`camper`) con 7 subtipos que **comparten
un único juego de filtros**: `FILTROS_TECNICOS` (16 filtros: DGT, homologación,
plazas para dormir, placa solar…). Es un registro plano y global, y funciona
porque todos los anuncios son vehículo-vivienda.

En maquinaria convive gente que busca cosas que no tienen un solo atributo en
común:

- **Agrícola:** tractores, aperos, cosechadoras, remolques, pulverizadores, riego
- **Obra:** miniexcavadoras, dumpers, compactadores, generadores, andamios, hormigoneras
- **Herramientas:** taladros, compresores, soldadura, motosierras, jardinería

Si copias `FILTROS_TECNICOS` tal cual, un anuncio de un taladro te pedirá
"plazas para dormir". **Esto sí hay que refactorizarlo**, y es el único cambio
estructural serio del proyecto:

```
HOY:   FILTROS_TECNICOS: FiltroTecnico[]           // plano, global
MAÑANA: CAMPOS_POR_CATEGORIA: Record<slug, FiltroTecnico[]>
```

La buena noticia: el operador de consulta no cambia. `catalog-consulta.ts` sigue
usando contención JSONB (`@>` con índice GIN `productos_especificaciones_idx`),
solo que ahora los campos que se ofrecen en la UI se resuelven según la categoría
activa. Es un refactor de la capa de presentación de filtros, **cero migraciones
de datos**.

Campos transversales que sí se comparten entre todas las categorías:
`Año`, `Horas de uso` (equivalente a kilómetros en maquinaria), `Estado`,
`Combustible`, `Potencia (CV)`, `Peso (kg)`, `¿Incluye transporte?`,
`Documentación` (CE / libro de instrucciones / factura / ITV maquinaria).

---

## 3. Qué se queda, qué se adapta, qué se tira

### Se queda tal cual (≈ 70 % del código)

- `src/app/api/**` salvo retoques de naming
- `src/app/[locale]/admin/**` completo
- `src/app/[locale]/dashboard/**` completo
- Chat, mensajería, favoritos, búsquedas guardadas, notificaciones push
- `src/lib/`: `stripe*`, `cupones`, `planes-*`, `creditos`, `auditoria`,
  `moderacion`, `rate-limit`, `push*`, `email*`, `sb-admin`, `require-auth`,
  `validation`, `ratelimit`, `storage-paths`, `importar-csv`, `analitica*`
- Infraestructura SEO: `src/lib/seo.ts`, `sitemap.ts`, `robots.ts`,
  `serialize-json-ld.ts`, `product-url.ts`
- PWA, optimización de imágenes, i18n (es/en)

### Se adapta (≈ 20 %)

| Fichero / zona | Trabajo |
|---|---|
| `src/lib/categorias.ts` (431 l.) | Reescribir: 3 familias → N categorías heterogéneas |
| `src/lib/filtros-tecnicos.ts` (386 l.) | Refactor a campos **por categoría** (§2) |
| `src/lib/marcas.ts` (275 l.) | Sustituir por catálogo de marcas de maquinaria (Kubota, New Holland, John Deere, Case, JCB, Bobcat, Takeuchi, Honda, Stihl, Husqvarna, Makita, Bosch…) |
| `src/lib/categorias-seo.ts` (273 l.) | Reescribir textos SEO |
| `src/lib/ubicaciones-seo.ts` (147 l.) | **Reutilizar geografía** (provincias ya está), cambiar el copy |
| `/publicar`, `/catalogo`, `/producto/[slug]` | Cambiar bloques de ficha y validaciones |
| `src/components/ProductCard.tsx`, `CatalogFilters.tsx` | Quitar DGT/homologación/plazas, añadir horas de uso |
| `src/lib/textos-legales.ts` (698 l.) | Revisar: titular, NIF, actividad, cookies |
| `src/i18n/dictionaries/{es,en}.json` (1.179 l. c/u) | Traducir/reescribir el vocabulario |

### Se tira (≈ 10 %) — y esto *no* es un problema, es una ventaja

- `src/lib/itp.ts` (875 l.) + `/calcular-itp` (908 l.) → el ITP es de vehículos
- `src/lib/verificacion-homologacion.ts` + pestaña *Homologación* del admin
- `/gestoria-cambio-nombre` (356 l.)
- `/cuanto-vale-mi-camper` + `valoracion.ts` + `precios-mercado.ts` (884 l.)
- `/contrato-compraventa` + `contrato.ts` (778 l.) — *adaptable si quieres
  contrato de compraventa de maquinaria, pero es otro texto legal*
- `/compra-segura-camper` (195 l.)
- `public/semilla-fotos/**` (fotos de campers) y `scripts/semilla-*`
- Los 301 de `vendet.online` / `camperocasion.es` en `next.config.js`

> El sello "homologación verificada" no desaparece: **se reconvierte** en
> "documentación verificada" (CE, libro de instrucciones, factura). En maquinaria
> usada ese sello vale más que en camper, porque el comprador no puede saber si
> una miniexcavadora tiene papeles hasta que la ve.

---

## 4. Cómo duplicar sin poner en riesgo lo que factura

**Repo nuevo, no carpeta nueva.** No metas el segundo vertical dentro de
`camperocasion`: compartiría `next.config.js`, `package.json`, despliegue y
variables de entorno, y un cambio de dependencias rompería la web que ya vende.

```
1. Fork / template del repo → gtrespana-bit/<nueva-marca>
2. Rama `main` limpia, CI en verde, deploy de "esqueleto" en Vercel
3. Fase de limpieza (tirar lo camper, dejar el motor compilando)
4. Fase de taxonomía (categorías + campos por categoría)
5. Fase de marca (naming, textos, legal, SEO)
6. Carga de contenido y lanzamiento
```

**Servicios externos: todos nuevos, nada compartido.** Un Supabase distinto no es
burocracia: es lo que evita que un borrado en pruebas se lleve por delante
anuncios reales. Checklist de `.env.example` (41 variables):

- Supabase: proyecto nuevo + `setup*.sql` reescrito a esquema limpio
- Stripe: cuenta/productos nuevos (o la misma cuenta con precios distintos)
- Cloudflare R2: bucket nuevo para fotos
- Resend / SMTP, VAPID keys (push), Telegram, GA, Search Console
- Dominio nuevo + titular/NIF en las variables `NEXT_PUBLIC_TITULAR_*`

---

## 5. Plan por fases

### Fase 0 — Decisiones (1 día)
- Nombre y dominio. Comprobar disponibilidad y que no haya marca registrada.
- Alcance: ¿agrícola + obra + herramientas en un solo sitio, o solo uno de los tres?
- ¿Alquiler además de venta? (mercado grande en maquinaria, pero es otro modelo
  de datos: disponibilidad, fianzas, calendario)
- ¿Zona: España entera o una CCAA primero? (con maquinaria, la logística pesa
  mucho más que con campers: conviene decidir si hay porte)

### Fase 1 — Clon y esqueleto (2-3 días)
- Fork del repo, renombrar paquete, `.env.example`, `next.config.js` (dominios,
  imágenes remotas, sin los 301 de camper).
- Supabase nuevo + `setup-*.sql` ejecutado limpio.
- Deploy en Vercel con el dominio nuevo. **Objetivo: `main` verde y desplegando.**

### Fase 2 — Limpieza de dominio (3-5 días)
- Borrar las páginas de §3 "se tira" y sus rutas de API asociadas
  (`documentos-vehiculo`, `gestoria`, `inspecciones`).
- Barrido de las 1.653 menciones: `grep -ri camper` → a cero en `src/`.
- Centralizar marca en **un solo fichero** (`src/lib/marca.ts`):
  `NOMBRE, DOMINIO, EMAIL, TELEFONO, TITULAR_NIF, COLORES`. Hoy está a fuego en
  125 ficheros; esto es lo que evita que la tercera web cueste otra semana.
- Renombrar el proyecto y `package.json`.

### Fase 3 — Taxonomía y filtros (5-8 días) ← el núcleo
- Nuevo `categorias.ts`: familia → categoría → subcategoría.
- `camposPorCategoria` (§2), con filtros que se resuelven según la categoría activa
  en `CatalogFilters`, `useProductLoader` y `usePrefetch` (los tres leen del mismo
  registro — mantén esa propiedad, es lo que evita el bug clásico de páginas que
  "comen" filas).
- `/publicar` con formulario dinámico por categoría.
- Ficha de producto: bloques propios (técnico, estado, documentación, logística).

### Fase 4 — Marca, textos y SEO (4-6 días)
- Home, landings provincia × categoría, `/marcas`, blog.
- Textos legales, cookies, privacidad, aviso legal.
- Diccionarios es/en, manifest PWA, iconos, OG images.
- Search Console + sitemaps. **Cero contenido heredado de camperocasion**: el
  copy duplicado entre dos dominios propios es el error clásico de este tipo de
  clon y te penaliza a los dos.

### Fase 5 — Contenido y lanzamiento (variable)
- 30-50 anuncios reales antes de abrir. Un marketplace vacío no convierte y
  Google tarda en confiar en él.
- Fotos con `scripts/optimize-images.js` (reutilizable).
- Landing por marca y por provincia para las búsquedas de cola larga.

---

## 6. Estimación honesta

| Enfoque | Tiempo hasta v1 usable | Riesgo |
|---|---|---|
| Duplicar + adaptar (este plan) | **3-5 semanas** | Bajo: el motor ya está probado en producción |
| Desde cero | **3-4 meses** | Alto: reimplementas RLS, pagos, chat, admin |

El ahorro no está en el diseño, está en las 112 políticas RLS, los 109 endpoints
y las 14 pestañas del panel. Eso es lo que no quieres volver a escribir.

---

## 7. Trampas concretas (por orden de probabilidad)

1. **Copiar `FILTROS_TECNICOS` tal cual** → filtros absurdos por categoría. Es el
   error que se paga caro en la fase 4, cuando hay 500 anuncios cargados.
2. **Dejar el naming camper dentro del código** ("camperizador" en
   `TIPOS_VENDEDOR_FILTRO`, `verificacion_homologacion`, comentarios). A la
   tercera web, esto es inmanejable.
3. **Compartir Supabase/R2/Stripe "para ir rápido"** → el primer borrado de
   pruebas toca datos de producción.
4. **Contenido duplicado entre dominios propios** → penalización en ambos.
5. **Olvidar las 41 variables de entorno** → el fallo típico en producción:
   emails que no salen, push que no llega, fotos que no suben.
6. **Abrir sin inventario** → sin anuncios no hay indexación ni confianza.
7. **No decidir el tema del transporte/porte** → en maquinaria es la primera
   pregunta del comprador y no existe en el modelo actual.

---

## 8. Alternativa descartada (y por qué)

**Un solo código "multivertical" con la vertical en variable de entorno.**
Suena más elegante y es lo que harías con un equipo de 5 personas. Aquí no:
obligaría a refactorizar *y mantener* camperocasion mientras construyes lo nuevo,
con 1.653 menciones a camper y páginas de dominio mezcladas. Duplicar te deja
**dos repos que evolucionan por separado** y cero riesgo sobre lo que ya factura.

Eso sí: si en la Fase 2 centralizas marca, taxonomía y campos en ficheros de
configuración (que es lo que este plan propone), un tercer vertical pasaría de
3-5 semanas a 1-2.

---

## 9. Fase 1 ejecutada (2026-10-24)

Se ha construido un **generador de clones** en vez de duplicar a mano, porque el
barrido de marca hay que repetirlo en cada vertical que se abra:

```
tools/clon-vertical/
├── marca.json            # nombre, dominio, correos, paleta, SEO y vertical
├── preparar-clon.mjs     # genera el repo nuevo (sin dependencias externas)
└── plantillas/           # logo, iconos, OG, hero y placeholder neutros
```

Uso:

```bash
node tools/clon-vertical/preparar-clon.mjs            # → ../maquinaria-ocasion
node tools/clon-vertical/preparar-clon.mjs --destino ../otra-vertical --forzar
```

Qué hace: copia solo el árbol versionado (`git ls-files`), renombra la marca en
código, nombres de fichero y carpetas, centraliza la identidad en
`src/lib/marca.ts`, reescribe `next.config.js` (301 propios), `.env.example`,
`package.json`, manifest PWA, metadata raíz y de portada, README, `PROJECT.md` y
la paleta de Tailwind, y sustituye logo/iconos/OG/hero/placeholder. Deja fuera
las fotos semilla, el hero camper, los `assetlinks` de la TWA y los exports de
Search Console.

### Resultado verificado

Clon generado en `../maquinaria-ocasion` (657 ficheros, 73 excluidos,
12 reescritos) y comprobado en este entorno:

| Comprobación | Resultado |
|---|---|
| Referencias a `camperocasion` en `src/`, `public/` y configuración | **0** |
| `tsc --noEmit` | OK |
| `eslint .` | OK |
| `next build` | OK (384 páginas generadas) |
| Portada servida en producción | HTTP 200, marca, logo, hero y manifest nuevos |

```
<title>Maquinaria agrícola, de obra y herramientas de ocasión | MaquinariaOcasión</title>
```

Queda pendiente (y así está marcado en `docs/ESTADO-CLON.md` del clon) el
**copy visible** de la portada — hero, navegación, categorías y secciones — que
sigue siendo el de camper: es la Fase 4. La marca, el dominio y la
infraestructura ya son los nuevos.

### Dos fallos que el generador corrige y que se repetirían a mano

1. **El service worker se borraba a sí mismo.** Al renombrar la marca, la lista
   de cachés retiradas (`PREFIJOS_CACHE_RETIRADOS`) pasaba a contener el prefijo
   de su propia caché, así que `activate` la eliminaba. En un dominio nuevo la
   lista nace vacía.
2. **La metadata de la portada no venía del layout raíz.** `app/[locale]/page.tsx`
   define su propio `generateMetadata`, así que cambiar solo el layout dejaba el
   `<title>` con el copy de camper. El generador reescribe ambos.

### Pendiente heredado que conviene saber

`package.json` mantiene `engines.node: ">=24.22.1 <25"` y `.npmrc` con
`engine-strict=true`. En este entorno (Node 22) la instalación y el build se
hicieron con `npm ci --ignore-scripts --engine-strict=false`; en Vercel y en
local con `.nvmrc` no hace falta ese escape.
