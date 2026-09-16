# Investigación de la caducidad de Lighthouse — 2 de agosto de 2026

## Conclusión: había un proxy HTTP global dentro del navegador

La causa no era una imagen, GA ni una métrica aislada. `public/sw.js` registraba un
**Service Worker con un listener `fetch` para todo el origen**. Tras la primera
visita controlaba cada solicitud same-origin de cada página:

- documento HTML y navegaciones;
- bundles JavaScript, CSS y fuentes de Next;
- imágenes;
- llamadas a `/api/*`.

Ese worker no se limitaba a dar soporte offline: reemplazaba `fetch` por
`fetchWithRetry`, creaba un `AbortController` y aplicaba timeouts propios (5 s
en navegación, 3.5 s para subrecursos en la versión vigente), caché y fallback.
Por tanto, en la red throttled de Lighthouse el worker podía abortar o mantener
pendiente un chunk esencial antes de que el navegador llegase a Vercel. Como el
scope era `/`, el efecto era necesariamente transversal: **todas las rutas y
todas las auditorías con un perfil que ya hubiese visitado el sitio**.

Reducir los timeouts no resolvía el defecto arquitectónico: seguía existiendo un
proxy adicional en el camino crítico y, peor aún, un timeout corto puede hacer
fallar un bundle lento en vez de permitir que el navegador/CDN lo administre.
La exclusión por `user-agent` tampoco es una garantía: no todos los productos o
perfiles de auditoría exponen una cadena Lighthouse consistente, y un worker
antiguo ya activo continúa controlando la carga hasta ser reemplazado.

## Corrección aplicada

1. No se registra ningún Service Worker nuevo.
2. `public/sw.js` es ahora un *retirement shim* v14, sin listener `fetch`:
   al activarse borra solo caches `vendet-*` y ejecuta
   `self.registration.unregister()`.
3. El cliente desregistra de forma explícita los workers de este origen. Así los
   visitantes que conservaban una versión antigua se limpian sin borrar datos
   manualmente. En la siguiente navegación ya no existe intermediario.
4. Se añadió una prueba de regresión que prohíbe que ese archivo vuelva a
   contener un listener `fetch` o `respondWith`.

Como consecuencia se retiran temporalmente las capacidades offline y push que
dependían de ese worker. Es una decisión intencional: no es aceptable que una
función opcional de PWA pueda impedir que el marketplace cargue o que Lighthouse
termine. Se puede rediseñar un PWA más adelante, aislado y sin interceptar el
camino crítico; no se debe reactivar el worker anterior.

## Validación local realizada

- `npm run build`: compilación, comprobación TypeScript y prerender completan.
  La home y las rutas estáticas quedan prerenderizadas; las rutas de datos
  (catálogo, producto, búsqueda, ciudad) son SSR bajo demanda por diseño.
- `npm test -- --runInBand`: incluye la guarda de no-intercepción del worker.

No fue posible ejecutar una auditoría contra producción desde este entorno: las
conexiones TLS salientes a `vendet.online` y `*.vercel.app` son bloqueadas por
el sandbox. Tras desplegar, la comprobación decisiva es Lighthouse en una sesión
incógnita y en un perfil que haya usado el sitio antes (para verificar la retirada
del worker heredado).

## Qué verificar tras el despliegue

1. Chrome DevTools → **Application → Service Workers**: tras refrescar una vez,
   no debe quedar worker para `vendet.online`.
2. DevTools → Network: no debe aparecer `from ServiceWorker` ni solicitudes
   abortadas a `/_next/static/*` por el worker.
3. Ejecutar Lighthouse móvil tres veces con caché desactivada. Si aún hay una
   caducidad de 30 s entonces ya no puede atribuirse al navegador/PWA: hay que
   medir TTFB de la URL concreta y logs de Vercel/Supabase para localizar una
   función SSR o consulta de base de datos lenta.
