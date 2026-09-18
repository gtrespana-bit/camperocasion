# Análisis completo de CamperOcasión — 2026-09-18

> Auditoría de código, producto y estrategia pedida por el propietario:
> «que todo esté correcto, sin errores, lo más eficiente y premium posible,
> visualmente perfecto, sin ningún resto de VendeT Venezuela, y con todas las
> posibilidades de ser un marketplace ganador — y si no, decir exactamente qué
> falta y qué merece la pena».
>
> **Veredicto corto:** el producto ya está por encima de la media de un
> marketplace vertical español y **puede ganar**, pero ganará o perderá por
> liquidez (oferta en las provincias correctas) y por cumplimiento legal para
> cobrar, no por más features. Abajo está lo que se ha corregido en esta pasada
> y las **siete** cosas que de verdad mueven la aguja.

---

## 1. Qué se ha corregido en esta pasada

### 1.1 Restos de VendeT / Venezuela

| Dónde | Qué había | Qué se ha hecho |
|---|---|---|
| `login`, `register`, `confirm`, `reset-password` | El logotipo escrito a mano **«VendeT-España»** (lo que viste) | Componente único `src/components/BrandLogo.tsx` (icono real + «Camper**Ocasión**» + descriptor). Las cuatro pantallas lo usan |
| `ContactForm`, `DashboardHeader`, `producto/editar` | Prefijos de teléfono **+58 412** (Venezuela) en textos y valores por defecto | Prefijo español `+34 600 123 456` |
| `contacto` | Teléfono **falso visible** `+58 412 XXX XXXX` | Bloque real: email, WhatsApp; el teléfono solo si existe `NEXT_PUBLIC_TELEFONO_CONTACTO`. **Nunca un número de relleno** |
| `creditos` | Etiqueta **«Cédula»** en los datos de pago | «Titular» (`holder`); se ha eliminado la clave `idCard` |
| `como-funciona` | Claves i18n `vendetTitle`, `vendet1..5` | Renombradas a `camperTitle`, `camper1..5` |
| `scripts/performance-test.js` | Medía Lighthouse sobre **vendet.online** | Ahora sobre `camperocasion.online` |
| `setup-camperocasion.sql`, migraciones 2026080100xx | Cabeceras de comentario «VendeT — …» | «CamperOcasión — …» |
| `precio.ts`, `categorias.ts`, `ubicaciones.ts`, `generar-publicaciones.js` | Comentarios que citaban la marca/país anteriores | Redacción neutra («esquema original», «nombres de export históricos») |
| `.gitignore` | Patrones `vendet.online_*.report.*`, `vendet_urls_*.txt` | Genéricos (`lh-*.json`, `urls_*.txt`) |

**Se conserva a propósito** (no es un resto, es ingeniería correcta):

- Los **301 de `vendet.online` → `camperocasion.online`** de `next.config.js`:
  es lo que evita perder tráfico y señal SEO del dominio viejo.
- La limpieza de **cachés `vendet-*`** en `public/sw.js` y `AuthProvider`:
  hay que borrar el caché antiguo en los navegadores que ya visitaron el sitio.
  (Ahora el comentario dice explícitamente por qué.)
- `docs/ESTADO-IMPLEMENTACION.md` y los informes de auditoría históricos:
  documentan de dónde viene el esquema (`precio_usd`, `pago_movil_*`) y ya
  llevan una nota que aclara que son legado. Borrarlos sería perder la
  explicación de por qué la base de datos se llama así.
- Las columnas legado `precio_usd`, `pago_movil_*`, `cedula_*`: siguen
  existiendo **sincronizadas por trigger** con las canónicas (`precio`, `dni`…).
  El código nuevo debería ir migrando lecturas al canónico; hoy convive bien
  porque el trigger mantiene los dos nombres iguales.

### 1.2 Errores y riesgos reales encontrados (y arreglados)

1. **El botón de WhatsApp no funcionaba con vendedores españoles.**
   `ProductoPageClient` construía el enlace anteponiendo **el prefijo de
   Venezuela**: `wa.me/5834612345678`. Es decir, **la vía de contacto
   principal del sitio estaba rota**. Nuevo `src/lib/telefono.ts` (normaliza
   +34, respeta prefijos internacionales) + 7 tests. El perfil del vendedor
   usaba el número sin limpiar (`wa.me/+34 612…`), también corregido.

2. **El botón de inspección precompra nunca se pintaba.**
   `BotonInspeccion` estaba importado en la ficha y no se renderizaba en
   ninguna parte: los compradores **no podían pedir la inspección** (§4.1 del
   plan de confianza). Ahora va bajo la reserva (no son excluyentes) y se
   oculta en anuncios de demostración.

3. **Se enseñaba un IBAN de mentira como si fuera real.**
   `/api/datos-pago` devolvía `ES00 0000 0000 0000 0000 0000 00`, `600 000 000`
   y «CamperOcasión SL» cuando faltaba una variable de entorno, y la web los
   pintaba como datos de pago reales. Ahora cada método viaja con
   `configurado`, la UI **solo ofrece los que existen** y, si no hay ninguno,
   lo dice con claridad en vez de inventar.

4. **El «boost» de 1 crédito era eterno y casi no servía de nada.**
   - `boosteado_en` no caducaba **nunca**: quien pagaba una vez se quedaba
     arriba para siempre y nadie más tenía motivo para comprar créditos.
   - El orden del catálogo se aplicaba **solo dentro de la página ya
     descargada**: la consulta pedía «los N más recientes» y el boost solo
     reordenaba esas filas, así que un anuncio de hace un mes **no subía a
     ningún sitio** aunque pagara.
   - Arreglado: `BOOST_DIAS = 7` en `src/lib/catalog-consulta.ts` (fuente única
     del orden + `aplicarOrdenCatalogo`), orden **también en SQL** en el
     catálogo, buscador, landings de provincia/categoría, home y landings de
     tipo de vendedor; cron diario `/api/cron/expirar-prioridades` para limpiar
     la base de datos; la compra pasa por `POST /api/productos/promocionar` (en
     servidor, con la RPC que ya validaba `auth.uid()`) y **revalida la caché**
     para que el efecto se vea al instante. Textos actualizados: «Subir al nº 1
     — 7 días».
   - La RPC `usar_boost` cobraba aunque la subida siguiera vigente: dos clics
     seguidos eran dos créditos por un solo efecto. La migración
     `202609180004` lo impide (devuelve `ya_activo` sin tocar el saldo) y
     `scripts/verify_boost_sql.py` lo demuestra crédito a crédito sobre un
     Postgres real.

5. **La portada y las landings se quedaban congeladas.**
   `/[locale]` se prerenderiza y **no tenía `revalidate`**: los anuncios que
   había en el build eran los que se veían hasta que alguna escritura
   revalidara. Igual en `/comprar-a-*`. Añadido ISR de 5 minutos, más
   revalidación explícita en los flujos que no la hacían: aprobar producto,
   marcar vendido, eliminar anuncio, verificar venta, y la compra de prioridad.

6. **Anuncios de demostración indistinguibles de anuncios reales.**
   La semilla crea 20 anuncios con **móviles españoles inventados** (números
   que hoy son de personas reales), con perfiles marcados como «verificado» y
   textos escritos como si fueran reales. En una web pública eso es publicidad
   engañosa y, sobre todo, el peor arranque para un marketplace que vende
   confianza. Ahora: columna `es_demo` (migración `202609180003`), backfill de
   lo ya sembrado, **se vacían los teléfonos**, los perfiles demo dejan de ser
   «verificados», los anuncios demo salen del sitemap, la ficha muestra
   «🧪 Anuncio de ejemplo» y **no expone contacto**, y las tarjetas llevan la
   etiqueta «Ejemplo». La semilla ya no publica teléfonos ni verificaciones.

7. **Imágenes pidiendo calidades no declaradas** (`quality={80}` del hero y
   `90` del OG) → Next las ignoraba y avisaba en cada build. Declaradas en
   `next.config.js` (`images.qualities`).

### 1.3 Verificación técnica de esta pasada

```
npx tsc --noEmit      → 0 errores
npx eslint .          → 0 errores, 0 avisos
npx jest (unit)       → 31 suites, 321 tests, todos en verde
npm run build         → compila (166/166 páginas estáticas + rutas dinámicas)
python3 scripts/validate_setup_sql.py       → 814 statements, sin error
python3 scripts/validate_migrations_sql.py  → 11 migraciones 202609* reaplicadas,
                                              223 statements, sin error
python3 scripts/verify_boost_sql.py         → TODO OK (10 comprobaciones)
```

`verify_boost_sql.py` es nuevo: levanta un Postgres de verdad con el arnés del
proyecto y demuestra, crédito a crédito, que promocionar un anuncio no se puede
cobrar dos veces — primer boost 3→2, segundo intento con el boost vigente
`ok:false`/`ya_activo` y **saldo intacto**, caducado vuelve a cobrar, y sin saldo
la operación falla con un error claro sin marcar el anuncio. Es la prueba que
faltaba sobre el camino del dinero.

Se han comprobado además, sobre el HTML/JSON servidos y con las consultas
reales, que: las pantallas de autenticación ya no contienen «VendeT»; el botón
de WhatsApp de cualquier anuncio genera un número **+34** (antes anteponía el
prefijo de Venezuela y **no funcionaba con ningún móvil español**); `/contacto`
y `/creditos` no muestran datos falsos; la ficha de un anuncio de ejemplo sale
con `robots: noindex` y sin datos de contacto; y el catálogo ordena los boosts
vigentes (7 días) en SQL, no solo dentro de la página descargada.

---

## 2. Estado del proyecto por áreas

| Área | Estado | Comentario |
|---|---|---|
| Arquitectura | **Muy bien** | Next.js App Router + Supabase, 312 archivos, un único registro de verdad para categorías, filtros técnicos, precios, ITP y orden del catálogo |
| Rendimiento | **Bien** | ISR por página, `optimizePackageImports`, fuentes locales woff2, RPC que consolida 6 consultas en 1 (`obtener_detalle_producto`), lazy de providers. Pendiente: `/marcas` pesa 587 KB de HTML |
| SEO | **Muy bien** | Landings de 52 provincias × categorías, blog, calculadora de ITP por CCAA, `sitemap`/`robots`, JSON-LD, `noindex` en inglés |
| Seguridad | **Bien** | RLS, `requireUser`/`requireAdmin`, rate limit atómico (falla cerrado), validación de URLs de storage y de redirects, sin secretos en el cliente |
| Confianza | **Excelente** | Homologación verificada con expediente documental, reserva con señal y confirmación del vendedor, inspección precompra, contrato de compraventa, gestoría, reputación |
| Monetización | **Rota → arreglada** | Créditos + paquetes en €, pero boost eterno/inoperante y cobro manual con IBAN falso |
| Legal | **Casi completo** | Páginas reescritas el 2026-09-18 (privacidad veraz, cookies con botón para cambiar la decisión, términos con intermediario y desistimiento, y aviso legal nuevo). Solo falta rellenar los datos del titular en Vercel (`NEXT_PUBLIC_TITULAR_*`) y el visto bueno de un abogado antes de facturar |

---

## 3. Lo que de verdad mueve la aguja (y lo que no)

Esto es lo que un marketplace vertical español necesita para ganar, ordenado
por efecto real. **No es una lista de deseos: son las siete cosas que cambian
el resultado.**

### 3.1 Cumplimiento para poder cobrar (bloqueante, coste bajo) — *páginas legales ya escritas*

Hoy la web **no puede cobrar legalmente**: falta el **aviso legal** con razón
social, NIF y domicilio (Ley 34/2002, art. 10) y falta identificar la
condición de **intermediario** y quién es el vendedor en cada anuncio
(TRLGDCU art. 27 para marketplaces). Además, si se venden créditos a
consumidores hay que **emitir factura** y aplicar las reglas de desistimiento
de contenido digital, cosa que el flujo actual (Bizum + captura aprobada a
mano) no hace.

**Qué haría:** alta como autónomo/SL → Stripe (soporta **Bizum** en España) →
página de aviso legal con datos reales → factura automática (Stripe Tax o
Contasimple). Esto convierte la monetización en algo real y elimina el trabajo
manual.

### 3.2 ~~El aviso de cookies no cumple~~ ✅ resuelto (2026-09-18)


`CookieConsent` empieza a cargar **Vercel Analytics y Speed Insights antes de
que el usuario acepte**. En España, la AEPD exige consentimiento **previo** a
las cookies no necesarias (y los identificadores de analítica lo son). Hay que
montar `<Analytics />` solo si `localStorage['cookie-consent'] === 'accepted'`.
Es barato y quita un riesgo de sanción en la web pública.

### 3.3 Liquidez: la única batalla que importa al principio

Un marketplace no falla por features, falla por no tener lo que el comprador
busca. La estrategia más eficaz aquí, con diferencia:

- **Camperizadores y profesionales primero** (son vendedores repetidos: 5-15
  unidades al año). Hoy el registro contempla `camperizador` y `profesional`,
  pero su perfil es una página más: dales una **tienda**: logo, descripción,
  teléfono, stock agrupado, y un enlace «ver todo mi stock» que puedan pegar en
  su web/Instagram. Eso te trae inventario regalado y crea dependencia.
- **Páginas de modelo con datos de mercado** («Fiat Ducato camper de ocasión:
  precios reales 2026», con rangos de precio de tus propios anuncios). Nadie
  más en España tiene ese dato por subcategoría; es contenido único que Google
  premia y que los medios citan.
- **Herramienta «¿Cuánto vale mi camper?»** con el que capturas al vendedor
  antes de que publique y le mandas un email con la valoración. Es el
  lead-magnet natural de este negocio y reutiliza los datos de depreciación que
  ya tienes en `src/lib/itp.ts`.

Lo que **no** haría ahora: app nativa, sistema de pagos propio en la web,
subastas, envíos, marketplace multi-país.

### 3.4 Cerrar el círculo del vendedor (impacto directo en ingresos)

- **Renovación y contratación guiada:** el anuncio caduca/renueva a los 7 días
  y ya existe el endpoint, pero el vendedor no recibe un aviso claro «tu
  anuncio bajó de posición, súbelo por 1 crédito». Un email/push en el momento
  exacto es donde se venden los créditos.
- **Estadísticas que justifiquen pagar:** visitas y favoritos (hay `visitas`),
  comparación con la media de su categoría («tu anuncio tiene un 40 % menos de
  visitas que la media: súbelo»).
- **Cobro con Stripe** en lugar del circuito manual: cada hora de administración
  ahorrada es una hora para vender.

### 3.5 Confianza a nivel de plataforma (ya vas por delante, remátalo)

Tienes homologación verificada, inspección, contrato y gestoría. Falta hacerlo
**visible y comparable**: un sello «Anuncio verificado CamperOcasión» con
criterios públicos y una página que explique qué has comprobado (documentos,
identidad del vendedor, historial). Y un **protocolo de fraude** con tiempos de
respuesta comprometidos para que un comprador estafado no se sienta solo.

### 3.6 Performance y detalle premium

- `/marcas` sirve 587 KB de HTML: paginar o generar por marca y enlazar.
- Los avisos de lint que quedan (`<img>` en `/publicar`) son de vistas previas
  locales y no afectan a la LCP; se pueden dejar, pero conviene limpiarlos para
  que el lint quede en cero absoluto.
- **Rutas legado `/[ciudad]/[categoria]`**: verifica con Search Console que no
  canibalizan con `/categoria/[categoria]` (una canonical clara por landing).

### 3.7 Inglés: decisión, no dejarlo a medias

`en` existe, está traducido al 100 % de claves y marcado `noindex`. O se
elimina (menos ruido, menos mantenimiento) o se trata como mercado real
(entonces necesita contenido nativo y SEO propio). Mantenerlo invisible no
aporta nada; hoy **no estorba**, así que mi recomendación es dejarlo como está
hasta tener tráfico español consolidado.

---

## 4. Lo que NO hay que hacer

- **Más filtros, más categorías, más subcategorías.** Ya hay 16 filtros
  técnicos; añadir más complica el embudo sin traer compradores.
- **Precios por suscripción antes de tener liquidez.** Con pocos anuncios, la
  suscripción profesional se percibe como peaje; cobra por visibilidad
  (créditos) hasta tener 300-500 anuncios y entonces sí, plan PRO.
- **Rediseñar la home otra vez.** La home actual (buscador por tipo/provincia/
  precio + familias + públicos + provincias) está a la altura; el esfuerzo
  rinde más en las landings de modelo y en la ficha del anuncio.
- **Anuncios de demostración sin etiquetar** (ya arreglado): mejor 20 anuncios
  vacíos que 20 anuncios falsos sin marcar. La confianza es el activo.

---

## 5. Estado de las migraciones SQL

Nueva, **pendiente de aplicar en Supabase antes de desplegar el código**:

```
supabase/migrations/202609180003_anuncios_demo.sql
```

- Añade `productos.es_demo` y `perfiles.es_demo` (idempotente).
- Marca lo ya sembrado (`auth.users.raw_user_meta_data->>'semilla' = 'true'`),
  neutraliza teléfonos inventados y retira verificaciones falsas.
- El código tolera que aún no esté aplicada (lecturas con reintento: sitemap
  sin filtro, `es_demo` en consulta aparte), pero **el etiquetado y la
  protección de los teléfonos solo funcionan al aplicarla**.

Las bases nuevas deben ejecutar también `setup-camperocasion.sql` (ya incluye
todo lo anterior).

---

## 6. Resumen para decidir

**Lo técnico está sano:** tipos, lint, 321 tests y build en verde; CI en verde; sin restos
de la marca anterior en el producto; los tres bugs graves de esta pasada
(WhatsApp roto, inspección inaccesible, boost inoperante) están corregidos con
tests.

**Lo que falta no es código, es negocio:** aviso legal + cobro con Stripe,
consentimiento de cookies, y las tres palancas de liquidez (tienda para
profesionales, páginas de modelo con datos reales, valorador de camper). Con
eso, CamperOcasión tiene una oportunidad mejor que un generalista: es el único
sitio donde el comprador puede comprobar homologación, pedir inspección, pagar
la reserva y bajar con el contrato firmado. Ese es el producto que puede ganar
el nicho camper en España.
