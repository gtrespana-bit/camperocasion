# 🔍 Segundo análisis a fondo — VendeT.online (2026-07-31)

**Alcance:** verificación hallazgo por hallazgo de la auditoría anterior (`analisis-completo-errores.md`), más búsqueda de problemas nuevos en todo el código (seguridad, API routes, rendimiento, PWA, SEO, higiene del repo).

**Método:** revisión de código de las 27 rutas `/api/*`, migraciones SQL (RLS y RPCs), componentes cliente principales, configuración Next.js, y validación con `tsc`, ESLint y 53 tests.

---

## 0. Resumen ejecutivo

| Gravedad | Encontrados | Corregidos en este pase | Pendientes |
|---|---|---|---|
| 🔴 Crítico | 1 | 1 | 0 |
| 🟠 Alto | 3 | 3 | 0 |
| 🟡 Medio | 5 | 1 | 4 |
| ⚪ Bajo / higiene | 10 | 6 | 4 |

**Lo más importante:** la auditoría anterior (fase 1 de seguridad, bloques A–D) **sí se aplicó**: las 12 rutas `/api/admin/*` ahora usan `requireAdmin` con sesión verificada, los RPCs de créditos validan `auth.uid()`, la moderación matchea palabras completas, la tasa BCV de respaldo está actualizada (746), el SW no cachea rutas privadas, el manifest tiene iconos PNG válidos y hay security headers + CSP.

**Pero quedaban 6 rutas API con `service_role` y CERO verificación de sesión** — entre ellas la más importante de la app: `/api/publicar`. Ese agujero se cerró en este pase (ver sección 3).

---

## 1. ✅ Auditoría anterior — verificado y resuelto

| Hallazgo previo | Estado actual | Evidencia |
|---|---|---|
| C1. Rutas admin sin auth | ✅ Resuelto | `requireAdmin()` en las 12 rutas (`src/lib/require-auth.ts` verifica JWT con `getUser()` + email contra env) |
| C2. `aprobar_transaccion` | ✅ Resuelto | `023_fix_seguridad.sql`: valida `auth.uid()` contra admins; revocado de `anon` |
| C3. `usar_boost`/`usar_destacado` | ✅ Resuelto | Exigen `auth.uid() = p_user_id`; revocados de `anon` |
| C4. Moderación por substring | ✅ Resuelto | `contieneTerminoCompleto()` con límites de palabra (`\p{L}\p{N}`) |
| C5. Tasa BCV 487 desactualizada | ✅ Resuelto | `FALLBACK_BCV_RATE = 746`, fuente única en `tasaBCV.ts` |
| A1. `enviar-mensaje` suplantable | ✅ Resuelto | `remitente_id` sale de `requireUser`, nunca del body |
| A2. `foto-perfil` avatar ajeno | ✅ Resuelto | `userId` sale de la sesión |
| A3. `r2-upload` sin control | ✅ Resuelto | `requireUser` + key `{userId}/...` + whitelist de content types |
| A4. Rate limits sin aplicar | ✅ Resuelto | Aplicados en 15 rutas |
| A5. Tabla `rate_limit` infinita | ✅ Resuelto | Cron diario en `vercel.json` + `cleanOldRateLimits()` |
| A6. Páginas/APIs de test | ✅ Resuelto | Ya no existen rutas `/test-*` ni `/api/debug-*` (solo quedaba `test-pure-static.html` en public — eliminado en este pase) |
| A7. SW cacheaba rutas privadas | ✅ Resuelto | `isPrivatePathPrecise()` + API routes network-only |
| M1. Sin security headers | ✅ Resuelto | CSP, HSTS, X-Frame-Options, etc. en `next.config.js` |
| M2. hreflang incorrecto | ✅ Resuelto | `[locale]/layout.tsx` emite lenguajes por locale |
| M3. Manifest/PWA roto | ✅ Resuelto | Iconos PNG reales + tipos correctos |
| M4. JWT sin verificar | ✅ Resuelto | `getServerUser()` usa `supabase.auth.getUser()` |
| M5. `marcar-vendido` userId del body | ✅ Resuelto | Compara contra sesión real (`sessionUserId`) |
| M6. `comprar-creditos` sin validación | ✅ Resuelto | Sesión obligatoria + paquetes allowlist + precio derivado en servidor |
| M9. console.log en servidor | ✅ Resuelto | Solo quedan `console.error/warn/info` legítimos |
| M10. Tokens en body del login | 🟡 **Parcial** | Siguen devolviéndose `access_token`/`refresh_token` en el JSON de login (además de cookies) |

---

## 2. 🔴 Hallazgos NUEVOS (corregidos en este pase)

### N1. `/api/publicar` permitía publicar como cualquier usuario — CRÍTICO
**Archivo:** `src/app/api/publicar/route.ts`

**Problema:** el `userId` venía del **body de la petición** y la ruta insertaba con `service_role` (bypass RLS). No había verificación de sesión. Un atacante podía:
- Publicar spam/anuncios ilegales **bajo la identidad de cualquier vendedor** (solo necesita un UUID, que se exponen en URLs públicas).
- Evadir el rate limit de 20/h cambiando el `userId` en cada request.

**Fix aplicado:** `requireUser()` — el `user_id` ahora sale de la sesión verificada con Supabase. El body del cliente se ignora para ese campo. Compatible con el frontend (que ya enviaba su propio `user.id`).

### N2. `/api/push/send` permitía enviar push a cualquier usuario — ALTO
**Archivo:** `src/app/api/push/send/route.ts`

**Problema:** sin autenticación; solo rate limit por IP (20/h). Cualquiera podía enviar notificaciones push a **cualquier usuario** con textos arbitrarios → phishing disfrazado de VendeT ("Tu anuncio fue suspendido, haz clic aquí…").

**Fix aplicado:** `requireAdmin()`.

### N3. `/api/moderacion-alerta` permitía spamear el Telegram del admin — ALTO
**Archivo:** `src/app/api/moderacion-alerta/route.ts`

**Problema:** sin autenticación ni rate limit. Cualquiera podía inundar el canal de Telegram del admin y el push del admin con alertas falsas (DoS del sistema de moderación humano).

**Fix aplicado:** `requireUser()` + rate limit `notificacion:send`.

### N4. `/api/mensajes-leidos` sin auth — MEDIO
**Archivo:** `src/app/api/mensajes-leidos/route.ts`

**Problema:** `destinatario_id` venía del body con `service_role`: cualquier persona podía marcar como leídos mensajes ajenos y consultar el `count` de no-leídos de cualquier conversación (enumeración).

**Fix aplicado:** `requireUser()`; `destinatario_id` = sesión.

### N5. `/api/chat/review-status` sin auth — MEDIO
**Archivo:** `src/app/api/chat/review-status/route.ts`

**Problema:** `convId` + `userId` del body con `service_role`: permitía mapear conversaciones→productos→dueños sin sesión.

**Fix aplicado:** `requireUser()`; `userId` = sesión.

### N6. `/api/user-bulk` sin auth — MEDIO-BAJO
**Archivo:** `src/app/api/user-bulk/route.ts`

**Problema:** devolvía `nombre` y `foto_perfil_url` de cualquier lote de UUIDs sin sesión (scraping en masa).

**Fix aplicado:** `requireUser()`.

---

## 3. 🟡 Hallazgos MEDIOS (pendientes, requieren decisión/migración)

### P1. El layout raíz anula el ISR: el home se renderiza dinámico en cada visita
**Archivo:** `src/app/layout.tsx`

**Problema:** `RootLayout` usa `await headers()`, `await cookies()` y `getServerUser()` (que también lee cookies). En Next 15/16 eso convierte **toda la app en dynamic rendering por request**, y el `export const revalidate = 120` del home **se ignora silenciosamente**. Cada visita al home = SSR completo + 3 queries a Supabase + 1 `getUser()` → sin caché CDN, TTFB alto en móvil (la auditoría previa ya medía TTI 19s en móvil).

**Solución propuesta (½ día):**
1. El locale ya lo resuelve el middleware (`x-detected-locale` + redirect de next-intl) → el layout puede usar solo `params.locale`, sin `headers()`/`cookies()`.
2. `getServerUser()` del layout: el `AuthProvider` cliente ya resuelve la sesión solo (`getSession()` + `onAuthStateChange`). Eliminar `initialUser` del layout y dejar que el cliente hidrate — el Header ya está preparado (trata al invitado como guest y actualiza al resolver).
3. Resultado: home/catálogo/productos vuelven a ser estáticos con ISR 120s → caché CDN real.

### P2. El registro no tiene rate limit server-side
**Problema:** `supabase.auth.signUp()` se llama directo desde el cliente; la clave `auth:register` existe en `rate-limit.ts` pero **nunca se usa** (no hay ruta `/api/register`). Los bots pueden crear cuentas ilimitadas (spam, abuso del email service).

**Solución propuesta:** crear `POST /api/register` que valide + rate-limit por IP antes de llamar a `signUp`, o usar un captcha. (~2-4 h)

### P3. El RPC `obtener_detalle_producto` expone el teléfono del vendedor sin respetar `telefono_visible`
**Archivo:** `supabase/migrations/20250627_obtener_detalle_producto.sql` (grant a `anon`)

**Problema:** el RPC devuelve `telefono` y `email_visible` del perfil **siempre**, sin filtrar por `telefono_visible`. La UI respeta el flag, pero cualquier scraper puede llamar al RPC directamente y obtener el teléfono de todos los vendedores. Además `p_user_id` no se valida contra `auth.uid()` (fuga trivial del flag `esFavorito` de otros).

**Solución propuesta:** en el SQL, devolver `telefono` solo si `telefono_visible = true`; usar `auth.uid()` en vez de `p_user_id`. (~1 h + aplicar migración)

### P4. Incremento de visitas con condición de carrera
**Archivo:** `src/app/[locale]/producto/[slug]/ProductoPageClient.tsx` (línea ~100)

**Problema:** `update({ visitas: (producto.visitas || 0) + 1 })` lee el valor en el cliente y lo escribe — dos visitas simultáneas pierden conteo. Además cualquier usuario puede inflar visitas llamando el update (la RLS lo permite al dueño, pero un visitante puede… en realidad la RLS debería bloquearlo; el update se hace con el cliente anónimo → si RLS lo bloquea, el `then()` silencioso lo esconde).

**Solución propuesta:** RPC `incrementar_visitas(p_producto_id)` con `UPDATE productos SET visitas = visitas + 1` (atómico) y ejecutarlo con el cliente anónimo. (~1 h + migración)

---

## 4. ⚪ Hallazgos BAJOS (higiene, corregidos en este pase)

| # | Hallazgo | Acción |
|---|---|---|
| B1 | `npm run lint` roto (`next lint` no existe en Next 16) | ✅ Cambiado a `eslint .` |
| B2 | 22 archivos de trabajo commiteados (`batch_*.txt`, `vendet_urls_*.txt`, `create-batches.py`, `generate-*.sh`, `convert-to-webp.ps1`) | ✅ `git rm` |
| B3 | `public/test-pure-static.html` (página de test servida en producción) | ✅ Eliminado |
| B4 | `public/sw-register.js` — código muerto (nadie lo referencia; el registro real lo hace `ServiceWorkerRegistration.tsx`) | ✅ Eliminado |
| B5 | `isValidMetodoPago()` aceptaba subcadenas (`"transferenciafalsa"` pasaba por `includes`) | ✅ Normalización exacta (`pagomovil`, `binancepay`, `transferencia`) + tests |

---

## 5. ⚪ Hallazgos BAJOS (pendientes, sin urgencia)

| # | Hallazgo | Detalle |
|---|---|---|
| B6 | `robots.txt` duplicado | `public/robots.txt` (raíz) + `[locale]/robots.ts` (genera `/es/robots.txt`, `/en/robots.txt`). El patrón `'/(auth)/'` del generado no matchea rutas reales (`/es/login`). Unificar en `src/app/robots.ts` raíz. |
| B7 | Sitemap con fechas falsas | `lastModified: new Date()` en páginas estáticas → Google ve "hoy" en cada build. Usar fechas fijas o el último deploy. |
| B8 | `ADMIN_EMAILS` hardcodeado y visible en bundle cliente | `src/lib/admin-config.ts` exporta el email del admin al navegador. No es una barrera (las rutas API ya usan env), pero la página admin debería redirigir en servidor si no eres admin, en vez de solo ocultar la UI. |
| B9 | Login devuelve tokens en el body | `access_token`/`refresh_token` en el JSON de respuesta además de cookies HttpOnly. Preferible solo cookies (los tokens quedan en memoria JS y en logs/proxies). |

---

## 6. Lo que está bien (verificado, no tocar)

- ✅ RLS por tabla (perfiles, productos, mensajes, favoritos, storage con carpeta por usuario)
- ✅ `require-auth.ts` usa `getUser()` (JWT verificado) y lee cookies del request — patrón correcto
- ✅ 15 rutas con rate limit y la tabla se limpia con cron
- ✅ i18n completa: 936 claves es = 936 claves en, ninguna faltante
- ✅ Moderación con límites de palabra (sin falsos positivos de `put`/`bala`)
- ✅ Paquetes de créditos con fuente única en servidor; precio nunca viene del cliente
- ✅ Security headers con CSP progresiva
- ✅ Tests unitarios: 53 pasando; `tsc` y ESLint limpios

---

## 7. Plan de acción recomendado

| Prioridad | Qué | Esfuerzo |
|---|---|---|
| **1** | ✅ ~~Cerrar las 6 rutas API sin auth~~ (hecho en este pase) | — |
| **2** | P1: layout estático + ISR real (home con caché CDN) | ½ día |
| **3** | P3: RPC detalle producto — respetar `telefono_visible` + `auth.uid()` | 1 h + migración |
| **4** | P2: rate limit en registro | 2–4 h |
| **5** | P4: RPC incremento de visitas atómico | 1 h + migración |
| **6** | B6–B9: robots unificado, sitemap fechas, admin redirect server-side, login sin tokens en body | ½ día |

**Estimación total pendiente: 1,5–2 días** (la mayor parte es P1).
