# Plan de corrección y verificación — VendeT

**Última actualización:** 2026-08-01
**Rama de trabajo:** `arena/019fbf3f-marketplace-vzla`
**Estado:** código preparado para revisión; todavía no se ha abierto PR hacia `main`.

Este documento es la fuente de verdad de la auditoría. Separa lo que ya está
corregido de lo que todavía debe implementarse y de lo que debe comprobarse
manualmente antes de abrir el PR.

---

## Reglas de trabajo

1. Cada cambio de esquema va en una migración nueva.
2. Antes de revocar permisos o cambiar una columna se actualizan todos sus consumidores.
3. No se elimina ni renombra una columna usada por código sin una transición.
4. Las migraciones se ejecutan primero en staging o en una copia de prueba.
5. No se abre el PR hacia `main` hasta completar la lista de pruebas manuales.
6. No se considera una tarea terminada solo porque compile: también se prueba el flujo real.
7. Si una migración falla por datos existentes, se detiene el proceso y se prepara una migración de conservación de datos; no se borra información automáticamente.
8. El despliegue del código que depende de una migración se hace junto con esa migración o después de ella, nunca antes.

---

## Migraciones aplicadas

### ✅ `202608010001_hardening_integridad.sql`

Confirmada como ejecutada correctamente.

Incluye:

- Restricción de columnas públicas/privadas de `perfiles`.
- Escrituras privadas de perfil mediante `/api/perfil`.
- Restricción de inserción, borrado y campos protegidos de `productos`.
- Créditos y reseñas escritos mediante API/RPC de servidor.
- Solicitudes de verificación restringidas a usuario propietario o admin.
- Comprobantes privados y acceso administrativo firmado.
- Función `is_admin()` para políticas RLS.
- `incrementar_visitas()` atómico.
- Aprobación de créditos idempotente.
- `agregar_creditos_admin()` atómico.
- `usar_boost()` y `usar_destacado()` con descuento atómico.
- Corrección del trigger de reputación para no reactivarse por sus propios campos.
- Historial de precios mediante función `SECURITY DEFINER`.
- Corrección del RPC `obtener_detalle_producto` para respetar visibilidad telefónica.

### ✅ `202608010002_chat_resenas_integridad.sql`

Confirmada como ejecutada correctamente después de hacerla idempotente.

Incluye:

- Conversaciones creadas/eliminadas mediante API autenticada.
- Índices únicos para evitar conversaciones duplicadas.
- Mensajes escritos mediante API autenticada.
- Políticas que impiden enviar mensajes a destinatarios ajenos.
- Reseñas escritas mediante API después de validar la venta.
- Protección de la cola de notificaciones push.

### 🐞 Bug detectado: `permission denied for table perfiles` al editar un artículo

**Síntoma:** Al guardar un producto desde `/producto/editar/<id>` aparece
`Error al guardar: permission denied for table perfiles` y un 403 en el PATCH
hacia `/rest/v1/productos?id=eq.<id>`.

**Causa raíz:** `202608010001_hardening_integridad.sql` revocó a `authenticated`
el UPDATE de las columnas de negocio de `perfiles` (`nivel_confianza`,
`badges_automaticos`, `ultima_actividad`), pero `fn_calcular_reputacion()`
(migración `012_reputacion.sql`) **no es `SECURITY DEFINER`**. Se dispara desde
el trigger `trg_calc_reputacion_prod` sobre `productos` al editar (el update
incluye `activo`), e intenta escribir esas columnas → 403. La migración de
endurecimiento corrigió el trigger de `perfiles` para que no se reactive solo,
pero olvidó convertir la función en `SECURITY DEFINER`.

**Fix:** migración `202608010003_fix_reputacion_definer.sql` que convierte
`fn_calcular_reputacion()` en `SECURITY DEFINER` con `search_path = public`.

**Estado: ✅ SQL aplicado (confirmado por el usuario 2026-08-01).**
Pendiente: confirmar en la interfaz que editar y guardar un artículo ya no
arroja el error 403. Ver sección C de pruebas manuales.

---

## Cambios ya realizados en código

### ✅ Publicación y moderación

- `/api/publicar` ya no confía en `estado_moderacion`, `activo`, `destacado` ni otros campos protegidos enviados por el navegador.
- La moderación se recalcula en el servidor.
- El contenido prohibido se rechaza desde el servidor.
- El contenido sospechoso queda pendiente y genera una sola alerta.
- Se eliminó la alerta duplicada que se enviaba desde el cliente.

### ✅ Perfil y permisos

- Header y dashboard leen el perfil privado mediante `/api/perfil`.
- La edición de perfil usa `PATCH /api/perfil`.
- Los datos privados ya no se leen directamente con la clave pública.
- El panel admin usa APIs protegidas para usuarios y transacciones.

### ✅ Productos

- El editor incluye `especificaciones`, `imagenes` y `metodos_contacto` en el SELECT.
- El editor usa `maybeSingle()` para productos inexistentes.
- El detalle de producto carga galería y métodos de contacto.
- Las visitas usan el RPC atómico.
- El borrado del editor pasa por una API autenticada.
- Reactivar un producto vendido pasa por `/api/productos/reactivar`.

### ✅ Créditos y pagos

- El precio del paquete se calcula en servidor.
- La transacción guarda `precio_usd` cuando la migración está aplicada.
- El admin consulta transacciones mediante `/api/admin/transacciones`.
- El rechazo pasa por `/api/admin/rechazar-transaccion`.
- Los comprobantes se abren mediante `/api/admin/comprobante`.
- Las nuevas subidas de comprobantes usan una carpeta por usuario.
- La aprobación desde Telegram usa una operación atómica e idempotente.

### ✅ Chat y reseñas

- Los mensajes pasan por `/api/enviar-mensaje`.
- Se valida que el destinatario sea el otro miembro de la conversación.
- El envío tiene rate limit.
- Las notificaciones push de mensajes se generan desde el servidor.
- Crear conversación valida que el vendedor corresponda al producto.
- El vendedor solo puede elegir como comprador a un participante de una conversación previa.
- El borrado de conversaciones pasa por `/api/eliminar-conversacion`.
- Las reseñas exigen venta confirmada, comprador/vendedor correctos y puntuación válida.
- Se impiden reseñas duplicadas y auto-reseñas.
- `review-status` solo permite reseñar al comprador real de un producto marcado como vendido.
- `marcar-vendido` valida que el comprador tenga una conversación sobre ese producto.

### ✅ Calidad básica

- TypeScript pasa.
- Los 93 tests unitarios pasan.
- Lint ya no tiene errores bloqueantes.
- Se corrigió el error de sintaxis de `scripts/performance-test.js`.
- Se corrigió el warning de display name del mock de `ProductCard`.
- Se corrigió la limpieza de previews de imágenes.

---

# Pruebas manuales obligatorias antes del PR

Estas pruebas deben hacerse en staging, preview o una base de prueba con dos
cuentas normales y una cuenta admin. No usar pruebas destructivas contra
producción sin respaldo.

## A. Perfil y permisos

- [ ] Un usuario normal puede abrir su dashboard.
- [ ] El balance de créditos aparece correctamente.
- [ ] Puede cambiar nombre, teléfono, estado y municipio.
- [ ] Los cambios persisten después de recargar.
- [ ] Un usuario normal no puede consultar el `credito_balance` de otra persona desde el cliente.
- [ ] Un usuario normal no puede modificar `credito_balance`, `verificado`, `nivel_confianza` ni `badges_automaticos`.
- [ ] Un usuario normal no puede modificar el perfil de otro usuario.

## B. Publicar y moderar

- [ ] Publicar un producto normal funciona.
- [ ] La categoría y subcategoría se guardan correctamente.
- [ ] Las especificaciones aparecen en el detalle.
- [ ] Un contenido sospechoso queda pendiente.
- [ ] Un contenido prohibido es rechazado aunque se manipule la petición del navegador.
- [ ] Un usuario normal no puede insertar directamente un producto saltándose la API.
- [ ] Un usuario normal no puede marcar su producto como verificado o destacado mediante REST directo.

## C. Editar productos

- [x] **Editar y guardar un producto no arroja `permission denied for table perfiles` ni 403** (SQL `202608010003_fix_reputacion_definer.sql` aplicado 2026-08-01; confirmar guardado real en la interfaz).
- [ ] Editar título conserva las especificaciones.
- [ ] Editar precio conserva las especificaciones.
- [ ] Editar un producto con varias imágenes conserva todas las imágenes.
- [ ] Añadir una imagen conserva las imágenes antiguas.
- [ ] Quitar un método de contacto no borra los demás.
- [ ] WhatsApp, teléfono, email y Messenger aparecen según la configuración guardada.
- [ ] Un ID inexistente muestra “No encontrado”.
- [ ] Cambiar el precio no falla por el historial de precios.

## D. Galería, detalle y visitas

- [ ] El detalle muestra todas las imágenes.
- [ ] El carrusel y el lightbox funcionan en móvil y escritorio.
- [ ] Los métodos de contacto configurados funcionan.
- [ ] Un visitante anónimo incrementa las visitas.
- [ ] Dos visitas simultáneas no producen errores ni modifican otros campos.
- [ ] Un producto rechazado o inexistente no es expuesto por el RPC de detalle.
- [ ] El teléfono solo aparece cuando corresponde a la configuración de visibilidad.

## E. Créditos y comprobantes

- [ ] Un usuario puede enviar una compra de un paquete válido.
- [ ] Un paquete inventado es rechazado.
- [ ] El admin ve la transacción pendiente.
- [ ] El admin puede abrir el comprobante.
- [ ] Un usuario normal no puede abrir el comprobante de otro usuario.
- [ ] Aprobar una transacción suma créditos una sola vez.
- [ ] Repetir el callback de aprobación no vuelve a sumar créditos.
- [ ] Rechazar una transacción aprobada no la cambia de estado.
- [ ] Añadir créditos manualmente actualiza balance e histórico juntos.
- [ ] Boost y destacado descuentan el balance correcto.
- [ ] Dos operaciones simultáneas no permiten saldo negativo.

## F. Chat

- [ ] Un comprador puede iniciar conversación desde un producto activo.
- [ ] El vendedor puede responder.
- [ ] Ambos lados reciben los mensajes.
- [ ] El contador de no leídos se actualiza.
- [ ] Marcar mensajes como leídos funciona.
- [ ] Una persona no puede enviar mensajes a un destinatario que no pertenece a la conversación.
- [ ] Una persona no puede crear una conversación arbitraria sobre el producto de otro vendedor.
- [ ] El rate limit de mensajes responde con 429 al superar el límite.
- [ ] La notificación push del mensaje no requiere ser admin.
- [ ] Eliminar una conversación funciona solo para un participante.

## G. Venta y reseñas

- [ ] El vendedor puede marcar como vendido un producto.
- [ ] Solo puede seleccionar como comprador a un participante de ese producto.
- [ ] El comprador recibe la notificación de venta.
- [ ] El comprador ve el botón de reseña únicamente después de la venta confirmada.
- [ ] Un producto pausado, pero no vendido, no permite reseña.
- [ ] El comprador puede dejar una reseña válida.
- [ ] No puede dejar una segunda reseña para la misma venta.
- [ ] No puede reseñarse a sí mismo.
- [ ] Un usuario ajeno no puede dejar una reseña para esa venta.
- [ ] La puntuación fuera de 1–5 es rechazada.

## H. Verificación y documentos

- [ ] Un usuario puede enviar una solicitud con sus propios documentos.
- [ ] La alerta de Telegram llega una sola vez.
- [ ] El usuario ve su propia solicitud después de recargar.
- [ ] Un usuario normal no puede ver solicitudes ajenas.
- [ ] Un usuario normal no puede descargar cédulas ajenas.
- [ ] El admin puede revisar y aprobar/rechazar solicitudes.
- [ ] La aprobación actualiza el perfil correcto.

---

# Pendiente de implementación

## Fase 3 — Catálogo y experiencia principal

- [x] Rehacer la paginación usando `totalCount`, no solo los productos cargados.
- [x] Cargar páginas posteriores realmente desde servidor (`.range()`).
- [x] Resetear la página al cambiar filtros.
- [x] Mostrar errores de carga del catálogo en vez de mostrar una lista vacía.
- [x] Corregir consultas que todavía usan `select('*')` innecesariamente.
- [x] Unificar los datos de contacto y la galería en todas las tarjetas/detalles. (Verificado: tarjetas usan `imagen_url` como miniatura; detalle/editor usan `imagenes` + `metodos_contacto`. Coherente.)

Detalle de la implementación (2026-08-01):

- `useProductPagination` reescrito: `currentPage` ahora se deriva del parámetro
  `pagina` del URL de forma reactiva (antes se leía una sola vez al montar, por
  lo que cambiar de página no actualizaba el grid).
- `useProductLoader` reescrito como `loadPage({ page, pageSize, filters })` que
  carga UNA página real desde el servidor con `.range()` y devuelve `totalCount`
  exacto. Antes cargaba `limit(100)` y paginaba en el cliente.
- `CatalogoPage`: `totalPages` se calcula con `totalCount`, se resetea a la
  página 1 al cambiar filtros, y se muestra un banner de error con botón
  "Reintentar" cuando la carga falla.
- Consultas `select('*')` reducidas a las columnas necesarias en
  `BuscarClient`, `useDashboard` y `publicar` (cuentas con `select('id')`).
- `tsc`, `npm test` (93/93) y `npm run lint` (0 errores) pasan.
- Build local bloqueado solo por descarga de Google Fonts (entorno), sin errores
  de código.

### Correcciones P1 posteriores a la auditoría

- El SSR inicial de `/catalogo` y el cliente comparten ahora
  `CATALOG_PAGE_SIZE = 24`. Antes el SSR recibía solo 12 resultados, mientras
  la página 2 comenzaba en el 25; por tanto se omitían los resultados 13–24.
  El rango del loader también se centralizó y tiene prueba unitaria.
- El bucket privado `cedulas` se abre desde el panel admin mediante
  `GET /api/admin/cedula`, que exige admin, valida la ruta y devuelve una URL
  firmada de 5 minutos con `no-store`. Se eliminó el uso incorrecto de
  `getPublicUrl`; el panel permite abrir frente y dorso.
- El detalle de producto ya muestra email y Messenger configurados por
  publicación. Los enlaces Messenger se limitan a HTTPS en hosts oficiales;
  WhatsApp y teléfono pueden usar números distintos. Una configuración vacía
  `{}` expresa que solo se debe mostrar chat, sin recuperar el teléfono de un
  perfil legacy.
- Estas correcciones pasan `tsc`, 93/93 tests, lint sin errores y build con
  variables públicas de Supabase. Sigue pendiente su validación manual en
  staging según las listas C, D y H.

## Fase 4 — SEO y localización

- [x] Corregir el filtro de categoría de las landings ciudad/categoría.
- [x] Unificar municipio almacenado y ciudad SEO.
- [x] Resolver slugs duplicados de ciudades.
- [x] Corregir breadcrumbs de ubicación.
- [x] Corregir Open Graph de productos con slug SEO.
- [x] Corregir Open Graph del catálogo con filtros.
- [x] Completar URLs `/en` en sitemap.
- [x] Evitar `lastModified: new Date()` para todas las URLs.
- [x] Revisar cadenas hardcodeadas en español dentro del locale inglés.

## Fase 5 — Autenticación, emails y PWA

- [ ] Verificar con una prueba E2E el flujo de confirmación PKCE.
- [ ] Verificar recuperación de contraseña con el flujo PKCE.
- [ ] Mover el envío de emails desde Server Actions sin rate limit a APIs controladas.
- [ ] Escapar datos de usuario en plantillas HTML de emails.
- [ ] Corregir logo inexistente `logo-vendet.png` en emails.
- [ ] Activar validación real de tamaño/MIME en URLs firmadas de R2.
- [ ] Limpiar archivos R2 huérfanos.
- [ ] Añadir rate limit y validación de keys a push subscriptions.
- [ ] Añadir rate limit server-side para registro y reenvío de confirmación.
- [ ] Revisar caché de HTML personalizado del Service Worker.
- [ ] Reducir el render dinámico causado por el layout raíz.

## Fase 6 — Migraciones y calidad de entrega

- [ ] Consolidar migraciones con números duplicados (`002`, `003`, `011`, `012`, `019`).
- [ ] Documentar qué migraciones históricas son destructivas (`014_chat_reset`, `015_clean_chat`).
- [ ] No ejecutar scripts destructivos automáticamente en una base con datos.
- [ ] Corregir migración `019_fulltext_search.sql` y la columna `seller_nombre`.
- [ ] Añadir pruebas automatizadas de APIs y RLS.
- [ ] Añadir pruebas E2E de autenticación, publicación, edición, compra y chat.
- [x] Hacer que `npm run build` no dependa de descargar Google Fonts durante el build. → Inter autohospedada con `next/font/local` desde `src/app/fonts/*.woff2` (pesos 400/500/600/700/900 normal+itálica). Se mantuvo la variable `--font-inter` (sin tocar Tailwind) y se limpió el CSP y los preconnect/dns-prefetch de `fonts.googleapis.com`/`fonts.gstatic.com`. `tsc`, lint y tests pasan; el build compila y ya no consulta Google Fonts.
- [ ] Resolver las vulnerabilidades reportadas por `npm audit` sin usar `--force` a ciegas.
- [ ] Eliminar warnings de lint restantes.
- [ ] Añadir un job CI que ejecute también `npm run lint`.

---

# Puerta de salida hacia `main`

No se abre el PR hasta que se cumpla todo esto:

- [ ] Fase 1 SQL aplicada y verificada.
- [ ] Fase 2 SQL aplicada y verificada.
- [ ] Checklist manual A–H completado.
- [ ] `tsc` correcto.
- [ ] Tests correctos.
- [ ] Lint sin errores.
- [ ] Build exitoso o bloqueo documentado y resuelto.
- [ ] Working tree limpio.
- [ ] Revisión final del diff.
- [ ] PR abierto desde `arena/019fbedd-marketplace-vzla` hacia `main`.
