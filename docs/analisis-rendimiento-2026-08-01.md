# 🔍 Análisis de rendimiento — 1 de agosto de 2026

> Alcance: problema de rendimiento en TODA la página tras cambios de las últimas 24 h.
> Solicitud: verificar si Google Analytics (GA4) es el causante y analizar el resto de errores.

---

## 1. Veredicto sobre Google Analytics

**Se ha eliminado de todo el sitio** (commit `648e159`).

### Qué era y cómo funcionaba
- `src/components/GoogleAnalytics.tsx` cargaba `gtag.js` (Google Analytics 4) con
  `next/script` en modo `afterInteractive`, **solo** si la variable de entorno
  `NEXT_PUBLIC_GA_ID` (formato `G-XXXXXXXXXX`) estaba definida en Vercel.
- Estaba montado en el **layout raíz**, por lo que se cargaba en **todas** las páginas.
- Era redundante con **Vercel Analytics** y **SpeedInsights**, que también estaban activos.

### ¿Es GA la causa del problema de rendimiento?
**Probablemente no es la causa raíz de un fallo "grave" en toda la página**, por dos razones:

1. `afterInteractive` **no bloquea** el primer render ni el TTI: el script se descarga después de que la página se vuelve interactiva.
2. Es un script pequeño de terceros.

**Pero sí es un candidato razonable para quitar**, y por eso se retiró:
- Es un request de terceros adicional (googletagmanager.com) en **cada** página; en las redes móviles inestables de Venezuela cualquier petición extra a un dominio ajeno penaliza.
- No lo necesitas para el SEO: la verificación en **Google Search Console ya estaba hecha por DNS** (eso es distinto de GA4). GSC funciona con la meta `GOOGLE_SITE_VERIFICATION`, que sigue en el layout.
- Redunda con Vercel Analytics + SpeedInsights.
- Puede explicar la sensación de "muchas notificaciones/hits de Google Analytics": cada carga dispara `gtag('config')` y eventos de pageview, y si además había eventos duplicados entre GA4 y Vercel Analytics, el ruido se multiplicaba.
- Es 100% reversible: si se quiere re-activar, se re-añade el componente y las entradas GA del CSP.

**Advertencia honesta:** si el problema persiste tras quitar GA, la causa raíz está en otro sitio (ver §2). Lo que sigue es lo que sí puede estar afectando a toda la página.

---

## 2. Causa raíz más probable (algo genérico que toca TODAS las páginas)

### 🥇 Service Worker: intercepción de navegaciones con timeouts largos
`public/sw.js` (versión **v10**) intercepta **todas las navegaciones** HTML y las pasa por
`fetchWithRetry(request, 1, 15000)`:

- Cada intento tiene un **timeout de 15 segundos** y hay **1 reintento** con backoff de 600 ms.
- En una red inestable (blips constantes de móvil en Venezuela), **cada página** puede quedarse
  "colgada" varios segundos antes de que el fallback (`caché → offline → HTML inline`) se active.
- Además cachea las navegaciones públicas en `vendet-v10`, y el `fetch` con `clone()` de cada
  página suma trabajo extra en el hilo del SW.

Esto es **global** y encaja con "el problema es en toda la página". No está confirmado que sea
nuevo de las últimas 24 h (el histórico de git está aplastado a un commit), pero es el candidato
técnico más fuerte.

**Recomendación (próximo paso, requiere tu visto bueno):**
- Bajar los timeouts de navegación a ~4–6 s y quitar el reintento en el primer hit (o hacer
  "network-first" simple sin reintento en navegación).
- No cachear HTML de navegaciones públicas con `clone()` en el hot path (solo en segundo plano).
- `CACHE_NAME` subir a `vendet-v11` para forzar instalación limpia.

### 🥈 Layout raíz: 3 analíticas + varios `dynamic()` en el hot path
- `@vercel/analytics/react` (`<Analytics/>`), `@vercel/speed-insights/next` (`<SpeedInsights/>`),
  y antes GA. Ahora quedan 2, ambas ligeras y propias de Vercel (se mantienen).
- `AuthProvider`, `ServiceWorkerRegistration` se cargan con `next/dynamic` en el layout: cada uno
  añade un chunk asíncrono que retrasa la hidratación/TTI. Es menor, pero acumula.

**Recomendación:** mantener Vercel Analytics + SpeedInsights (son ligeros y propios); si quieres
máxima limpieza podrías marcar SpeedInsights solo en `production` o cargarlo con `manual`/`afterInteractive`.

---

## 3. Otros errores y problemas detectados (análisis)

### Rendimiento
- **`fetchWithRetry` con timeouts de 10–15 s** también se aplica a `/api/*` y assets: en redes lentas
  añade latencia. Considerar timeouts más cortos y no reintentar peticiones de datos críticos.
- **Home page** (`src/app/[locale]/page.tsx`) importa el cliente Supabase de navegador
  (`@/lib/supabase`, con `persistSession/autoRefreshToken`) dentro de un Server Component: en cada
  build/ISR se instancia un GoTrueClient de más. Mejor usar un cliente de servidor ligero para RPC
  en SSR. El resto de la página ya usa ISR (`revalidate = 120`) — bien.
- **`useProductLoader` / `usePrefetch`** en catálogo precargan la página siguiente tras interacción:
  ok, pero verificar que no haya doble fetch con la caché del SW.

### Seguridad (crítico — pendiente, de la auditoría anterior)
- Las **rutas `/api/admin/*`** no verifican sesión/rol en el servidor (cualquiera puede llamarlas con
  la service key y auto-regalarse créditos, auto-verificarse, moderar…). Pendiente de corregir.
- RPC `aprobar_transaccion`, `usar_boost`, `usar_destacado` confían en `p_user_id` del cliente
  (deben validar `auth.uid()`).
- `enviar-mensaje`, `foto-perfil`, `r2-upload`, `marcar-vendido`, `comprar-creditos`: derivan
  `userId`/`remitente_id` del body sin validar la sesión.
- Ver doc `docs/analisis-completo-errores.md` para el detalle completo (12 rutas admin, RLS, etc.).

### Datos
- **Tasa BCV de respaldo desactualizada** (~487 Bs/USD vs ~746 reales): los precios en Bs. pueden
  mostrarse ~35% más baratos cuando la API falla. Urgente actualizar el fallback.
- **Moderación automática por substring** (`put`, `bala`, `pistola`) bloquea anuncios legítimos
  ("Computadora portátil", "Balanza de cocina", "Pistola de calor"…). Corregir a match por palabra.

### Higiene / menores
- `PerformanceMetrics.tsx` y `PerformanceMonitor.tsx` son código muerto (no se usan en ningún layout).
- `next.config.js` declara `@svgr/webpack` en la regla de `.svg` pero **no está en `package.json`**:
  si algún día se importa un `.svg` rompería el build. Añadir a devDeps o quitar la regla.
- Comentarios `// debug` sueltos en `PushNotificationBanner.tsx`.

---

## 4. Qué hice

1. **Eliminé GA4 del código** (componente + uso en layout + endpoints del CSP), manteniendo Vercel
   Analytics y SpeedInsights. → commit `648e159`.
2. Actualicé `docs/seo-fixes-2026-08-01.md` para reflejar el cambio.
3. **Ajusté el Service Worker (v11 → v12):** las navegaciones ya no se cuelgan (0 reintentos,
   timeout 5 s); timeout por defecto de subrecursos 10 s → 6 s; las APIs reintentan solo las no
   críticas (`/api/tasa-bcv`). → commit `4fb9948` (v11) y el commit de v12 de este turno.
4. **Cliente Supabase ligero de servidor** (`src/lib/supabase-server-client.ts`): los Server
   Components de home, catálogo, landings, producto, vendedor, sitemap y opengraph ya no importan
   el cliente de navegador (con `persistSession`/`autoRefreshToken`), sino uno de solo lectura sin
   gestión de sesión — menos overhead de GoTrueClient en build/ISR.
5. **Layout raíz:** `ServiceWorkerRegistration` ahora carga con `ssr: false` (solo cliente, se
   quita su chunk del SSR).

## 5. Acciones recomendadas (por prioridad)

| Prioridad | Acción |
|---|---|
| 🔴 Alta | Quitar o acortar la intercepción/retry del SW en navegaciones (candidato #1 genérico) |
| 🔴 Alta | Corregir seguridad `/api/admin/*` y RPCs de créditos (dinero) |
| 🟠 Media | Actualizar fallback de tasa BCV |
| 🟠 Media | Corregir moderación por substring |
| 🟢 Baja | Limpiar código muerto, regla svgr, comentarios debug |

> **Nota:** el histórico de git está aplastado en un solo commit, así que no fue posible hacer diff
> para confirmar qué cambió exactamente en las últimas 24 h. Si tienes acceso a los PRs/commits de
> ayer, esa línea de tiempo ayudará a confirmar si el cambio del SW entró ayer.
