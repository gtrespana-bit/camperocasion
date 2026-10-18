# Diagnóstico: Google Analytics no recibía ningún dato

**Fecha:** 2026-10-18
**Síntoma:** la propiedad GA4 (`G-14MFBYME0R`) no recibe información de
`camperocasion.online`, aunque la instalación «supuestamente ya está toda
configurada».

## Causa raíz

**El banner de cookies (`src/components/CookieConsent.tsx`) existía pero no
estaba montado en ningún layout.** Sin banner nadie puede pulsar «Aceptar»,
`localStorage['cookie-consent']` nunca vale `'accepted'` y el Consent Mode del
snippet (`src/lib/google-analytics-bootstrap.ts`) mantiene `gtag.js` sin
descargar para todos los visitantes, todo el tiempo. Resultado: **cero hits en
GA4, sin excepción** — no llega ni el propietario de la web.

La cadena de consentimiento es estricta por diseño (guía AEPD: hasta «Aceptar»
no se descarga código de Google ni hay pings), así que el banner es la única
puerta de entrada a la medición. Con él desmontado:

- **Google Analytics 4**: 0 datos.
- **Vercel Analytics y Speed Insights** (`RootClientEffects`): nunca se montan.
- **AnaliticaVisitas** (pestaña «Audiencia» del panel): sin visitas propias.
- El botón «Cambiar mi decisión» de `/politica-de-cookies` no hacía nada
  visible: dispara `CONSENT_REOPEN_EVENT`, pero ningún banner lo escuchaba.

Los tests unitarios del módulo (`cookie-consent.test.ts`, `google-analytics*`)
pasaban porque probaban la lógica y el snippet, no que el banner estuviera
montado. Por eso la regresión pasó desapercibida.

## Qué se comprobó y SÍ estaba bien

| Pieza | Estado |
|---|---|
| Snippet `ga4-bootstrap` en el `<head>` del HTML de producción | ✅ presente (verificado en el HTML servido por `camperocasion.online`) |
| ID de medición servido | ✅ `G-14MFBYME0R` (el de `GA_ID_POR_DEFECTO`; `NEXT_PUBLIC_GA_MEASUREMENT_ID` no está apuntando a otra propiedad ni a `off`) |
| Lógica de Consent Mode y de sincronización con el SPA | ✅ correcta (tests en verde) |
| CSP (`next.config.js`) | ✅ permite `googletagmanager.com`, `google-analytics.com` y `analytics.google.com` en `script-src`/`connect-src` |
| Service Worker (`public/sw.js`) | ✅ no intercepta más que navegaciones propias; no bloquea a Google |
| Middleware / caché | ✅ no toca el snippet |
| Exclusión de `/admin` | ✅ implementada en el snippet y en `GoogleAnalytics.tsx` |
| Idem enlace «Cambiar mi decisión» | ✅ `BotonPreferenciasCookies` + `reiniciarConsentimiento()` correctos |

## Arreglo aplicado

1. **`src/app/layout.tsx`**: `<CookieConsent />` vuelve a montarse en el layout
   raíz (donde su propio doc-comment dice que vive), junto a `<GoogleAnalytics />`
   y `<RootClientEffects />`.
2. **`tests/unit/cookie-consent-banner.test.tsx`** (nuevo): fija el
   comportamiento del banner (aparece sin decisión, aceptar/rechazar persisten
   y retiran el aviso, el evento de reapertura lo re-muestra) y, sobre todo, un
   **guardián de cableado** que comprueba que el layout raíz importa y renderiza
   `CookieConsent`, para que esta regresión no pueda repetirse en silencio.

## Qué esperar tras desplegar el arreglo

- **Tiempo real (GA4)**: debe empezar a registrar visitas en cuanto alguien
  pulse «Aceptar». Sin aceptar no aparecerá nadie — es el diseño, no un fallo.
- **Informes estándar**: latencia típica de GA4 de hasta 24–48 h.
- **Solo se medirá la fracción de visitantes que acepte** las cookies. Con
  opt-in estricto, una tasa de aceptación baja (10–40 % es habitual en España)
  significa que GA4 verá solo esa parte del tráfico. Es el coste legal de no
  medir sin permiso; no hay nada «roto» en ello.

## Pasos de verificación (5 minutos)

1. Abrir `https://camperocasion.online/` en una ventana **sin extensiones**
   (los bloqueadores de anuncios cortan `googletagmanager.com`).
2. Debe aparecer el **aviso de cookies** abajo. Pulsar **«Aceptar»**.
3. *View source* o F12 → Elements: existe el script `ga4-bootstrap` con
   `G-14MFBYME0R`.
4. F12 → Network: tras aceptar debe cargar `gtag/js?id=G-14MFBYME0R` y aparecer
   peticiones a `…/g/collect`.
5. En GA4 → **Informes → Tiempo real**: la visita debe aparecer en segundos.
6. El «comprobador de instalación» de Google puede seguir diciendo que no
   detecta la etiqueta si no interactúa con el banner: con Consent Mode básico
   eso no indica un fallo. **No** instalar un segundo snippet ni un contenedor
   GTM para forzar la detección (duplicaría la medición).

## Comprobaciones en el lado de Google (fuera del código)

- Que la propiedad abierta en el selector de GA4 es la de **`G-14MFBYME0R`**
  (si se creó una propiedad nueva, puede estar mirando esa mientras la web
  mide en la antigua, o viceversa).
- *Administrar → Flujos de datos → Web*: la URL del flujo debe ser
  `camperocasion.online` y la **medición mejorada** debe estar activa (con
  «Cambios de página basados en eventos del historial»), porque la navegación
  SPA no manda `page_view` a mano.
- Tras el despliegue, si llegan datos pero no coinciden con otras fuentes
  (Vercel Analytics), recordar que GA4 solo ve a quien acepta y Vercel Analytics
  también está tras el mismo consentimiento: las dos fuentes deberían coincidir
  en ese recorte.

## Salida futura (decisión de negocio, no aplicada)

Si se quisiera medir también a quien no acepta, la vía estándar es **Consent
Mode v2 con *cookieless pings*** (cargar gtag.js siempre con consentimiento
denegado: Google recibe pings sin cookies y modela el tráfico). Exigiría
actualizar el texto del banner y de la política de cookies (que hoy prometen
que «sin permiso no hay pings de Google»). No se ha tocado: cambiarlo sin
más contradice la política de privacidad publicada y la interpretación
estricta de la AEPD que el proyecto adoptó.
