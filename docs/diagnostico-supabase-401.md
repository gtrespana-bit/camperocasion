# 401 «Invalid API key» — diagnóstico y arreglo

> Cuando el catálogo dice **«No se pudieron cargar los productos / Invalid API
> key»**, el problema **no es la base de datos**: es que las claves que hay en
> Vercel no son las que espera el proyecto de Supabase. Tener la base vacía es
> normal al empezar; ver *Invalid API key* no lo es.

---

## 1. Síntomas (todos a la vez)

| Dónde | Qué se ve |
|---|---|
| Catálogo / home / landings | «No se pudieron cargar los productos» + «Invalid API key» |
| Consola (F12) | `GET https://<ref>.supabase.co/rest/v1/productos?…` → **401** |
| `/api/anuncios/active` | 500 con `{"error":"Invalid API key"}` *(ya no: ver §5)* |
| Login / registro | también fallan: el Auth usa la misma clave pública |
| `/admin` | no se puede entrar, así que no sirve para diagnosticar |

Que falle **todo** —incluido el login— es la pista: no es RLS, ni una tabla que
falta, ni un filtro. Es la credencial.

---

## 2. Diagnóstico en 30 segundos

Abre en el navegador:

```
https://<tu-dominio>/api/diagnostico/supabase?token=<CRON_SECRET>
```

Si no has definido `CRON_SECRET` en Vercel, funciona sin token (es justo el
escenario roto en el que más falta hace).

El endpoint **nunca devuelve el valor de ninguna clave**: solo el tipo, la
longitud, los claims del payload (`role`, `ref`, `exp`) y el resultado real de
una llamada a Supabase con cada una.

Ejemplo de respuesta (recortada):

```jsonc
{
  "ok": false,
  "proyecto": { "url": "https://jmbkqelkusxjebsdnjoc.supabase.co", "ref": "jmbkqelkusxjebsdnjoc" },
  "variables": {
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": true,
    "SUPABASE_SERVICE_ROLE_KEY": true
  },
  "claves": {
    "publica": { "tipo": "jwt", "role": "anon", "ref": "proyectofake00000000",
                 "refCoincide": false, "expirada": false, "tieneEspacios": false,
                 "problemas": ["La clave pertenece a OTRO proyecto (ref \"proyectofake00000000\")…"] },
    "privada": { "tipo": "jwt", "role": "service_role", "ref": "proyectofake00000000", "refCoincide": false }
  },
  "pruebas": {
    "publica": { "status": 401, "mensaje": "Invalid API key", "ms": 120 },
    "privada": { "status": 401, "mensaje": "Invalid API key", "ms": 95 }
  },
  "diagnostico": ["Las DOS claves son rechazadas por Supabase: …"],
  "pasos": ["Supabase → Settings → API Keys → copia la clave pública…", "…"]
}
```

### Cómo leerlo

| Campo | Sano | Roto |
|---|---|---|
| `claves.publica.refCoincide` | `true` (o `null` si usas claves `sb_*`, que no llevan ref) | `false` → la clave es de **otro proyecto** |
| `claves.*.role` | `anon` la pública, `service_role` la privada | `null` → pegaste el **JWT Secret**, no una API key |
| `claves.*.tieneEspacios` | `false` | `true` → se coló un salto de línea/espacio al copiar |
| `claves.*.expirada` | `false` | `true` → clave caducada |
| `pruebas.*.status` | **200** | 401/403 → rechazada; `null` → no hubo respuesta HTTP (red, no claves) |
| `variables.variablesNuevasSinUsar` | `[]` | si aparece `SUPABASE_SECRET_KEY`, el valor está en una variable que el código no lee |

---

## 3. Arreglo (5 minutos)

1. **Supabase** → *Project Settings → API Keys*.
   - Pestaña **Publishable and secret API keys** (formato `sb_publishable_…` /
     `sb_secret_…`) → son las recomendadas en 2026.
   - O pestaña **Legacy API keys** → `anon` y `service_role` (JWT `eyJ…`), que
     siguen funcionando.
2. **Vercel** → *Project → Settings → Environment Variables*:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la **publishable / anon**.
   - `SUPABASE_SERVICE_ROLE_KEY` = la **secret / service_role** (sin
     `NEXT_PUBLIC_`: esa va al navegador y daría acceso total).
   - Marca **Production + Preview**. Sin espacios ni comillas alrededor.
3. **Redeploy.** Las variables `NEXT_PUBLIC_*` se incrustan en el bundle en
   *build time*: guardarlas no basta, hay que reconstruir
   (*Deployments → ⋯ → Redeploy*).
4. Vuelve a abrir `/api/diagnostico/supabase?token=…`: ambas `pruebas` deben
   decir `"status": 200` y `"ok": true`.

### Causas más frecuentes

| Causa | Pista en el informe |
|---|---|
| Claves **rotadas o desactivadas** en el panel | `status: 401` en las dos pruebas, `refCoincide: true` |
| Claves copiadas de **otro proyecto** | `refCoincide: false` |
| Se pegó el **JWT Secret** (Settings → API → *JWT Settings*) | `role: null` → «has pegado el JWT Secret…» |
| Espacio / salto de línea al copiar | `tieneEspacios: true` |
| Clave recortada por el portapapeles | `longitud` sospechosa (un anon JWT mide ~200; `sb_publishable_…` ~50) |
| Se pusieron las **cruzadas** | «Rol cruzado: se esperaba anon…» |
| Se usaron los nombres **nuevos** (`SUPABASE_SECRET_KEY`) | aparece en `variablesNuevasSinUsar` |
| Claves legacy **caducadas** | `expirada: true` |

---

## 4. Migración a las claves nuevas (recomendada)

Supabase retira las claves legacy (`anon` / `service_role`) a finales de 2026:

- El cambio es **aditivo**: crear las nuevas no invalida las legacy, y ambas
  funcionan a la vez.
- `sb_publishable_…` sustituye a `anon`; `sb_secret_…` sustituye a
  `service_role`. No son JWT: son cadenas cortas con checksum.
- En esta app basta con pegar el valor nuevo en la **misma variable**
  (`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) y redeployar.
  El código no necesita cambios: es `supabase-js` quien las envía.

Cuando esté todo verde, desactiva las legacy en Supabase → *Settings → API
Keys* (es reversible).

---

## 5. Qué se ha tocado en el código para que esto no duela tanto

| Antes | Ahora |
|---|---|
| `/api/anuncios/active` devolvía **500** en cada carga de página | Devuelve `200 {ok:true, anuncio:null}` y registra un aviso con prefijo `[supabase-credenciales]` / `[supabase-red]` |
| El catálogo mostraba el texto crudo de Supabase («Invalid API key») | Muestra `catalog.serviceUnavailable` («El catálogo no está disponible en este momento…»), traducido |
| No había forma de saber qué clave fallaba sin entrar al panel | `GET /api/diagnostico/supabase?token=<CRON_SECRET>` |
| — | `src/lib/supabase-diagnostico.ts` con helpers puros + 30 tests unitarios |

Ficheros:

- `src/lib/supabase-diagnostico.ts`
- `src/app/api/diagnostico/supabase/route.ts`
- `src/app/api/anuncios/active/route.ts`
- `src/hooks/useProductLoader.ts`, `src/app/[locale]/catalogo/CatalogoPage.tsx`
- `tests/unit/supabase-diagnostico.test.ts`

> El endpoint de diagnóstico es una herramienta de incendios: cuando el sitio
> esté estable, bórralo (`src/app/api/diagnostico/supabase/route.ts`).
