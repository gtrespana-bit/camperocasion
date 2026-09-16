# Pendientes de despliegue — CamperOcasión

> Checklist de lo que falta por hacer **fuera del código** (Supabase, Vercel y
> GitHub). Antes vivía solo fuera del repositorio y se perdió dos veces al
> reiniciarse el entorno, así que ahora está versionado aquí. El resumen corto
> también está en la descripción del PR #3.

> **Estado a 2026-09-16 (noche):** `setup-camperocasion.sql` aplicado y verificado
> **20/20** con `scripts/verificar_despliegue.sql`. CI activada y en verde.
> **Vercel ya despliega producción** (el bloqueo §6 se resolvió: hay deployments
> de Production sobre `main` en cada push). **Nuevo dominio canónico:
> `camperocasion.online`** (cambiado el 2026-09-16, antes `camperocasion.es`,
> que nunca llegó a servir tráfico). Quedan: **DNS del dominio en Vercel** y las
> **variables de entorno** (§1.3), y verificar la producción cuando propague.

## 0. Resumen en cuatro líneas

1. ~~Aplicar **dos migraciones** en Supabase~~ ✅ **hecho**: `setup-camperocasion.sql`
   completo, verificado con `scripts/verificar_despliegue.sql` (20/20 ✅).
2. Revisar las **variables de entorno** en Vercel (§1.3) — **PENDIENTE**.
3. ~~Activar la **CI**~~ ✅ **hecho** el 2026-09-16: el workflow ya vive en
   `.github/workflows/ci.yml` y los dos jobs pasan en `main`.
4. ~~Que Vercel tenga **un despliegue de producción**~~ ✅ **resuelto el
   2026-09-16**: Vercel publica deployment de Production en cada push a `main`
   (verificado vía `gh api .../deployments`).
5. **Apuntar `camperocasion.online` a Vercel** (Settings → Domains + DNS) y
   **verificar** que producción carga anuncios con las env vars — **PENDIENTE**.

---

## 1. SQL en Supabase (producción) — ✅ APLICADO el 2026-09-16

Verificación completa: `scripts/verificar_despliegue.sql` → 20/20 ✅

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

Comprobación: `scripts/verificar_despliegue.sql` de una vez (20 comprobaciones),
o al menos esta — **atención**: para funciones hay que usar `to_regprocedure()`,
porque `to_regclass()` solo mira relaciones (tablas, índices, vistas) y devuelve
NULL aunque la función exista:

```sql
select to_regclass('public.documentos_vehiculo'),
       to_regprocedure('public.fn_es_dueno_del_anuncio(uuid)'),
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

Comprobación (los tres valores, no nulos):

```sql
select to_regclass('public.reservas'),
       to_regprocedure('public.fn_propagar_reserva()'),
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

### 1.3 Variables de entorno en Vercel — PENDIENTE

Reglas del dashboard: nombre **exacto** (mayúsculas, sin espacios ni comillas),
marcar **Production + Preview**, y tras cambiar cualquier `NEXT_PUBLIC_*` hay
que **redeployar** (se incrustan en el bundle en build time, no se leen en
runtime). No usar el tipo *Sensitive*: hay variables leídas a nivel de módulo
(`src/lib/server-email.ts`, `src/lib/supabase.ts`) y con Sensitive llegan vacías
a la build.

**Bloque A — sin estas el sitio no funciona (5):**

| Variable | Valor | Consecuencia de no ponerla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hbiywrddxrsidniwxuhe.supabase.co` | **cuidado**: el proyecto de marketplace-vzla es `jmbkqelkusxjebsdnjoc`. Con esa URL y estas claves, Supabase responde `401 Invalid API key` en todo el sitio (incluido el login). `next.config.js` (imágenes) y el `preconnect` de `layout.tsx` ya la leen de esta variable, así que basta con cambiarla aquí y redeployar. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → *Project Settings → Data API (legacy)* → `anon` / `publishable` | `getSupabaseServerClient()` devuelve `null` → home, catálogo y landings salen sin anuncios |
| `SUPABASE_SERVICE_ROLE_KEY` | la `service_role` (server-side **solo**) | todo `/api/admin/*`, reservas y expediente de homologación sin funcionar |
| `CRON_SECRET` | un string aleatorio propio (p. ej. `openssl rand -hex 32`) | **los 4 crons devuelven 401**: el guard es `if (!secret \|\| auth !== Bearer) → 401`, o sea que sin la variable ni Vercel puede llamarlos |
| `NEXT_PUBLIC_URL` | `https://camperocasion.online` | enlaces de emails/OG/sitemap apuntan al default; ponerlo igualmente |

**Bloque B — emails salientes (elegir UN canal):** `RESEND_API_KEY` (+ dominio
verificado en Resend) **o** `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`.
Orden real en `src/lib/server-email.ts`: 1º Resend API, 2º `SMTP_*`, 3º
`ZOHO_SMTP_*` (legado). Opcional: `EMAIL_FROM` (default `"CamperOcasión"
<noreply@camperocasion.online>`) y `CONTACTO_EMAIL` (default
`soporte@camperocasion.online`). Sin canal, el envío devuelve *"Sin canal de envío:
configura RESEND_API_KEY o SMTP_USER/SMTP_PASS"* y el registro no se verifica.

**Bloque C — opcionales:** `ADMIN_EMAILS` + `NEXT_PUBLIC_ADMIN_EMAILS` (ambas
con el mismo valor; el fallback ya es `gtrespana@gmail.com`, así que no urge),
`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (avisos de reservas), par VAPID
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`, push PWA),
`GOOGLE_SITE_VERIFICATION` (meta tag de Search Console).

**NO añadir en Vercel:** `SUPABASE_SERVICE_KEY` (alias legado que solo usan
3 scripts locales de `scripts/`), `EMAIL_SERVER_HOST` (no la lee ningún envío:
solo el chequeo de salud de `/api/admin/status`), `NODE_ENV` (lo pone Vercel) y
`NEXT_OUTPUT` (rompe la build, ver §6.4).

**Comprobación tras el deploy:** entrar en `/admin` → la pestaña de estado llama
a `/api/admin/status`, que reporta `supabase`, `telegram`, `push`,
`emailResend` y `emailSmtp` → sirve para confirmar en 10 segundos qué variables
están realmente llegando a producción.

**Si al entrar al catálogo sale «No se pudieron cargar los productos / Invalid
API key» y en la consola hay 401 a `*.supabase.co/rest/v1/*`:** no es la base de
datos (que puede estar vacía), es que las claves de Vercel no son las del
proyecto. Diagnóstico y arreglo paso a paso en
[`docs/diagnostico-supabase-401.md`](./diagnostico-supabase-401.md). Resumen:

```
https://<dominio>/api/diagnostico/supabase?token=<CRON_SECRET>
```

Dice si cada clave está definida, de qué proyecto es, si está caducada y si
Supabase la acepta (prueba real) — sin revelar ninguna clave. Tras corregir las
variables hay que **redeployar**: las `NEXT_PUBLIC_*` se incrustan en el bundle
en build time.

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

## 4. Activar la CI (GitHub) — ✅ HECHO el 2026-09-16

El workflow está en `.github/workflows/ci.yml`, se ejecuta en cada push y PR
(los dos jobs pasan en `main`). Las instrucciones para moverlo desde
`docs/ci/ci.yml` ya no hacen falta y se borraron.

⚠️ Los **26 primeros comentarios de `.github/workflows/ci.yml`** siguen
diciendo «ESTE ARCHIVO TODAVÍA NO SE EJECUTA»: son obsoletos, la CI sí se
ejecuta. No se pueden borrar desde Arena (GitHub rechaza el push de cualquier
fichero en `.github/workflows/` hecho por una GitHub App sin permiso
`workflows`). Se quitan en 20 s desde la web:
[editar el workflow](https://github.com/gtrespana-bit/camperocasion/edit/main/.github/workflows/ci.yml)
y borrar el bloque de comentarios hasta `name: CI`.

<details><summary>Historial: cómo se activó</summary>

El repositorio **no tenía `.github/workflows/`** y el agente no podía crearlo:

El repositorio **no tiene `.github/workflows/`** y el agente no puede crearlo:
GitHub rechaza el push de un workflow hecho por una GitHub App sin el permiso
`workflows` (*"refusing to allow a GitHub App to create or update workflow"*).
El workflow está en **`docs/ci/ci.yml`**. Forma rápida (sin pegar código, vale
desde el móvil): abrir el archivo en la web, pulsar el lápiz y **cambiar el
nombre** a `.github/workflows/ci.yml`:

https://github.com/gtrespana-bit/camperocasion/edit/arena/01a0a7f4-camperocasion/docs/ci/ci.yml

Commit directo a la rama → el workflow queda activo y arranca solo. Alternativas:
*Add file → Create new file* con el contenido pegado, `git mv` desde el
ordenador, o reconectar Arena con el permiso `workflows`.

Jobs: **calidad** (Node 22 → `npm ci` → `tsc --noEmit` → `eslint .` → `npm test`)
y **sql** (Python 3.12 → `pgserver`, `psycopg2-binary`, `pglast` → valida el
`setup-camperocasion.sql` completo + RLS de documentos + garantías de reservas +
las 20 comprobaciones de despliegue). Los cuatro scripts ya pasan en local.

</details>

---

## 5. Pendientes de producto (sin fecha, sin SQL)

- Rangos numéricos en los filtros (km máximos, año mínimo, watios de placa).
- Llevar los filtros técnicos también a `/buscar`, que tiene su propia barra.
- Normalizar las claves del JSONB a slugs (`plazas_dormir`) — necesita backfill.
- Fase 1 restante: inspección precompra, contrato de compraventa descargable y
  gestoría del cambio de nombre.

---

## 6. Vercel: «No Production Deployment» — ✅ RESUELTO el 2026-09-16 (noche)

> **Actualización 2026-09-16 (noche):** Vercel **ya despliega**. Verificado vía
> `gh api repos/gtrespana-bit/camperocasion/deployments`: 17 deployments, con
> Production en cada push a `main` (último sobre `8dc0728`, merge del PR #6).
> Lo que falta ahora es **el dominio** (ver §6-bis) y las env vars (§1.3), no
> la build.

Síntoma visto el 2026-09-16 (día): proyecto creado en el dashboard, y la página
pone **«No Production Deployment — Your Production Domain is not serving
traffic»**, sin rastro de build ni log.

## 6-bis. Cambio de dominio: `camperocasion.es` → `camperocasion.online`

El 2026-09-16 se cambió el dominio canónico a **`camperocasion.online`** (el
`.es` quedó apuntando a un parking/hosting por defecto, `ui-r.com`, y nunca
llegó a servir tráfico del sitio — no hay que migrar nada). En el repositorio
se actualizaron las ~120 referencias (canonicals, hreflang, sitemap, robots,
emails, `NEXT_PUBLIC_URL` default, plantillas Supabase) y `next.config.js`
301-redirectea `vendet.online` y `camperocasion.es` (apex + www) hacia
`camperocasion.online`.

Pendiente **fuera del código**:

1. **Vercel → Project → Settings → Domains**: añadir `camperocasion.online` y
   `www.camperocasion.online`.
2. **DNS en el proveedor del dominio** (donde se compró el `.online`):
   - `www` → `CNAME` `cname.vercel-dns.com`
   - `@` (apex) → `CNAME` `cname.vercel-dns.com` (Vercel hace *CNAME
     flattening*; si el registro no lo permite, `A` `76.76.21.21`)
   - Vercel muestra los registros exactos y los verifica automáticamente.
3. **Env var `NEXT_PUBLIC_URL`** = `https://camperocasion.online` en Vercel
   (Production + Preview) y **redeploy**: se incrusta en el bundle en build
   time. (El default del código ya es `.online`, pero mejor tenerla puesta.)
4. **Supabase → Authentication → URL Configuration**: Site URL =
   `https://camperocasion.online` y añadir `https://camperocasion.online/confirm`
   y `https://camperocasion.online/reset-password` (o equivalentes) a Redirect
   URLs; revisar también las plantillas de email de Supabase (las de referencia
   están en `supabase-email-templates/`, ya actualizadas).
5. **Correo**: si se van a usar cajas en el dominio (soporte@, noreply@…),
   crearlas en el proveedor y dejar `EMAIL_FROM`/`CONTACTO_EMAIL` con el
   `.online` (los defaults del código ya son `.online`).
6. **Verificación tras la propagación**: home y catálogo cargando anuncios,
   `/api/diagnostico/supabase?token=<CRON_SECRET>` y `/admin` → estado.

### 6.1 Diagnóstico (dato duro, no intuición)

```bash
gh api repos/gtrespana-bit/camperocasion/deployments --jq '.[].environment'
# → (vacío)
```

En GitHub no hay **ningún** deployment ni check de "Vercel" en `main`. Vercel,
cuando intenta compilar, siempre publica un deployment + un commit status,
**aunque la build falle**. Lista vacía ⇒ Vercel **nunca llegó a lanzar una
build**: el proyecto no está importando este repo (o no se ha disparado desde
que se importó). No es un error de compilación, es que no hay nada compilado.

Dato de descarte: `npm ci && npm run build` **pasa en local en ~35 s sin
ninguna variable de entorno** ( Next 16 + next-intl + Supabase). El código está
sano; lo que falta es la conexión y las env vars.

### 6.2 Causas posibles, de más a menos probable

1. **Proyecto creado vacío** (sin *Import Git Repository*), a veces desde la
   pantalla de templates. No hay repo vinculado ⇒ cero deployments.
   → *Project → Settings → Git → Linked Git Repository*. Si dice *No
   repository connected*, hay que conectar el repo desde
   [vercel.com/new](https://vercel.com/new) eligiendo `gtrespana-bit/camperocasion`.
2. **Se importó después del último push.** Vercel solo compila los pushes
   *posteriores* a vincular el repo; si el repo ya estaba en su última commit,
   no se dispara nada. → *Project → Deployments → ⋯ (menú) → Deploy…* sobre el
   último commit de `main`, o un push vacío:
   `git commit --allow-empty -m "chore: trigger deploy" && git push origin main`.
3. **La app de GitHub de Vercel no tiene acceso a este repo.** Si al instalar
   Vercel se eligió *Only select repositories* y `camperocasion` no está en la
   lista, Vercel crea el proyecto pero no puede clonar. →
   [github.com/settings/installations](https://github.com/settings/installations)
   → Vercel → *Repository access* → añadir el repo → *Deploy*.
4. **Production Branch mal escrita.** En *Settings → Environments → Production
   branch* debe poner `main` (el repo solo tiene `main`). Si apunta a `master`,
   no hay producción.
5. **Desplegaste con la CLI sin `--prod`.** `vercel` a secas sube una *preview*
   con URL `*.vercel.app` de entorno; el dominio de producción sigue vacío.
   → `vercel --prod`.
6. **La build falló** (en este caso sí verías el despliegue en rojo en
   *Deployments*). Pásame el log y lo arreglo.

### 6.3 Antes del primer deploy: variables en Vercel

Settings → Environment Variables → Production (y Preview). Sin las dos primeras
la build pasa pero el sitio sale **vacío**, que es peor que un error porque
parece que funciona:

| Variable | Obligatoria | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | server-side; **nunca** con prefijo `NEXT_PUBLIC_` |
| `CRON_SECRET` | ✅ para los 4 crons | sin ella `/api/cron/*` responde 401 |
| `NEXT_PUBLIC_URL` | ✅ | `https://camperocasion.online` (emails, OG, sitemap) |
| `ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM` | opcional | panel y emails |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | opcional | avisos de reservas |

Lista completa y comentada en **`.env.example`** (ahora sí está versionado;
`.gitignore` lo excluye con `.env*`, se añadió la excepción `!.env.example`).

### 6.4 Ya corregido en el código para que Vercel no falle

- **`output: 'standalone'`** estaba fijo en `next.config.js`. Vercel no lo
  necesita (tiene su propio builder) y con Next 16 rompe la build con
  `ENOENT: .next/next-server.js.nft.json`. Ahora es **opt-in**:
  `NEXT_OUTPUT=standalone npm run build` (`npm run build:standalone`) solo para
  self-hosting/Docker. Idéntico en `next.config.optimized.js`.
  → No definas `NEXT_OUTPUT` en Vercel.
- Verificado: `npm run build` sigue pasando tras el cambio.

### 6.5 Crons y plan

`vercel.json` declara 4 crons (`17 3 * * *`, `23 */6 * * *`, `5 13 * * 1`,
`41 14 * * *`). Rutas existentes ✅. Ojo: en el plan **Hobby** Vercel limita las
ejecuciones diarias de cron (y cobra las que se pasan); los digests semanales y
diarios entran sin problema, pero conviene mirar *Settings → Cron Jobs* tras el
primer deploy para confirmar que los 4 aparecen activos.
