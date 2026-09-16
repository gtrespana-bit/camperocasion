# Panel Admin — VendeT Venezuela

> Última actualización: 2026-08-30

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
| **Verificación** | Solicitudes de vendedores, comparación de datos, visualización de cédula mediante URL firmada. |
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

Ejecútala en el SQL Editor de Supabase (producción) antes o junto al despliegue. Si la tabla no existe, el sitio sigue funcionando (el banner simplemente no aparece) y el panel muestra cómo activarlo.

## Endpoints nuevos

- `GET/POST/PATCH/DELETE /api/admin/categorias`
- `POST /api/admin/ajustar-creditos` — suma o descuenta créditos con ledger
- `GET/POST/PATCH/DELETE /api/admin/anuncios`
- `GET /api/anuncios/active` — banner público
- `GET /api/admin/status` — salud de configuración

## Notas de operación

- Las operaciones administrativas ya existentes (`toggle-activo`, `toggle-destacado`, `boost-producto`, `eliminar-producto`, `moderar-producto`, `verificar-venta`, etc.) siguen siendo la fuente de escritura. Este panel las utiliza, no duplica lógica de negocio.
- Los comprobantes y cédulas se abren mediante URL firma (nunca como URL pública permanente).
- Los contadores del sidebar se refrescan al cambiar de pestaña.
