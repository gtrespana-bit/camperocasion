# Pendientes de despliegue — CamperOcasión

> Checklist de lo que falta por hacer **fuera del código** (Supabase, Vercel y
> GitHub). Antes vivía solo fuera del repositorio y se perdió dos veces al
> reiniciarse el entorno, así que ahora está versionado aquí. El resumen corto
> también está en la descripción del PR #3.

## 0. Resumen en tres líneas

1. Aplicar **dos migraciones** en Supabase (`202609150001_verificacion_homologacion.sql`
   y `202609160001_reservas.sql`) — o pegar el `setup-camperocasion.sql` completo.
2. Revisar las **variables de entorno** en Vercel (§1.3).
3. Activar la **CI** creando `.github/workflows/ci.yml` con `docs/ci/ci.yml` (§4).

---

## 1. SQL que hay que ejecutar en Supabase (producción) — PENDIENTE

### 1.1 Verificar prerrequisitos de la Fase 0.1 (filtros técnicos)

La 0.1 **no trae migración propia**: depende de la 025 ya aplicada.

```sql
-- Deben devolver una fila cada una
select column_name from information_schema.columns
 where table_name = 'productos' and column_name = 'especificaciones';

select indexname from pg_indexes where indexname = 'productos_especificaciones_idx';
```

- Si falta la **columna**: `/publicar` guarda sin especificaciones y los filtros
  técnicos salen siempre vacíos. Aplicar `025_categorias_faltantes_y_especificaciones.sql`.
- Si falta el **índice GIN**: nada se rompe, pero `@>` recorre la tabla
  (seq scan). Recrearlo es barato con la tabla actual.

### 1.2 Aplicar la Fase 0.2 (expediente de homologación)

```bash
# Opción A: solo esta migración
supabase/migrations/202609150001_verificacion_homologacion.sql

# Opción B: el setup completo (ya la incluye al final y es idempotente)
setup-camperocasion.sql
```

Comprobación posterior (>0 en las tres):

```sql
select to_regclass('public.documentos_vehiculo'),
       to_regclass('public.fn_es_dueno_del_anuncio'),
       (select 1 from storage.buckets where id = 'documentos-vehiculo');
```

Sin aplicarla el sitio funciona, pero: no aparece el sello de homologación, el
expediente sale vacío en `/producto/editar/[id]`, la pestaña **Homologación** del
panel avisa de que falta la migración y el filtro "Solo homologación verificada"
no devuelve nada.

### 1.2-bis Aplicar la Fase 1.2 (reserva con señal)

```bash
# Opción A: solo esta migración
supabase/migrations/202609160001_reservas.sql

# Opción B: el setup completo (ya la incluye al final y es idempotente)
setup-camperocasion.sql
```

Comprobación posterior (>0 en las tres):

```sql
select to_regclass('public.reservas'),
       to_regclass('public.fn_propagar_reserva'),
       (select 1 from storage.buckets where id = 'comprobantes-reserva');
```

Sin aplicarla el sitio **no se rompe**: la ficha del anuncio simplemente no
muestra el botón de reservar y las pestañas de reservas avisan de que falta la
migración. Cuando esté aplicada aparecen solas:

- Ficha del anuncio → botón "Reservar con señal" (100–1.000 €, sugerido 2 %),
  modal con condiciones y subida del comprobante.
- `/dashboard` → pestaña **Reservas** con "Mis reservas" y "En mis anuncios".
- `/admin?tab=reservas` → cola de verificación: activar / rechazar / completar /
  reembolsar / cancelar, con el comprobante en enlace firmado.
- Sello **Reservado** en las tarjetas de catálogo, buscador y ficha.
- Avisos por Telegram al admin si defines `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`
  (opcionales: sin ellos todo funciona igual, solo no llega el aviso).

Nota de producto: el dinero **no pasa por la plataforma**; el comprador paga la
señal por Bizum/transferencia/en mano y el admin verifica el comprobante. No hay
Stripe ni custodia, así que no hace falta ninguna variable nueva de pago.

### 1.3 Variables de entorno en Vercel — PENDIENTE (cuando estés en el ordenador)

Ya existentes y necesarias para lo nuevo:

- `SUPABASE_SERVICE_ROLE_KEY` → la usan las rutas nuevas del expediente
  (`/api/documentos-vehiculo` y `/api/admin/documentos-vehiculo`) y todas las de
  reservas, igual que el resto del panel.
- `ADMIN_EMAILS` → el email del admin que puede revisar, verificar y activar
  reservas (fallback `gtrespana@gmail.com`).
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` → opcionales; solo para que llegue un
  aviso al móvil cuando alguien reserva o sube un comprobante.

---

## 2. Al aplicar el SQL, comprobar en producción

- [ ] Subir un documento de prueba en un anuncio propio → aparece en el
      expediente y se abre con el enlace firmado.
- [ ] Reservar un anuncio propio con otra cuenta → la tarjeta del catálogo pasa a
      "Reservado", sube un comprobante de prueba y verifícalo desde
      `/admin?tab=reservas` (activar). Luego cancela para liberar el anuncio.
- [ ] Comprobar que el anuncio reservado **no** permite una segunda reserva.

## 2-bis. La Fase 0.3 (ITP) NO necesita SQL

`TIPOS_ITP` vive en `src/lib/itp.ts` y las 19 landings se generan desde la
configuración: no hay tabla ni migración. Lo único a recordar es revisar los
tipos cada año (la constante `REVISADO_EN` indica de cuándo son los datos).

---

## 3. Decisiones de producto ya tomadas (no volver a preguntarlas)

- **Comisión de reserva: 0 %** mientras no haya pasarela de pago. Se verifica el
  comprobante a mano; el importe de la señal va íntegro al vendedor.
- **Caducidad de la reserva: 7 días**, renovados al activarla (el comprador puede
  tardar en quedar para ver el vehículo).
- **Una reserva viva por anuncio**, garantizado por índice único parcial en la
  base de datos, no por la aplicación.
- **Señal sugerida: 2 % del precio**, redondeo a 50 €, mínimo 300 € y máximo
  1.000 €. El límite duro es 100–1.000 €.
- Si el **vendedor** cancela una reserva activa, queda en **"reembolsada"**: es la
  constancia de que debe devolver la señal.
- Las reservas caducadas se barren de forma **perezosa** en cada POST (sin cron).

---

## 4. Activar la CI (GitHub) — PENDIENTE

El repositorio **no tiene `.github/workflows/`** y el agente no puede crearlo:
GitHub rechaza el push de un workflow hecho por una GitHub App sin el permiso
`workflows` (*"refusing to allow a GitHub App to create or update workflow"*).
El workflow está en **`docs/ci/ci.yml`** con las instrucciones en cabecera:

1. En GitHub, *Add file → Create new file*, nombre `.github/workflows/ci.yml`, y
   pegar el contenido de `docs/ci/ci.yml` (se puede hacer desde el móvil).
2. O bien `git mv docs/ci/ci.yml .github/workflows/ci.yml` desde el ordenador.
3. O reconectar Arena con el permiso de workflows y pedirlo de nuevo.

Jobs: **calidad** (Node 22 → `npm ci` → `tsc --noEmit` → `eslint .` → `npm test`)
y **sql** (Python 3.12 → `pgserver`, `psycopg2-binary`, `pglast` → valida el
`setup-camperocasion.sql` completo y ejecuta los tests de RLS contra un Postgres
real). Los dos ya pasan en local.

---

## 5. Pendientes de producto (sin fecha, sin SQL)

- Rangos numéricos en los filtros (km máximos, año mínimo, watios de placa).
- Llevar los filtros técnicos también a `/buscar`, que tiene su propia barra.
- Normalizar las claves del JSONB a slugs (`plazas_dormir`) — necesita backfill.
- Fase 1 restante: inspección precompra, contrato de compraventa descargable y
  gestoría del cambio de nombre.
