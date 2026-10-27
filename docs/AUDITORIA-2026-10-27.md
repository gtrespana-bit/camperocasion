# Revisión de la auditoría externa — 2026-10-27

Se contrastaron los 8 puntos contra el código real del repositorio (no contra
fragmentos citados). Resultado: **3 puntos ciertos, 2 parciales, 3 falsos**. Se
han corregido los problemas reales y se han añadido tests que fallan si vuelven
a aparecer. Además aparecieron **3 fallos que la auditoría no mencionó**.

| # | Veredicto | Acción |
|---|-----------|--------|
| 1. `aplicar_cupo_planes` ejecutable por cualquiera | ✅ Cierto (con matices) | Corregido |
| 2. Condición de carrera en pausación | ❌ Falso | Sin cambio (test de regresión) |
| 3. Fallback silencioso de `especificaciones` | ⚠️ Parcial | Endurecido |
| 4. Triple escritura de precio | ❌ Falso | Sin cambio (test de regresión) |
| 5. Moderación burlable | ⚠️ Parcial (faltaba la mitad) | Corregido |
| 6. Cache poisoning por nuevo filtro | ❌ Falso | Sin cambio (sí se corrigió otro caso real) |
| 7. Rate limiting solo por usuario | ✅ Cierto | Corregido |
| 8. Telegram sin retry/timeout | ✅ Cierto | Corregido |

---

## 1. P0 — Permisos de `aplicar_cupo_planes()` — CORREGIDO

**Lo que dice el informe es correcto en la conclusión, no en la razón.**
`REVOKE ALL ... FROM PUBLIC` **sí** retira el `EXECUTE` que PostgreSQL da por
defecto a `PUBLIC` (así lo documenta el propio repo en
`docs/ESTADO-2026-09-22.md`). El problema real es que Supabase mantiene
`GRANT`s **explícitos** por defecto sobre las funciones de `public` para
`anon`, `authenticated` y `service_role`; un revoke a `PUBLIC` no retira esos
grants nominales. Todas las demás funciones de servidor del proyecto
(`check_rate_limit_atomic`, `acreditar_pago_stripe`, `analitica_visitas`,
`rendimiento_vendedor`) revocan de los **tres** roles; la migración de dunning
era la única que no lo hacía.

Además, la función es `SECURITY DEFINER` y acepta `p_ahora` del llamante: un
atacante podía pasar una fecha futura para caducar pruebas/packs ajenos.

**Cambios**

- `202610220001_planes_prueba_gracia_dunning.sql`: revoke de
  `public, anon, authenticated`.
- Migración nueva `202610270001_permisos_aplicar_cupo_planes.sql`: recrea la
  función con guardia interna que lee `request.jwt.claim.role` /
  `request.jwt.claims` y rechaza (SQLSTATE `42501`) cualquier JWT que no sea
  `service_role`. El SQL directo sin JWT sigue funcionando para mantenimiento.
- `scripts/verify_cupo_planes_sql.py`: reproduce el fallo (simulando los grants
  de Supabase), aplica el parche y comprueba con
  `has_function_privilege()` los tres roles. Se ejecuta desde
  `scripts/validate_migrations_sql.py`.

## 2. P0 — "Condición de carrera en pausación" — FALSO

El CTE citado (`productos_activos_con_cupo`, `ORDER BY destacado_hasta,
boosteado_en`) **no existe en este repositorio**. La función real usa:

```sql
orden as (
  select ..., row_number() over (partition by pr.user_id order by destacado, visitas, creado_en)
  from public.productos pr
  join cupos c on c.id = pr.user_id
  where pr.activo is true ...   -- ← ya excluye los pausados
)
```

`pausados` pone `activo = false`, así que una segunda ejecución no los vuelve a
contar: no desplazan el `row_number()`. Verificado en Postgres real en
`verify_cupo_planes_sql.py`:

- 1ª pasada: pausa 2, deja 1 activo (cupo gratis).
- 2ª pasada: **0 nuevas pausas**.
- Reactivando un pausado: pausa exactamente 1, no 2.

No hay nada que arreglar; sí hay un test que lo fija.

## 3. P1 — Fallback de `especificaciones` — PARCIAL, endurecido

Parte del diagnóstico no se sostiene: `especificaciones` es `jsonb` **nullable**
(migración 025) y hay categorías (repuestos, materiales) que legítimamente no
tienen ficha técnica. Esos anuncios aparecen en las búsquedas sin filtros;
simplemente no cumplen un filtro técnico que no han declarado. No son "datos
corruptos imposibles de limpiar": se pueden localizar con SQL y editar.

Lo que sí era peligroso: el fallback se disparaba con
`/especificaciones/i.test(error.message)`, es decir, con **cualquier** error de
trigger/CHECK/JSON que mencionara la columna → segundo `INSERT` con posible
duplicado y fallo real escondido. Y era 100 % silencioso.

**Cambios** (`src/lib/postgrest.ts`, `/api/publicar`):

- Solo se reintenta si `error.code === 'PGRST204'` **y** el mensaje dice
  exactamente `Could not find the 'especificaciones' column`.
- El anuncio degradado queda marcado con `[MIGRACION_025]` en
  `motivo_moderacion` (localizable con una query), se registra `console.error`
  y se avisa al admin por Telegram una vez por instancia.
- No se eliminó del todo el fallback: bloquear todas las publicaciones porque
  una base no aplicó la 025 sería peor para el usuario. Ahora es estricto,
  visible y reversible. La migración 025 se declara prerrequisito de deploy.

## 4. P1 — Triple escritura de precio — FALSO

`supabase/migrations/202609170001_rename_legado_camperocasion.sql` (y el
`setup-camperocasion.sql`) ya hacen exactamente lo que pide el informe:

- `precio`, `precio_eur` y `precio_usd` son **los tres `numeric(12,2)`** (no hay
  redondeos distintos).
- Existe `fn_sync_producto_precio()` + `trg_sync_producto_precio` (BEFORE
  INSERT/UPDATE) que mantiene los alias sincronizados.
- `precio_usd` está documentado como *alias deprecado en euros* y **se lee en
  producción**: `aplicarFiltrosBase()` filtra por precio con `precio_usd`, y
  también lo usan la búsqueda fulltext (`019_fulltext_search.sql`) y las
  métricas (`202610230001_rendimiento_vendedor.sql`).

Seguir la recomendación de dejar de escribirlo rompería el filtro por precio en
cualquier base donde el trigger no esté aplicado. Se mantuvo y se añadió un
comentario explicativo + test estático que vigila tipos y trigger.

## 5. P2 — Moderación — PARCIAL, corregido lo que faltaba

El informe proponía como novedades dos cosas que ya existían: normalización
`NFD` + strip de diacríticos y coincidencia por palabra/frase completa con
`\s+` entre palabras (`contieneTerminoCompleto`). Sí eran reales los
siguientes huecos, ya cerrados en `src/lib/moderacion.ts`:

- Homoglifos cirílicos/griegos, **zero-width characters** y caracteres de
  formato.
- Leetspeak (`c0c41n4`, `1sd`), con dos lecturas de `1` (i/l) y sin confundir
  el término `c4` con la palabra legítima `CA` (corriente alterna).
- Separadores artificiales (`c.o.c.a.i.n.a`, `c o c a i n a`,
  `Venta de d.r.o.g.a.s`), con tres variantes de desofuscación para no perder
  los límites de palabra.
- Nueva `verificarContenidoCampos()` que modera título y descripción **por
  separado y concatenados** (`VEN` + `TA DE DROGAS` ya se detecta). Se usa en
  el formulario, `/api/publicar`, `/api/productos/editar` y
  `/api/productos/importar`.

Pendiente de decisión de producto: la segunda capa con API externa de
moderación (OpenAI Moderation / Perspective) requiere API key y revisión de
privacidad; no se puede activar desde el código sin eso.

## 6. P3 — Cache poisoning por filtro nuevo — FALSO (pero había otro caso real)

`clientCache.generateKey()` hace
`JSON.stringify(Object.entries(filters).sort(...))`: serializa **todo** el
objeto de filtros, sin lista de claves escrita a mano. Añadir un filtro a
`FILTROS_TECNICOS` cambia la clave automáticamente. Además
`FILTROS_TECNICOS` es un **array**, así que `Object.keys()` sobre él daría
índices, no nombres de filtros: el test propuesto no tendría sentido aquí.

Sí se encontró y corrigió un envenenamiento de caché real: cuando la migración
de rangos (`202609170003`) no está aplicada, `useProductLoader` y `usePrefetch`
reintentan **sin** `kmMax`/`anioMin` pero guardaban el resultado bajo la clave
original (que sí los incluía). Ahora cachean bajo la clave de los filtros
realmente aplicados. Tests en `tests/unit/client-cache.test.ts`.

## 7. P2 — Rate limiting — CIERTO (y había un agujero mayor)

`check_rate_limit_atomic()` guardaba `p_ip` solo como metadato: el bucket era
siempre `(key, identifier)` y en `/api/publicar` el identificador es el
`userId`.

**Cambios**

- Migración `202610270002_rate_limit_compuesto.sql`: nueva
  `check_rate_limit_dual()` que decide **usuario + IP en una sola transacción**
  (advisory locks ordenados). Si un bucket está lleno no se consume el otro.
  IP hasheada con `md5` como identificador; solo `service_role` puede llamarla.
- `src/lib/rate-limit.ts`: `LIMITES_IP` para `producto:create` (60/h),
  `producto:importar` (18/h) y `auth:register` (15/h). Límites generosos por
  CGNAT; el cupo de anuncios por plan sigue siendo la defensa de fondo.
- **Hallazgo nuevo:** 6 claves usadas por rutas no tenían entrada en `LIMITS`,
  y `checkRateLimit` devolvía `ok: true` (es decir, **sin límite**) para
  claves desconocidas. Entre ellas `auth:password-reset` (la ruta usa ese
  nombre, pero `LIMITS` solo tenía `auth:reset`), `planes:prueba`,
  `planes:portal`, `inspeccion:create`, `gestoria:lead` y
  `admin:email-test`. Ahora están definidas, una clave desconocida **falla
  cerrado** y un test recorre `src/` para que ninguna llamada se quede sin
  límite.
- **Hallazgo nuevo:** 10 rutas leían `x-forwarded-for` a mano (falseable por el
  cliente). Todas usan ahora `getClientIp()`, que prioriza
  `x-vercel-forwarded-for` y normaliza la cadena de proxies.

## 8. P3 — Telegram — CIERTO, corregido

El `fetch` inline de `/api/publicar` no tenía timeout y hacía
`.catch(() => {})`. Ahora usa `notificarAdminTelegram()` con
`AbortSignal.timeout(5 s)`, 1 reintento en errores de red/429/5xx y logging de
fallos; se añadió el mismo timeout a otros 7 `fetch` inline de Telegram en
distintas rutas.

No se creó la tabla `alertas_pendientes`: la señal duradera **ya existe** —el
anuncio se guarda con `estado_moderacion = 'pendiente'` y aparece en el panel
de administración—. Si Telegram cae se pierde el aviso rápido, no la cola de
revisión.

---

## Despliegue

1. Aplicar en Supabase (SQL Editor, en este orden):
   - `supabase/migrations/202610270001_permisos_aplicar_cupo_planes.sql`
   - `supabase/migrations/202610270002_rate_limit_compuesto.sql`
2. Verificar con `scripts/verificar_despliegue.sql` (3 comprobaciones nuevas) o
   con `python3 scripts/verify_cupo_planes_sql.py`.
3. No hacen falta variables de entorno nuevas.

## Verificación ejecutada

- `npx jest --config jest.unit.config.js --runInBand` → **73 suites, 811 tests OK**.
- `npx tsc --noEmit` → sin errores.
- `npx eslint .` → sin errores.
- `npx next build` → completa (con variables de entorno ficticias).
- `python3 scripts/validate_migrations_sql.py` → 21 migraciones / 345
  sentencias + verificadores de analítica, rendimiento y el nuevo de cupos.
- `python3 scripts/verificar_despliegue_sql.py` → 35/35 comprobaciones.
