# 🔍 Auditoría completa: VendeT.online — errores y cosas por resolver

**Fecha:** 31 de julio de 2026 · **Alcance:** repositorio completo + sitio en producción (vendet.online)
**Método:** revisión de código (seguridad, auth, datos, i18n, PWA, SEO, rendimiento), prueba de conceptos en vivo, reportes Lighthouse del repo, y verificación de tasas oficiales BCV.

---

## 0. Resumen ejecutivo

| Gravedad | Cantidad | Lo más importante |
|---|---|---|
| 🔴 **Crítico** (dinero/seguridad) | 5 | Cualquiera puede auto-regalarse créditos, auto-verificarse y moderar; la moderación bloquea anuncios legítimos; precios en Bs. con 35% de error |
| 🟠 **Alto** | 8 | Suplantación en el chat, páginas de test en producción, i18n rota en inglés, caché PWA de datos privados |
| 🟡 **Medio** | 10 | Sin headers de seguridad, hreflang incorrecto, manifest roto, JWT sin verificar en servidor |
| ⚪ **Bajo / higiene** | 9 | Restos de debugging, archivos basura en el repo, strings raros |

**Lo que está bien:** RLS en la base de datos (bien configurado), validación de inputs server-side decente (`validation.ts`), rate-limit existe (aunque poco aplicado), Lighthouse SEO 100 / Best Practices 100, sin secretos en el repo, moderación y anti-spam por palabras bien intencionadas.

**Hallazgo más grave, en una frase:** *el panel de administración solo protege la interfaz, no el backend* — cualquier persona puede llamar directamente a `/api/admin/*` o al RPC `aprobar_transaccion` y darse créditos gratis o aprobarse su propia compra, porque **ninguna ruta verifica la sesión del servidor**.

---

## 1. 🔴 Hallazgos CRÍTICOS

### C1. Las 12 rutas `/api/admin/*` NO verifican autenticación ni rol en el servidor
**Archivos:** `src/app/api/admin/*/route.ts` (todas: add-creditos, toggle-verificado, toggle-activo, toggle-destacado, boost-producto, eliminar-producto, marcar-vendido, moderar-producto, enviar-resena, verificar, verificar-venta, perfiles-ids, auditoria/*)

**Evidencia:** las rutas crean un cliente Supabase con `SUPABASE_SERVICE_ROLE_KEY` y ejecutan la acción directamente. `add-creditos` acepta `{userId, cantidad}` de cualquier persona y suma créditos sin verificar nada. `moderar-producto` "protege" comparando un `adminEmail` **que viene del body de la petición** contra `ADMIN_EMAILS` — y ese email (`gtrespana@gmail.com`) está **hardcodeado en el bundle JavaScript del navegador** (`src/lib/admin-config.ts` es importado por la página admin, que es un componente cliente). `eliminar-producto` se salta toda la autorización si no envías `userId` (`if (userId && ...)`).

**Impacto:** cualquier persona puede, sin cuenta:
- Regalarse créditos ilimitados (`POST /api/admin/add-creditos` con su propio UUID) → **la monetización deja de existir**.
- Verificarse a sí misma como vendedor verificado.
- Aprobar/rechazar anuncios, eliminarlos, marcarlos como vendidos, boostearlos.
- Enviar reseñas falsas, consultar perfiles por lotes (`perfiles-ids`).

**Solución:** crear un middleware/función `requireAdmin()` que verifique la sesión real del usuario (cookie de Supabase → `getUser()`) y compare su email contra `ADMIN_EMAILS`, y aplicarla a las 12 rutas. Además: mover `ADMIN_EMAILS` a variable de entorno (`ADMIN_EMAILS` en `.env`, leer en servidor) y dejar de exportarlo a componentes cliente.

### C2. RPC `aprobar_transaccion` aprobable por cualquier usuario autenticado
**Archivo:** `supabase/migrations/004_creditos.sql` (línea 226)

**Evidencia:** función `security definer` que marca `estado = 'aprobado'` y añade créditos, ejecutable por `authenticated` (`grant execute ... to authenticated`), sin verificar que `p_admin_id` sea admin. `p_admin_id` ni siquiera se valida dentro de la función.

**Impacto:** cualquier usuario logueado puede:
1. Crear una compra de créditos falsa (`POST /api/comprar-creditos` con `creditos: 99999` — el monto tampoco se valida contra paquetes reales).
2. Llamar `supabase.rpc('aprobar_transaccion', { p_transaccion_id, p_admin_id: su_id })` → **créditos gratis al instante**.

**Solución:** dentro de la función, comparar `auth.jwt()` / consultar `perfiles` del `auth.uid()` contra la lista de admins y rechazar si no es admin; o eliminar el RPC y hacer la aprobación solo desde una API route protegida (ver C1).

### C3. RPCs `usar_boost` / `usar_destacado` confían en un `p_user_id` del cliente
**Archivo:** `supabase/migrations/004_creditos.sql` (líneas 130 y 172)

**Evidencia:** verifican que `p_user_id` sea dueño del producto, pero **no verifican `auth.uid() = p_user_id`**. El caller decide qué `user_id` pasar.

**Impacto:** un atacante que conozca el UUID de un vendedor (los UUIDs se exponen en `vendedor/[id]`, mensajes, etc.) puede llamar `usar_boost(producto_id, user_id_de_la_victima)` y **drenar los créditos de la víctima** repetidamente (no hay rate limit en RPC).

**Solución:** en ambas funciones usar `auth.uid()` en lugar de (o además de) el parámetro: `if auth.uid() is null or auth.uid() != p_user_id then return error`.

### C4. Moderación automática con falsos positivos: bloquea anuncios 100% legítimos
**Archivo:** `src/lib/moderacion.ts`

**Evidencia:** el matcheo es por **substring** (`textoNormalizado.includes(palabra)`). La lista prohibida incluye `'put'`, `'bala'`, `'pistola'`, etc. Resultado verificado matemáticamente:

| Anuncio legítimo | Palabra que lo activa | Resultado |
|---|---|---|
| "Computadora portátil HP" | `put` (com-pu-ta-do-ra) | 🚫 PROHIBIDO |
| "Reputación de vendedor" | `put` | 🚫 PROHIBIDO |
| "Balanza de cocina digital" | `bala` | 🚫 PROHIBIDO |
| "Pistola de calor / de silicona / de pintura" | `pistola` | 🚫 PROHIBIDO |
| "Punto de venta" | `put` | 🚫 PROHIBIDO |

**Impacto:** anuncios de las categorías más vendidas (tecnología, herramientas) son rechazados automáticamente. Es probable que esto ya esté pasando en producción (los títulos visibles en el home evitan estas palabras).

**Solución:** matchear por **palabra completa** (límites de palabra con regex: `\b` o split por espacios/puntuación), y revisar la lista quitando substrings peligrosos (`put`, `bala`, `pistola` → reemplazar por expresiones más específicas: "arma de fuego", "pistola 9mm", "venta de pistola", etc.).

### C5. Tasa BCV de respaldo desactualizada: precios en Bs. con ~35% de error
**Archivos:** `src/lib/tasaBCV.ts` (`FALLBACK_RATE = 487`), `src/app/[locale]/creditos/page.tsx` (`FALLBACK_TASA = 487.12`), `src/app/[locale]/dashboard/components/tabs/TabCreditos.tsx` (`487.12`)

**Evidencia:** la tasa oficial BCV al 30-jul-2026 es **≈745,6 Bs/USD** (Finanzas Digital, Aporrea, Caracol). El fallback de 487 queda ~35% por debajo. Cada vez que la API `ve.dolarapi.com` falla (frecuente con conectividad inestable), **todos los precios en bolívares se muestran 35% más baratos de lo real**.

**Impacto:** compradores que ven precios en Bs. incorrectos, desconfianza, y decisiones de compra erróneas. En una economía con inflación como la venezolana, una constante hardcodeada caduca en semanas.

**Solución:** actualizar el fallback (o mejor), eliminarlo y mostrar "consulta la tasa" si la API no responde; o guardar la última tasa conocida en una tabla/edge function que se actualice con un cron.

---

## 2. 🟠 Hallazgos ALTOS

### A1. `enviar-mensaje` permite suplantar a cualquier usuario en el chat
**Archivo:** `src/app/api/enviar-mensaje/route.ts`

**Evidencia:** `remitente_id` y `destinatario_id` vienen del body y se insertan con `service_role`. El único "check" es `if (!remitente_id) 401`. No se verifica que `remitente_id` sea el usuario de la sesión.

**Impacto:** cualquiera puede enviar mensajes haciéndose pasar por otro usuario (estafas: "soy el vendedor, págame a esta cuenta") o inundar el inbox de cualquier víctima.

**Solución:** derivar `remitente_id` de la sesión en el servidor (`supabase.auth.getUser()` con cookies), nunca del body.

### A2. `foto-perfil` sobrescribe el avatar de cualquier usuario
**Archivo:** `src/app/api/foto-perfil/route.ts` — `userId` viene del body; se sube y se actualiza `perfiles.foto_perfil_url` con `service_role` sin verificar sesión.

**Impacto:** cualquiera puede cambiar el avatar de cualquier usuario (acoso, suplantación visual).

**Solución:** usar el `auth.uid()` de la sesión como userId.

### A3. `r2-upload` sin autenticación, sin validación de tipo/tamaño/ruta
**Archivo:** `src/app/api/r2-upload/route.ts` — acepta cualquier `key` y `contentType` y devuelve una URL firmada de subida.

**Impacto:** cualquiera puede (a) llenar el bucket R2 con archivos enormes → **factura de Cloudflare a tu nombre**; (b) sobrescribir imágenes de productos ajenos si adivina la key (formato predecible `userId/timestamp_index.jpg`); (c) subir SVG/HTML → riesgo de XSS almacenado, agravado por `dangerouslyAllowSVG: true` en `next.config.js` y ausencia de CSP.

**Solución:** exigir sesión, validar `key` (que empiece por `{userId}/`), whitelist de content types (`image/jpeg/png/webp`), y límite de tamaño (firmar con `content-length-range` en la policy del presigned URL).

### A4. Rate limiting definido pero aplicado solo en 5 de 40 rutas
**Archivo:** `src/lib/rate-limit.ts` vs. uso real (solo login, publicar, enviar-mensaje, contacto, comprar-creditos).

**Sin protección efectiva:** registro de usuarios (`auth:register` definido pero jamás llamado → spam de cuentas sin límite), denuncias, favoritos, foto-perfil, r2-upload, tasa-bcv, reset-password, crear-conversación.

**Impacto:** abuso del registro (bases de datos llenas de bots), spam de denuncias, etc.

### A5. La tabla `rate_limit` crece para siempre
**Evidencia:** `cleanOldRateLimits()` existe pero **nadie la llama** (grep: 0 usos). Cada request limitado inserta una fila → la tabla crece indefinidamente y las consultas de conteo se vuelven lentas.

**Solución:** Vercel Cron (`vercel.json`) llamando `cleanOldRateLimits()` diariamente, o particionar por día.

### A6. Páginas y APIs de test desplegadas en producción
**Verificado en vivo (200 OK):** `/test-minimal` ("Minimal page for Lighthouse testing"), `/test-catalog`, `/test-product`, `/test-layout-only`, `/test-supabase`. APIs: `/api/debug-profiles-diag` (expone información de config, prefijo de la service key y datos de perfiles), `/api/email-test` (permite enviar emails arbitrarios).

**Impacto:** ruido SEO (páginas indexables sin contenido), fuga de información de infraestructura, vector de abuso del SMTP (spam desde tu dominio).

**Solución:** borrar esas rutas (o envolverlas en `if (process.env.NODE_ENV === 'development')`).

### A7. El Service Worker cachea páginas autenticadas (dashboard, chat, admin)
**Archivo:** `public/sw.js` — para toda petición `navigate` hace `cache.put(request, response)` sin distinguir URLs privadas.

**Impacto:** el dashboard de un usuario (datos personales, teléfono, mensajes) queda guardado en el caché del navegador; en modo offline o con red lenta se sirve contenido privado, y un segundo usuario del mismo dispositivo podría verlo. Además infla el caché (cada URL con query genera una entrada).

**Solución:** excluir `/dashboard`, `/chat`, `/admin`, `/mi-perfil`, `/creditos`, `/api/*` del cache de navegación; limitar el número de entradas de HTML cacheadas.

### A8. La versión en inglés está a medias y muestra precios contradictorios
**Verificado en vivo** (`/en`):
- Precios distintos entre locales: español "Destacado 24h = 6 créditos / $2 USD" vs. inglés "Featured 24h = **$3**, $2 USD per day"; "Featured 48h = $5 vs $4". El Boost: "1 crédito" (es) vs "$1" (en).
- Tarjetas de producto sin traducir: "Como nuevo · San Diego", "Nuevo · Vargas" en `/en`.
- Título de la página en español en `/en`: "Clasificados Venezuela | VendeT.online...".
- Texto residual: "Cheapest way to get seen **ya**".

**Impacto:** confusión y desconfianza del usuario angloparlante; riesgo legal/publicitario por precios inconsistentes entre idiomas.

**Solución:** completar las traducciones (los diccionarios existen, pero las tarjetas de producto y las páginas grandes no los usan) y centralizar los precios en una única fuente de datos para ambos idiomas.

---

## 3. 🟡 Hallazgos MEDIOS

| # | Hallazgo | Archivo(s) | Detalle / solución |
|---|---|---|---|
| M1 | **Sin security headers** | `next.config.js` | No hay CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy ni HSTS (verificado también en vivo: ausentes). Añadir `headers()` en next.config: CSP restrictivo, `frame-ancestors 'none'`, etc. |
| M2 | **hreflang incorrecto** | `src/app/[locale]/layout.tsx` | `alternates.languages` emite `'es-VE': 'https://vendet.online/${locale}'` → la página `/en` declara es-VE apuntando a sí misma. Debe emitir es-VE→`/`, en→`/en` y `x-default`. |
| M3 | **Manifest/PWA roto** | `public/manifest.json`, `public/sw.js` | Iconos `.webp` declarados como `"type": "image/png"` (los navegadores pueden rechazar el manifest → falla el prompt de instalación); las notificaciones push usan `/icon-192.png` que **no existe** (solo hay .webp) → icono roto en notificaciones. |
| M4 | **JWT sin verificar en el servidor** | `src/lib/supabase-server.ts` | `getServerUser()` parsea la cookie `sb-*-auth-token` como JSON sin verificar firma ni expiración. Hoy solo alimenta el layout (riesgo bajo), pero es un polvorín si alguien lo usa para autorizar. Usar `supabase.auth.getUser()` (con refresh) o verificar el JWT. |
| M5 | **`marcar-vendido` con userId del body** | `src/app/api/admin/marcar-vendido/route.ts` | Compara `producto.user_id !== userId` donde `userId` viene del request: cualquiera puede marcar vendido cualquier producto pasando el userId del dueño. (Agravado por C1.) |
| M6 | **`comprar-creditos` sin autenticación ni validación de paquete** | `src/app/api/comprar-creditos/route.ts` | Acepta `{userId, creditos, precioUsd, metodoPago, comprobanteUrl}` sin sesión; `creditos` puede ser 999999 y `comprobanteUrl` arbitrario. Permite spamear el Telegram del admin con compras falsas (y combinado con C2, créditos gratis). |
| M7 | **Accesibilidad 89/100** | Reportes Lighthouse del repo | Fallos: botones sin nombre accesible (`button-name`), contraste insuficiente (`color-contrast`), CLS (layout shifts), TTI 19s en mobile. Corregir los botones-icono (aria-label) y contraste es barato y mejora SEO/UX. |
| M8 | **Título duplicado y SEO residual** | Home | "…VendeT.online - Compra y Venta en Venezuela | VendeT" (VendeT repetido al final). El título de `/en` está en español. |
| M9 | **console.log en rutas de producción** | `contacto`, `push-subscribe`, `server-email`, etc. | `removeConsole` solo aplica al bundle cliente; los logs del servidor se imprimen en cada invocación (ruido + posible fuga de datos de configuración en logs). |
| M10 | **Tokens de sesión en el body del login** | `src/app/api/login/route.ts` | Devuelve `access_token` y `refresh_token` en el JSON de respuesta (además de cookies). Preferible no exponerlos en el body; solo cookies HttpOnly. |

---

## 4. ⚪ Hallazgos BAJOS / higiene

1. **`CACHE_NAME = 'vendet-v3-ga4'`** (`public/sw.js`) — sufijo 'ga4' sobrante de experimentos; confunde el versionado del caché.
2. **Archivos de trabajo commiteados en el repo:** `lh-*.html` y `lh-*.json` (2,5 MB), `batch_*.txt`, `generate-batches.sh`, `test-pure-static.html` — ensucian el repo y el `gitignore` no los cubre todos (`lh-*.json` está ignorado pero igual fue commiteado).
3. **Robots duplicado y patrón inútil:** `public/robots.txt` queda anulado por `src/app/robots.ts` (el vivo lo confirma); en `[locale]/robots.ts` el patrón `'/(auth)/'` no matchea ninguna ruta real (las rutas son `/es/login`, no `/(auth)/`).
4. **Sitemap sin entradas de blog** y `lastModified: new Date()` en cada request (genera fechas falsas de "hoy" en todo el sitemap).
5. **Sentry en estado mixto:** el plugin está comentado en `next.config.js` ("deshabilitado para Lighthouse") pero `instrumentation.ts` inicializa Sentry en runtime. Verificar qué está pasando realmente en producción.
6. **`/offline` sin locale en el SW:** el precache de `/offline` depende de un redirect; el usuario en `/en` recibiría la página offline en español.
7. **confirm-email redirige sin locale:** `/api/confirm-email` redirige a `/confirmacion` (sin `/es` ni `/en`); funciona por el redirect del middleware pero es frágil.
8. **Página admin depende de `user?.email` del cliente** para ocultar UI (`ADMIN_EMAILS.includes`): cualquier usuario puede ver el HTML/JS del panel aunque no lo use; inútil como barrera (la barrera real debe ser C1).
9. **Cifras estáticas en el home** ("+130 productos", "+5K usuarios") — se desactualizan y pueden convertirse en una promesa falsa.

---

## 5. Lo que está bien (no tocar)

- ✅ **RLS en Postgres** con políticas por tabla bien pensadas (perfiles, productos, mensajes, favoritos).
- ✅ **Validación de inputs** en `src/lib/validation.ts` (sanitización, UUIDs, emails, precios, longitudes).
- ✅ **No hay secretos commiteados**; `.env*` en `.gitignore`; service key solo en servidor.
- ✅ **SEO técnico fuerte:** sitemap dinámico, landings por ciudad×categoría, Open Graph generado por imagen, structured data (JSON-LD).
- ✅ **Rendimiento:** Lighthouse Perf 79–90, Best Practices 100, lazy-loading de imágenes, tabs del dashboard y galerías; estrategias de caché del SW.
- ✅ **Moderación dual** (automática + manual con alertas Telegram) — el concepto es bueno, solo hay que arreglar el matcheo (C4).
- ✅ **Código comentado y documentado** (PROJECT.md, docs/), flujo de reseñas bien pensado.

---

## 6. Plan de acción priorizado

| Fase | Qué | Esfuerzo estimado |
|---|---|---|
| **1. Seguridad crítica (hoy)** | C1 (auth en 12 rutas admin + `requireAdmin`), C2 (`aprobar_transaccion`), C3 (`auth.uid()` en boost/destacado), A1 (remitente desde sesión), A2 (avatar desde sesión), A3 (validar r2-upload) | 1–2 días |
| **2. Dinero y datos** | C5 (tasa BCV actualizada), M6 (validar paquete y sesión en comprar-creditos), M5 (marcar-vendido con sesión) | ½ día |
| **3. Moderación** | C4 (match por palabra completa + revisar lista) + tests unitarios del filtro | ½ día |
| **4. Producción limpia** | A6 (borrar test pages y APIs debug), A4 (aplicar rate limits restantes), A5 (cron de limpieza) | ½–1 día |
| **5. PWA** | A7 (no cachear rutas privadas), M3 (manifest e iconos correctos) | ½ día |
| **6. i18n y SEO** | A8 (completar traducciones y unificar precios), M2 (hreflang), M8 (título), sitemap blog | 2–3 días |
| **7. Endurecimiento** | M1 (security headers), M4 (getUser real), M7 (a11y), M9–M10 | 2–3 días |

**Estimación total del plan de corrección: 7–11 días-hombre** si lo hace alguien que ya conoce el código (o 1,5–2,5 semanas con QA).

---

## 7. Nota final

La prioridad absoluta es la **fase 1**: hoy mismo, cualquier persona puede llamar a `POST /api/admin/add-creditos` y regalarse créditos, o aprobarse su propia compra con `aprobar_transaccion`. La buena noticia es que el resto de la arquitectura (RLS, validación, estructura) es sólida, y todos los hallazgos críticos se corrigen en **menos de 2 días de trabajo**.
