# Panel Admin — CamperOcasión

> Última actualización: 2026-09-15

Panel administrativo "centro de operaciones" para controlar el marketplace desde una sola pantalla. Diseñado para que el admin tenga acción, contexto y seguridad sin tener que ir de tab en tab.

## Acceso

- Ruta: `/admin`
- Seguridad: `src/lib/require-auth.ts` (service role). La UI usa `ADMIN_EMAILS` (`NEXT_PUBLIC_ADMIN_EMAILS` en el cliente / `ADMIN_EMAILS` en el servidor).

## Secciones

| Sección | Qué resuelve |
| --- | --- |
| **Dashboard** | KPIs en vivo, cola de acción (pagos, moderación, verificación, denuncias), gráfico 7 días, actividad reciente, top publicaciones, salud de canales, acciones rápidas. |
| **Publicaciones** | Buscar/filtrar/ordenar, selección masiva (activar/pausar/eliminar), destacar, boostear, detalle con imágenes, vendedor y estados. |
| **Moderación** | Denuncias activas, cola de aprobación, rechazo con motivo, historial de denuncias resueltas. |
| **Usuarios** | Buscar/filtrar, verificación individual o masiva, ajustar créditos (+ / −) con ledger, ver perfil público. |
| **Verificación** | Solicitudes de vendedores, comparación de datos, visualización de DNI/NIE (documento de identidad) mediante URL firmada. |
| **Homologación** | Expedientes documentales de vehículos: cola FIFO por antigüedad, apertura de cada documento con URL firmada, documentos exigidos que faltan, verificación o rechazo con motivo. |
| **Transacciones** | Aprobar/rechazar pagos pendientes, ver comprobante firmado, recordatorios push, métricas de ingresos. |
| **Auditoría** | Historial de cambios con resumen por tabla y limpieza de registros > 90 días. |
| **Categorías** | CRUD con conteo de publicaciones; impide borrar categorías con contenido. |
| **Comunicación** | Banners globales del sitio activables desde el panel. |
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

Ambas están incluidas en `setup-camperocasion.sql`. Ejecútalas en el SQL Editor
de Supabase (producción) antes o junto al despliegue. Si faltan, el sitio sigue
funcionando: el banner simplemente no aparece, la revisión de homologación
queda vacía y el panel avisa de que falta aplicarla.

## Endpoints nuevos

- `GET/POST/PATCH/DELETE /api/admin/categorias`
- `POST /api/admin/ajustar-creditos` — suma o descuenta créditos con ledger
- `GET/POST/PATCH/DELETE /api/admin/anuncios`
- `GET /api/anuncios/active` — banner público
- `GET /api/admin/status` — salud de configuración
- `GET/POST /api/admin/documentos-vehiculo` — cola de expedientes y verificar/rechazar
- `GET /api/admin/documentos-vehiculo/firmar` — URL firmada (5 min) de un documento del expediente
- `GET/POST/DELETE /api/documentos-vehiculo` — expediente del vehículo del lado del vendedor

## Notas de operación

- Las operaciones administrativas ya existentes (`toggle-activo`, `toggle-destacado`, `boost-producto`, `eliminar-producto`, `moderar-producto`, `verificar-venta`, etc.) siguen siendo la fuente de escritura. Este panel las utiliza, no duplica lógica de negocio.
- Los comprobantes, las DNI/NIEs y los documentos del vehículo se abren mediante URL firmada (nunca como URL pública permanente). La ruta se valida antes de firmar: `<user_id>/<archivo>` en DNI/NIEs y `<user_id>/<producto_id>/<archivo>` en el expediente.
- El sello de homologación acredita unos documentos concretos: **cualquier cambio en el expediente devuelve el anuncio a `pendiente`** y exige una nueva revisión.
- Los contadores del sidebar se refrescan al cambiar de pestaña.
