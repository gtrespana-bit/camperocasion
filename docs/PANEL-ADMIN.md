# Panel Admin — CamperOcasión

> Última actualización: 2026-09-29

Panel administrativo "centro de operaciones" para controlar el marketplace desde una sola pantalla. Diseñado para que el admin tenga acción, contexto y seguridad sin tener que ir de tab en tab.

## Acceso

- Ruta: `/admin`
- Seguridad: `src/lib/require-auth.ts` (service role). La UI usa `ADMIN_EMAILS` (`NEXT_PUBLIC_ADMIN_EMAILS` en el cliente / `ADMIN_EMAILS` en el servidor).

## Secciones

| Sección | Qué resuelve |
| --- | --- |
| **Dashboard** | KPIs en vivo, cola de acción (pagos, moderación, verificación, denuncias), gráfico 7 días, actividad reciente, top publicaciones, salud de canales, acciones rápidas. |
| **Audiencia** | Visitantes únicos, páginas vistas, sesiones, tiempo por página (con comparativa contra el periodo anterior), registros, anuncios publicados, mensajes, favoritos y canjes, clasificados por **día / semana / mes** y por rango (hoy, 7, 30, 90 días, este mes, mes pasado, 12 meses, todo o fechas a mano). Top de páginas y de anuncios, dispositivos, idioma, fuentes de tráfico, horas y días de la semana, anuncios activos sin ninguna visita y estado general de la plataforma (usuarios, packs, anuncios). Exportable a CSV. |
| **Publicaciones** | Buscar/filtrar/ordenar, selección masiva (activar/pausar/eliminar), destacar, boostear, detalle con imágenes, vendedor y estados. |
| **Moderación** | Denuncias activas, cola de aprobación, rechazo con motivo, historial de denuncias resueltas. |
| **Usuarios** | Buscar/filtrar (incluye «con pack» / «sin pack»), verificación individual o masiva, ajustar créditos (+ / −) con ledger, **regalar pack** (días de Starter/Plus/Unlimited), ver perfil público. |
| **Verificación** | Solicitudes de vendedores, comparación de datos, visualización de DNI/NIE (documento de identidad) mediante URL firmada. |
| **Homologación** | Expedientes documentales de vehículos: cola FIFO por antigüedad, apertura de cada documento con URL firmada, documentos exigidos que faltan, verificación o rechazo con motivo. |
| **Transacciones** | Aprobar/rechazar pagos pendientes, ver comprobante firmado, recordatorios push, métricas de ingresos. |
| **Auditoría** | Historial de cambios con resumen por tabla y limpieza de registros > 90 días. |
| **Categorías** | CRUD con conteo de publicaciones; impide borrar categorías con contenido. |
| **Comunicación** | Banners globales del sitio activables desde el panel. |
| **Planes y cupones** | Mes de prueba global, cupones de regalo/descuento, **regalo directo de pack a un usuario** (días de Starter/Plus/Unlimited), packs activos con días restantes y bitácora de los últimos regalos. |
| **Exportar** | CSV/JSON de productos, usuarios, transacciones, reseñas, auditoría, verificaciones y denuncias. |
| **Ajustes** | Salud de la plataforma (DB, Telegram, Push, Email, anuncios, rate limit) y prueba de canales. |

## Migración nueva

El banner de **Comunicación** requiere crear la tabla `anuncios_globales`:

```bash
supabase/migrations/202608010007_anuncios_globales.sql
```

La pestaña **Homologación** requiere, además, el expediente del vehículo:

```bash
supabase/migrations/202609150001_verificacion_homologacion.sql
```

La pestaña **Audiencia** y los regalos de pack necesitan:

```bash
supabase/migrations/202609290001_analitica_visitas.sql
```

Crea `visitas_pagina` (una fila por página vista, anónima), `planes_regalos`
(bitácora de regalos) y las funciones `analitica_visitas` (agregados por
día/semana/mes) y `limpiar_visitas_antiguas` (retención de 400 días, que llama
el cron diario `clean-rate-limits`). Si falta, el panel **no se rompe**: la
pestaña Audiencia avisa de que está pendiente y agrupa las visitas al vuelo.

> **Permisos.** El fichero es **idempotente**: si ya lo ejecutaste antes de que
> incluyera la sección 5 (permisos), **vuelve a ejecutarlo entero** y quedará
> arreglado. Concede `all` sobre las dos tablas y `execute` sobre las dos
> funciones a `service_role` (el rol de las API), deja fuera a `anon` y
> `authenticated`, y añade una política `to service_role` para no depender de
> `BYPASSRLS`. Sin esos permisos, las visitas no se guardan, la RPC falla (el
> panel avisa en amarillo) y la bitácora de regalos no se escribe.

Todas están incluidas en `setup-camperocasion.sql` (la de audiencia, como anexo
2026-09-29). Ejecútalas en el SQL Editor de Supabase (producción) antes o junto
al despliegue. Si faltan, el sitio sigue funcionando: el banner simplemente no
aparece, la revisión de homologación queda vacía, la pestaña Audiencia agrupa al
vuelo avisando en amarillo y los regalos de pack se aplican igual (solo se
pierde la bitácora `planes_regalos`).

## Endpoints nuevos

- `GET/POST/PATCH/DELETE /api/admin/categorias`
- `POST /api/admin/ajustar-creditos` — suma o descuenta créditos con ledger
- `GET/POST/PATCH/DELETE /api/admin/anuncios`
- `GET /api/anuncios/active` — banner público
- `GET /api/admin/status` — salud de configuración
- `GET /api/admin/estadisticas` — informe de audiencia (rango, granularidad, comparativa, actividad, estado)
- `POST/GET /api/admin/regalar-plan` — regalar/retirar un pack a un usuario y consultar packs activos + bitácora
- `POST /api/analytics/visita` — beacon público anónimo de páginas vistas (respeta DNT/GPC)
- `GET/POST /api/admin/documentos-vehiculo` — cola de expedientes y verificar/rechazar
- `GET /api/admin/documentos-vehiculo/firmar` — URL firmada (5 min) de un documento del expediente
- `GET/POST/DELETE /api/documentos-vehiculo` — expediente del vehículo del lado del vendedor

## Audiencia: cómo se mide

- La medición es **propia** (tabla `visitas_pagina`), no depende de Vercel
  Analytics. El navegador genera un id aleatorio (`localStorage`), la sesión
  dura 30 minutos de inactividad y **no** se guarda IP ni user-agent. El servidor
  recalcula el tipo de página y el slug desde la ruta: nunca se fía del cliente.
- Solo se envía si el usuario pulsó «Aceptar» en el aviso de cookies
  (`src/components/AnaliticaVisitas.tsx`, montado desde `RootClientEffects`); si
  rechaza, el código ni se descarga. La política de cookies se actualizó para
  describirlo.
- El panel `/admin` no se mide, y una página se cuenta una sola vez cada 5
  segundos (recargas, doble render de React).
- La duración de cada página se manda al pasar a la siguiente (o al cerrar la
  pestaña) porque al entrar todavía no se conoce; por eso puede quedar sin
  cerrar en visitas de una sola página.
- `GET /api/admin/estadisticas` agrupa en Postgres con la RPC; si la migración
  no está aplicada, agrupa en JavaScript y devuelve `degradado: true` (el panel
  lo avisa en amarillo).
- Retención: 400 días, borrado por el cron diario.

## Notas de operación

- Las operaciones administrativas ya existentes (`toggle-activo`, `toggle-destacado`, `boost-producto`, `eliminar-producto`, `moderar-producto`, `verificar-venta`, etc.) siguen siendo la fuente de escritura. Este panel las utiliza, no duplica lógica de negocio.
- Los comprobantes, las DNI/NIEs y los documentos del vehículo se abren mediante URL firmada (nunca como URL pública permanente). La ruta se valida antes de firmar: `<user_id>/<archivo>` en DNI/NIEs y `<user_id>/<producto_id>/<archivo>` en el expediente.
- El sello de homologación acredita unos documentos concretos: **cualquier cambio en el expediente devuelve el anuncio a `pendiente`** y exige una nueva revisión.
- Los contadores del sidebar se refrescan al cambiar de pestaña.
- Regalar un pack **no** pasa por Stripe ni por cupones: escribe
  `perfiles.plan_anuncios` / `plan_hasta` (los mismos campos del webhook) y deja
  la huella en `planes_regalos` con el email del admin que lo hizo. El usuario
  recibe un email de aviso.
- Regalar un pack a un «particular» no amplía su cupo (sigue en 1 anuncio): el
  modal ofrece marcarlo como profesional en el mismo paso.
