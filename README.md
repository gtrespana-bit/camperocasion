# CamperOcasión 🚐

**El marketplace especializado en furgonetas camper y autocaravanas de ocasión en España.**

CamperOcasión es un marketplace vertical (Next.js App Router) 100% orientado al
mundo camper: compra, venta y publicación de **furgonetas camperizadas y
autocaravanas de ocasión** en todo el territorio español (50 provincias +
Ceuta y Melilla), en una única moneda: **el euro (€)**.

## Runtime y seguridad

Usar **Node.js 24.22.1 o un parche posterior de la rama 24**. Con nvm:
`nvm install && nvm use`, después `npm ci`. Las instalaciones/builds rechazan versiones inferiores al mínimo configurado.
Para que el CI utilice `.nvmrc`, copiar `docs/ci/ci-node-security.yml` sobre
`.github/workflows/ci.yml` desde GitHub (actualización manual pendiente).

El runtime real de producción se consulta en `/api/diagnostico/runtime` (sesión de
admin o `Authorization: Bearer <CRON_SECRET>`). La rotación de claves y el resto
del procedimiento están en [Node.js / Stripe](docs/SEGURIDAD-NODE-STRIPE.md).

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

## Herramientas para el comprador

- **Calculadora de ITP** (`/calcular-itp`): impuesto de la compraventa entre
  particulares según la comunidad del comprador, con el desglose del cálculo
  (depreciación por antigüedad, base imponible, cuota fija de vehículo antiguo,
  tipo incrementado por potencia fiscal o cilindrada) y el coste total con la
  tasa de la DGT. Incluye landings por comunidad (`/calcular-itp/{ccaa}`).
- **Checklist de compra segura** (`/compra-segura-camper`): qué documentación y
  qué reformas revisar antes de firmar, con el foco en campers (homologación
  declarada, plazas, MMA y carnet, instalación de gas, carga útil).

Los tipos por comunidad viven en `src/lib/itp.ts` (registro con fuente oficial y
fecha de revisión): es el único sitio a actualizar cada año.

## Precios

Moneda única: **euro**. Formato `X.XXX €` (p. ej. `38.500 €`). Rango
habitual del catálogo: 20.000 € – 80.000 €. Los importes se guardan en la
columna legada `precio_usd` (se mantiene por compatibilidad con el esquema
de la base de datos) y se tratan como **euros**; la capa de presentación
los formatea siempre con `formatPrecio()` de `src/lib/precio.ts`.

## Geografía

- 17 Comunidades Autónomas + Ceuta y Melilla (`src/lib/ubicaciones.ts`).
- Una landing SEO por cada provincia (`/[provincia]`, p. ej.
  `https://camperocasion.online/madrid`) con keywords como
  *"furgonetas camper segunda mano madrid"*,
  *"camper gran volumen valencia"*, *"autocaravanas ocasión barcelona"*.
- Landings programáticas provincia + subcategoría
  (`/[provincia]/gran-volumen`, …) → `src/lib/ubicaciones-seo.ts` +
  `src/lib/categorias-seo.ts`.

## Stack

- Next.js 16 (App Router) + TypeScript — deploy en Vercel; `output: 'standalone'`
  solo opt-in para self-hosting (`npm run build:standalone`)
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
| `npm run build` | Build de producción (la que usa Vercel) |
| `npm run build:standalone` | Build autoalojada (`.next/standalone` + `server.js`) |
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

Hay tres capas separadas (análisis completo en
[`docs/MODELO-CUENTAS-Y-MONETIZACION-2026-10.md`](./docs/MODELO-CUENTAS-Y-MONETIZACION-2026-10.md)):

1. **Identidad** (`particular` / `camperizador` / `profesional`): gratis. Da
   sello y filtros; no es un plan.
2. **Plan** (`gratis` / **Profesional 19 €**, o 190 €/año con 2 meses gratis):
   15 anuncios, 20 fotos, 5 destacados al mes y escaparate. Un único plan de
   pago, sin escalones. Se cobra con Stripe (suscripción) y se gestiona desde
   el portal de cliente.
3. **Créditos** (2 / 15 / 40 / 100): visibilidad puntual (boost al #1 y
   destacados), pago único por Stripe, Bizum, transferencia o PayPal.

Publicar la primera camper es gratis. El escaparate requiere el plan Profesional (o la
prueba de 30 días) para tiendas nuevas; las ya publicadas se mantienen.

La prueba tiene **fechas reales por cuenta**, 7 días de gracia al terminar y
avisos por email/push (10, 3 y 1 días). Cuando acaba, los anuncios que exceden
el cupo se **pausan, no se borran**, y se reactivan al pasar a Profesional. Si falla
un cobro, el plan sigue activo hasta `plan_hasta` y se avisa por email
(`invoice.payment_failed`), con recordatorios a 3 y 7 días.

Migración de la fase 2:
`supabase/migrations/202610220001_planes_prueba_gracia_dunning.sql`.

## Panel admin

`/admin` (solo `ADMIN_EMAILS`) es el centro de operaciones: publicaciones,
moderación, usuarios, homologación, reservas, transacciones, auditoría,
categorías, comunicación, planes y cupones, exportación y ajustes.

- **Audiencia** (`/admin?tab=audiencia`): visitantes únicos, páginas vistas,
  sesiones, tiempo por página, registros, anuncios publicados, mensajes,
  favoritos y canjes, todo clasificable por **día, semana o mes** y por rango
  (hoy, 7 días, 30 días, mes, mes pasado, 90 días, 12 meses, todo o fechas a
  mano), con comparativa contra el periodo anterior, top de páginas y anuncios,
  dispositivos, idioma, fuentes de tráfico, horas y días de la semana, y la
  lista de anuncios activos sin ninguna visita. Se exporta a CSV.
- **Regalar plan** (`/admin` → *Planes y cupones* o desde la ficha de un
  usuario): días de Profesional gratis para una cuenta concreta,
  sin cupón y sin Stripe, sumando al final del periodo vigente o empezando
  ahora. Queda en la bitácora `planes_regalos` y al usuario se le avisa por
  email.

La medición de audiencia es **propia y anónima**: un id aleatorio del navegador,
sin IP ni user-agent, y solo se activa si el usuario pulsa «Aceptar» en el aviso
de cookies (igual que Vercel Analytics). Migración:
`supabase/migrations/202609290001_analitica_visitas.sql`.

### Google Analytics 4

La propiedad GA4 del proyecto (`G-14MFBYME0R`, `GA_ID_POR_DEFECTO` en
`src/lib/google-analytics.ts`) se mide en producción sin configurar nada; en
`npm run dev` no se mide. `NEXT_PUBLIC_GA_MEASUREMENT_ID` (Vercel → Settings →
Environment Variables; es `NEXT_PUBLIC_`, así que hay que **redeployar** tras
cambiarla) sirve para medir con otra propiedad (`G-XXXXXXXXXX`) o apagar GA con
`off`.

`src/components/GoogleAnalyticsScript.tsx` publica el **snippet propio en el
`<head>` del HTML inicial**. Ya no depende de un chunk dinámico, de la hidratación
de React ni de `load` + idle. Si hay consentimiento guardado, carga gtag.js de
forma asíncrona inmediatamente; si no, escucha el aviso de cookies.

Se mantiene **Consent Mode básico**: hasta «Aceptar» no se descarga código de
Google, no se configura GA, no hay cookies analíticas ni pings sin cookies. El
consentimiento empieza denegado para analítica y publicidad. Nunca se inicia la
medición desde `/admin`, no se usan Google Signals ni personalización de
anuncios y las cookies caducan a los 13 meses. Rechazar, pulsar «Cambiar mi
decisión» o retirar el permiso en otra pestaña desactiva GA inmediatamente
(`window['ga-disable-<ID>']` y consentimiento denegado). Volver a aceptar no
vuelve a descargar gtag.js ni a configurar la propiedad.

El **aviso de cookies** (`CookieConsent`, montado en el layout raíz) es la única
puerta de entrada a ese consentimiento: si no aparece en la web, nadie puede
aceptar y GA4 medirá 0 visitas (le pasó al sitio en 2026-10; diagnóstico
completo en `docs/DIAGNOSTICO-GOOGLE-ANALYTICS-2026-10-18.md`). El test
`tests/unit/cookie-consent-banner.test.tsx` vigila que siga montado.

`GoogleAnalytics.tsx` solo comunica los cambios de ruta para excluir el panel.
Las páginas vistas de la navegación SPA las registra la *medición mejorada* de
GA4 (activada por defecto en la propiedad: *Administrar → Flujos de datos →
Medición mejorada → Cambios de página basados en eventos del historial del
navegador*), así que no se envía `page_view` a mano. La CSP de `next.config.js` ya
permite `googletagmanager.com`, `google-analytics.com` y `analytics.google.com`.

#### Si Google dice «No se ha detectado su etiqueta»

1. **Desplegar los cambios en producción**. Guardarlos en una rama no actualiza
   `camperocasion.online`. Comprobar que `NEXT_PUBLIC_GA_MEASUREMENT_ID` no es
   `off` ni apunta a otra propiedad; un cambio de variable requiere nueva build.
2. Probar **`https://camperocasion.online/`**, no una vista previa ni `/admin`.
   En «Ver código fuente» debe aparecer `ga4-bootstrap` y `G-14MFBYME0R` (o el ID
   configurado). Esto comprueba la instalación del snippet, no la recepción de
   eventos por Google.
3. Abrir **Tag Assistant** (`https://tagassistant.google.com/`), conectar esa URL
   y pulsar **Aceptar** en el aviso de cookies de la web. Si antes se rechazó,
   ir a `/politica-de-cookies` → «Cambiar mi decisión» y aceptar. Desactivar
   bloqueadores de anuncios/privacidad solo durante la prueba.
4. En Red/Network debe aparecer `gtag/js?id=G-14MFBYME0R` y, tras aceptar, las
   peticiones `g/collect`. Confirmar el mismo ID en Tag Assistant y comprobar
   **Tiempo real** en GA4. No instalar un segundo snippet ni un contenedor GTM
   para forzar la detección: duplicaría la medición.
5. En un navegador limpio, antes de decidir o después de rechazar, **no debe
   haber solicitudes a Google Analytics**. El comprobador automático de Google
   puede seguir indicando que no encuentra la etiqueta si no interactúa con el
   banner; eso es compatible con Consent Mode básico. No habilitar seguimiento
   sin permiso solo para eliminar ese aviso.

## Despliegue en Vercel

La build es *zero-config*: Vercel detecta Next.js por `package.json` y usa
`next build` / `.next`. Aun así hay cuatro cosas que hay que tocar a mano.

1. **Importar el repo** (`gtrespana-bit/camperocasion`) y dejar
   *Production Branch* en `main`. Si el proyecto se crea **sin** conectar el
   repo, o se conecta después del último push, no existe ningún despliegue:
   Vercel muestra *«No Production Deployment — Your Production Domain is not
   serving traffic»*. Se dispara desde
   *Project → Deployments → ⋯ → Deploy* o con un push nuevo a `main`.
2. **Variables de entorno** — `.env.example` es la lista completa.
   Imprescindibles: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`. Las `NEXT_PUBLIC_*` se **incrustan en el bundle
   en build time**: cambiarlas obliga a redeployar.
3. **NO definir `NEXT_OUTPUT=standalone`** en el proyecto: `output: 'standalone'`
   rompe la build de Vercel (`ENOENT .next/next-server.js.nft.json` con Next 16).
4. **Crons**: las 4 rutas de `vercel.json` exigen `CRON_SECRET`; sin ella
   responden 401. En el plan Hobby Vercel limita las ejecuciones de cron al día.

`camperocasion.online` y `www.camperocasion.online` se añaden en
*Project → Settings → Domains* con el registro `CNAME cname.vercel-dns.com`
(apex incluido: Vercel hace *CNAME flattening*; si el proveedor no lo permite,
`A 76.76.21.21`). Los dominios alternativos `vendet.online` y el anterior
`camperocasion.es` (apex + www) redirigen 301 al canónico vía
`next.config.js`, por si quedaran apuntando a Vercel.
