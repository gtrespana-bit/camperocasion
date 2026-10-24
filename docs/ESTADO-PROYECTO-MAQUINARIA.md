# MaquinariaOcasión — Documento de traspaso

> **Lee esto primero.** Es el punto de entrada único del proyecto. Resume qué
> estamos haciendo, qué está decidido (para no volver a preguntarlo), qué está
> hecho, qué falta y en qué orden. Última actualización: **2026-10-24**.

---

## 1. Qué estamos haciendo

Duplicamos el marketplace **CamperOcasión** (campers y autocaravanas, en
producción) para lanzar un segundo marketplace vertical: **maquinaria agrícola,
de obra y herramientas de ocasión en España**.

No se empieza de cero: se reutiliza el motor. El análisis que lo justifica está
en [`PLAN-NUEVA-WEB-MAQUINARIA.md`](./PLAN-NUEVA-WEB-MAQUINARIA.md). En resumen:

- ~70 % del código de CamperOcasión es un motor de marketplace **agnóstico al
  producto** (auth, chat, panel admin con 41 rutas, Stripe, planes, cupones,
  push, moderación, SEO programático, PWA).
- Solo ~10 % es dominio camper puro (ITP, valorador, homologación, gestoría) y
  se tira.
- El resto se adapta.
- Empezar de cero implicaría reescribir 19 tablas, **112 políticas RLS** y
  **70 funciones/triggers**: meses en vez de semanas. Y ya se hizo una vez: el
  propio CamperOcasión nació de un marketplace generalista venezolano.

**Duración estimada:** 3-5 semanas hasta una v1 usable (frente a 3-4 meses desde
cero).

---

## 2. Decisiones ya tomadas (no volver a preguntar)

| Tema | Decisión | Nota |
|---|---|---|
| Enfoque | **Duplicar, no empezar de cero** | Plan completo en `PLAN-NUEVA-WEB-MAQUINARIA.md` |
| Alcance | **Agrícola + obra + herramientas** en un solo sitio | No es solo agrícola ni solo obra |
| Alquiler | **Fuera** | Solo compraventa. El alquiler es otro modelo de datos (calendario, fianzas) |
| Marca | **`MaquinariaOcasión` como placeholder** | Nombre de trabajo. Se sustituye antes del lanzamiento; al estar centralizado, es barato |
| Dominio | **`maquinariaocasion.online` como placeholder** | **No está registrado ni comprobado.** Pendiente de compra |
| Arquitectura | **Repo nuevo, servicios nuevos** | Nada compartido con CamperOcasión: ni Supabase, ni R2, ni Stripe |
| Modelo de datos | **Se reutiliza el de `productos`** | El JSONB `especificaciones` absorbe cualquier ficha técnica sin migraciones |
| Cambio estructural | **Filtros por categoría** (`camposPorCategoria`) | Es el único refactor serio. Ver Fase 3 |
| Naming en código | Toda la identidad en **`src/lib/marca.ts`** | Nombre, dominio, correos, paleta y SEO básico |

---

## 3. Estado actual (2026-10-24)

### Repositorios

| Repo | Ruta | Estado |
|---|---|---|
| `gtrespana-bit/camperocasion` | `/home/user/camperocasion` | Producción. Aquí vive el generador de clones |
| `gtrespana-bit/maquinaria-ocasion` | `/home/user/maquinaria-ocasion` | **Creado en GitHub pero VACÍO.** El código está en local, sin subir |

### El clon, listo en local

```
/home/user/maquinaria-ocasion
  commit 209a0c9  "Esqueleto de MaquinariaOcasión"
  660 ficheros · árbol limpio · remoto origin ya configurado
```

Verificado en este entorno: `tsc --noEmit` OK · `eslint .` OK · `next build` OK
(384 páginas) · portada servida con HTTP 200 y la marca nueva.

### Copia de seguridad

```
/home/user/maquinaria-ocasion.bundle   1,9 MB   historial completo verificado
```

---

## 4. Lo único que bloquea ahora: subir el repo

**Problema:** el token de GitHub de la sesión de Arena se acuñó al inicio de la
conversación y está limitado al repo `camperocasion`. Aunque el repo nuevo ya
existe y la instalación de la app se amplió a "all repositories", **el token no
se refresca solo**: sigue dando `Resource not accessible by integration` al
escribir en `maquinaria-ocasion`.

Comprobado: leer metadatos del repo nuevo funciona, escribir un fichero no. En
`camperocasion` sí escribe (la rama de la sesión está publicada).

### Opción A — Reconectar GitHub en Arena (recomendado)

1. Desconectar y volver a conectar GitHub en Arena.
2. Esto acuña un token nuevo con el alcance actualizado.
3. Pedir el push. Es un solo comando:

```bash
cd /home/user/maquinaria-ocasion && git push -u origin main
```

Comprobar después:

```bash
gh repo view gtrespana-bit/maquinaria-ocasion --json isEmpty,pushedAt
git ls-remote origin main        # debe devolver el SHA 209a0c9...
```

### Opción B — Subirlo desde tu máquina

```bash
git clone maquinaria-ocasion.bundle maquinaria-ocasion
cd maquinaria-ocasion
git remote set-url origin https://github.com/gtrespana-bit/maquinaria-ocasion.git
git push -u origin main
```

El bundle ya trae el commit completo y el remoto configurado.

### Opción C — Crear una rama en el repo de camperocasion

Técnicamente posible y funciona hoy mismo (el token sí escribe ahí), pero **no
recomendado**: mezcla dos productos en un repo, comparte CI y despliegue, y hay
que separarlo después. Solo como último recurso.

### Antes de hacer el push

- El repo está **público** (`isPrivate: false`). Si quieres privado:
  *Settings → General → Danger Zone → Change visibility*.
- Al estar vacío, la rama por defecto pasará a `main` con el primer push, y el
  CI se disparará solo (tipos, lint, tests y el job `sql` que aplica
  `setup-maquinariaocasion.sql` en un Postgres real).

---

## 5. Roadmap

El detalle está en el clon, en `docs/ESTADO-CLON.md`, con casillas para ir
tachando. Aquí va el resumen y el orden.

### ✅ Fase 1 — Esqueleto (HECHA)

Generada con `tools/clon-vertical/preparar-clon.mjs`. Marca y dominio nuevos,
identidad centralizada en `src/lib/marca.ts`, `next.config.js` con los 301
propios, `.env.example` reescrito, `package.json`, manifest PWA, metadata raíz y
de portada, paleta ámbar, logo/iconos/OG/hero/placeholder nuevos. Fuera: fotos
semilla de campers, hero camper y los `assetlinks` de la TWA.

### ⬜ Fase 2 — Limpieza del dominio camper (3-5 días)

Borrar lo que solo tiene sentido en camper. **Hacerlo en un solo PR y compilando
al final**: header, footer, home y sitemap enlazan a estas rutas.

- Páginas: `calcular-itp`, `compra-segura-camper`, `cuanto-vale-mi-camper`,
  `gestoria-cambio-nombre`, `contrato-compraventa`, `comprar-a-camperizadores`
- Librerías: `itp.ts`, `contrato.ts`, `gestoria.ts`, `inspecciones.ts`,
  `verificacion-homologacion.ts`, `valoracion.ts`, `precios-mercado.ts`
- API: `documentos-vehiculo`, `gestoria`, `inspecciones`
- Admin: pestañas *Homologación*, *Gestoría*, *Inspecciones*
- Seeder: `scripts/semilla-*` y `api/admin/semilla`
- Restos de vocabulario: `grep -rniE "camper|autocaravana|homologaci|dgt"` → adecuar, no borrar a ciegas

> El sello "homologación verificada" **no se pierde**: se reconvierte en
> "documentación verificada" (CE, libro de instrucciones, factura), que en
> maquinaria usada vale incluso más que en camper.

### ⬜ Fase 3 — Taxonomía y filtros (5-8 días) ← el núcleo

**Camper es homogéneo; la maquinaria no.** Hoy `FILTROS_TECNICOS` es una lista
plana y global (16 filtros: DGT, homologación, plazas para dormir, placa
solar…). Si se copia tal cual, un anuncio de un taladro pedirá "plazas para
dormir".

```
HOY:     FILTROS_TECNICOS: FiltroTecnico[]
MAÑANA:  camposPorCategoria: Record<slug, FiltroTecnico[]>
```

- `src/lib/categorias.ts`: familias → categorías → subcategorías propias
  (agrícola / obra / herramientas)
- `src/lib/filtros-tecnicos.ts`: campos **por categoría**
- `src/lib/marcas.ts`: fabricantes de maquinaria (Kubota, New Holland, John
  Deere, Case, JCB, Bobcat, Takeuchi, Honda, Stihl, Husqvarna, Makita, Bosch…)
- `/publicar`: formulario dinámico según categoría
- Ficha de producto: bloques técnico / estado / documentación / logística
- **La consulta no cambia**: sigue siendo contención JSONB (`@>`) contra el
  índice GIN. Cero migraciones de datos.
- `CatalogFilters`, `useProductLoader` y `usePrefetch` deben seguir leyendo del
  **mismo** registro (es lo que evita el bug de páginas que "comen" filas)

Campos transversales: `Año`, `Horas de uso` (el equivalente a kilómetros),
`Estado`, `Combustible`, `Potencia (CV)`, `Peso (kg)`, `¿Incluye transporte?`,
`Documentación`.

### ⬜ Fase 4 — Marca, textos y SEO (4-6 días)

- Logo e iconos definitivos (hoy son placeholder)
- `og-image.webp`, `pwa-tagline.webp` e imágenes de home
- Diccionarios `src/i18n/dictionaries/{es,en}.json` (1.179 líneas cada uno)
- `textos-legales.ts`: revisión legal de la actividad
- `categorias-seo.ts` y `ubicaciones-seo.ts`: copy de la nueva vertical
- **El copy visible de la portada sigue siendo camper** (hero, navegación,
  categorías, secciones). Solo están cambiados la marca y la metadata.
- Search Console + sitemaps del dominio nuevo

### ⬜ Fase 5 — Contenido y lanzamiento

- **30-50 anuncios reales antes de abrir.** Un marketplace vacío no convierte y
  Google tarda en confiar en él
- Fotos optimizadas con `npm run optimize-images`
- Landings por marca y por provincia

---

## 6. Servicios externos a crear (nada compartido con camper)

| Servicio | Variable | Nota |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` | **Proyecto nuevo.** Ejecutar `setup-maquinariaocasion.sql` |
| Cloudflare R2 | `R2_*` | Bucket nuevo para fotos |
| Stripe | `STRIPE_*` | Cuenta o precios propios |
| Resend / SMTP | `RESEND_API_KEY` | Dominio verificado |
| Web Push | `VAPID_*` | `npm run generate-vapid-keys` |
| Telegram | `TELEGRAM_*` | Avisos internos |
| Google Analytics | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Propiedad nueva |
| Datos fiscales | `NEXT_PUBLIC_TITULAR_*` | Sin esto el aviso legal sale con `noindex` (por diseño) |

Checklist completa con comentarios en el `.env.example` del clon.

---

## 7. Cómo se generan verticales nuevas

El generador vive en **este repo** (camperocasion), no en el clon:

```bash
# genera ../maquinaria-ocasion desde cero
node tools/clon-vertical/preparar-clon.mjs

# otra vertical distinta
node tools/clon-vertical/preparar-clon.mjs --destino ../otra-vertical --forzar
```

```
tools/clon-vertical/
├── marca.json            # nombre, dominio, correos, paleta, SEO y vertical
├── preparar-clon.mjs     # generador, sin dependencias externas
└── plantillas/           # logo, iconos, OG, hero y placeholder neutros
```

Para cambiar de marca: editar `marca.json` y volver a ejecutar. **No editar el
clon a mano en lo que respecta a identidad.**

### Dos fallos que el generador corrige y que el renombrado manual repite

1. **El service worker se borraba a sí mismo.** Al cambiar la marca, la lista de
   cachés retiradas pasaba a contener el prefijo de su propia caché y `activate`
   la eliminaba. En un dominio nuevo la lista nace vacía.
2. **La metadata de portada no viene del layout raíz.**
   `app/[locale]/page.tsx` define su propio `generateMetadata`; cambiar solo el
   layout dejaba el `<title>` con el copy anterior.

---

## 8. Reglas del proyecto (lecciones aprendidas)

1. **Nada compartido con CamperOcasión.** Un borrado en pruebas con la misma
   base de datos se lleva anuncios reales.
2. **No reutilizar copy entre los dos dominios.** Contenido duplicado entre
   dominios propios penaliza a los dos.
3. **La identidad va en `src/lib/marca.ts`.** En CamperOcasión estaba escrita a
   mano en 125 ficheros; cambiarla costaba una semana.
4. **Los filtros, por categoría.** Es el error que se paga caro en la fase de
   contenido, cuando ya hay 500 anuncios cargados.
5. **Comprobar el build antes de dar una fase por cerrada**, no después.
6. **`engines.node` es `>=24.22.1 <25`** con `engine-strict=true`. En el sandbox
   (Node 22) hay que usar `npm ci --ignore-scripts --engine-strict=false`; en
   local con `.nvmrc` y en Vercel no hace falta.
7. **El repo nuevo está público.** Decidir visibilidad antes de meter contenido
   o claves de ejemplo.

---

## 9. Comandos de referencia

```bash
# Este repo (camperocasion)
cd /home/user/camperocasion
git log --oneline -3        # 0dac0be generador · 46059b2 plan

# El clon
cd /home/user/maquinaria-ocasion
git log --oneline -1        # 209a0c9 Esqueleto de MaquinariaOcasión
npm ci --ignore-scripts --engine-strict=false
npx tsc --noEmit && npx eslint . && npx next build
npx next start -H 0.0.0.0 -p 3000     # preview en http://localhost:3000

# Publicar el clon (cuando el token lo permita)
git push -u origin main

# Regenerar el bundle de respaldo
git bundle create /home/user/maquinaria-ocasion.bundle --all
```

---

## 10. Siguiente acción concreta

1. **Desbloquear el push** (§4). Es lo único que impide cerrar la Fase 1.
2. Verificar que el CI del repo nuevo pasa en verde.
3. Empezar la **Fase 3** (taxonomía y filtros) o la **Fase 2** (limpieza), en
   ese orden si hay prisa por ver la web con contenido real: la taxonomía
   define cómo se publica, y la limpieza se puede hacer después sin bloquear.
