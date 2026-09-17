# Plan de aplicación: de tablón de anuncios a marketplace de confianza

> Cómo aterrizamos los 6 pilares del "marketplace ganador" sobre el código
> actual de CamperOcasión (Next.js + Supabase). Septiembre 2026.

## 0. Diagnóstico: dónde estamos hoy

| Pilar | Estado | Qué ya existe en el repo |
|---|---|---|
| 1. Validador de homologaciones | 🟢 Alto (2026-09) | Expediente documental del vehículo: bucket privado `documentos-vehiculo`, tabla `documentos_vehiculo`, columna `productos.verificacion_homologacion`, revisión manual en `/admin` y sello en card/ficha. **Falta** (fases siguientes): OCR/validación automática y consulta a la DGT. Ver §2.2. |
| 2. Inspección a domicilio | 🔴 Nada | Solo chat, reportes y reseñas post-venta. |
| 3. Venta + alquiler P2P | 🔴 Nada | — |
| 4. Filtros de arquitectura furgonetera | ✅ Hecho (2026-09) | 16 filtros técnicos en el catálogo, agrupados en mecánica/habitabilidad/autonomía, y captura de tracción, MMA, longitud y altura exterior en `/publicar`. Registro único en `src/lib/filtros-tecnicos.ts`. Ver §2.1. |
| 5. Escrow + financiación | 🔴 Nada | Solo créditos para destacar con pago manual (Bizum/transferencia/PayPal + comprobante). |
| 6. Gestoría digital | 🟡 Medio (2026-09) | Calculadora de ITP con los 19 territorios, 19 landings por comunidad y checklist de compra segura (`/calcular-itp`, `/compra-segura-camper`). **Falta**: contrato de compraventa descargable y gestoría del cambio de nombre. |

**Ya tenemos además** (activos sobre los que construir): vendedor verificado con
badge (`BadgeVerificado.tsx` + `solicitudes_verificacion`), moderación, reseñas,
chat con rate-limit, búsquedas guardadas con alertas push, landings SEO
provinciales, i18n es/en.

## 1. Principio rector: la confianza son capas, y cada capa es un producto

```
Capa 1 (documental)   → "Este anuncio es legal"        → software puro, barato
Capa 2 (física)       → "Este vehículo está como dice"  → servicio con peritos
Capa 3 (transaccional)→ "Tu dinero está protegido"      → dinero regulado, partner
```

El error clásico es empezar por la capa 3 (escrow): es lo más caro, lo más
regulado y no sirve de nada sin anuncios verificados ni inspecciones que
generen confianza. El orden correcto **minimiza riesgo y maximiza aprendizaje**:

1. **Fase 0 — Quick wins (2-3 semanas de trabajo, solo software):**
   filtros técnicos en catálogo, badge de homologación verificada con revisión
   manual, calculadora ITP + checklist de venta segura.
2. **Fase 1 — Confianza documental (1-2 meses):** expediente del vehículo
   (ficha técnica, ITV, proyecto de homologación), flujo de revisión en el
   panel admin, señal de reserva online.
3. **Fase 2 — Confianza física (2-4 meses):** inspección a domicilio concierge
   → red de inspectores con informe de 50 puntos, contrato PDF, gestoría
   partner, financiación para vendedores profesionales.
4. **Fase 3 — Transacción completa (6-12 meses):** escrow con entidad de pago
   licenciada, alquiler P2P con seguro por días.

---

## 2. Fase 0 — Quick wins (solo código, sin partners, sin riesgo legal)

### 2.1 Filtros técnicos en el catálogo ✅ (hecho)

**Implementado en septiembre de 2026.** Estado final:

- Nuevo registro único `src/lib/filtros-tecnicos.ts`: qué parámetro de la URL
  (`?plazasDormir=4`) corresponde a qué clave del JSONB `especificaciones`, en
  qué grupo se muestra y con qué opciones. Las opciones salen de las mismas
  listas que usa el formulario de publicación (`categorias.ts`), así que captura
  y filtro no pueden divergir; hay un test que lo comprueba subcategoría a
  subcategoría.
- 16 filtros en tres bloques: **mecánica** (DGT, homologación, combustible,
  tracción, MMA, longitud, altura), **habitabilidad** (plazas para viajar,
  plazas para dormir, calefacción, agua caliente, baño/ducha) y **autonomía**
  (batería auxiliar, placa solar, inversor 220V, nevera).
- Consulta: una sola condición de contención
  `especificaciones @> '{"Plazas para dormir":"4", ...}'` (supabase-js
  `.contains()`), que es el operador cubierto por el índice GIN
  `productos_especificaciones_idx`. Antes se filtraba con
  `especificaciones->>'Campo' = 'valor'`, que **no usa ese índice** y añadía una
  condición por campo.
- Campos nuevos capturados en `/publicar` y `/producto/editar`: **tracción,
  MMA (tramos con la frontera de los 3.500 kg del carnet B), longitud exterior
  y altura exterior** (tramos pensados para garaje, ferry y túneles). Se suman
  al bloque "Mecánica del Vehículo" de la ficha del producto.
- Los tres sitios que consultan el catálogo (SSR inicial, `useProductLoader` y
  `usePrefetch`) comparten ahora columnas, filtro de moderación y orden
  (`src/lib/catalog-consulta.ts`). Antes el prefetch excluía los productos
  `pendiente` y no traía `slug`, así que la caché podía servir una página
  distinta a la que pedía el loader (misma clave de caché).

**Pendiente de esta fase (siguiente iteración):**

- ~~Filtros por rango numérico (`kilómetros máximos`, `año mínimo`, watios de
  placa/inversor)~~ ✅ **hecho (2026-09-17)**: columnas GENERATED `espec_km` /
  `espec_anio` / `espec_placa_w` / `espec_inversor_w` con índice funcional. La
  comparación numérica real se hace sobre esas columnas (no sobre `->>` del
  JSONB, que compara texto alfabéticamente). Registro en
  `RANGOS_NUMERICOS` (`src/lib/filtros-tecnicos.ts`) y migración
  `supabase/migrations/202609170003_rangos_numericos.sql`. Los mismos filtros
  se ofrecen también en `/buscar`.
- Normalización de las claves del JSONB a slugs (`plazas_dormir`). **Se aplaza
  a propósito**: hoy las claves son los labels del formulario (con espacios y
  acentos) pero todas viven en un único registro, y con `@>` el índice GIN sí se
  usa. Normalizar exige migración de backfill + lectura compatible en ficha,
  formularios y filtros; hacerlo junto con la verificación de homologación
  (que también toca `especificaciones`) sale más barato.

**Cómo añadir un filtro nuevo:** (1) opciones y campo en `categorias.ts`;
(2) entrada en `FILTROS_TECNICOS` (`src/lib/filtros-tecnicos.ts`) con param,
campo, grupo y clave i18n; (3) clave en `catalog.filters.*` de
`src/i18n/dictionaries/{es,en}.json`. La barra lateral, los hooks y la
traducción a `@>` salen del registro, no hay que tocarlos.

### 2.2 Badge "Homologación Verificada" (versión manual) ✅ (hecho)

**Implementado en septiembre de 2026.** Sin OCR, sin IA — el volumen inicial no
lo justifica. Estado final:

1. **Bucket privado `documentos-vehiculo`** (10 MB, PDF/JPG/PNG/WEBP) con RLS:
   el propietario sube y lee su carpeta (`<user_id>/<producto_id>/archivo`), el
   admin lee todo y el público **solo** ve los documentos ya verificados. El
   propietario no puede marcarse nada como verificado: no tiene `UPDATE` sobre
   la tabla (igual que en `solicitudes_verificacion`).
2. **Tabla `documentos_vehiculo`**: un documento por tipo y anuncio (índice
   único), con estado por documento (`pendiente` / `verificado` / `rechazado`),
   quién lo revisó y cuándo. Se comprueba además que el anuncio sea del usuario
   (`fn_es_dueno_del_anuncio`) antes de dejarle insertar.
3. **Columna en `productos`**: `verificacion_homologacion` (`sin_verificar` /
   `pendiente` / `verificada` / `rechazada`) + motivo del rechazo y fecha de
   revisión. Índice parcial sobre los expedientes en curso.
4. **Expediente del vehículo** (`src/components/ExpedienteVehiculo.tsx`, en
   `/producto/editar/[id]`): checklist con lo que se exige según lo declarado —
   la ficha técnica y la ITV siempre; el **proyecto de homologación solo si el
   anuncio declara "Vehículo Vivienda (2448/3148)"**. Subir o reemplazar un
   documento devuelve el expediente a revisión (el sello acredita unos
   documentos concretos, no el anuncio para siempre). Tras publicar, la ficha
   del producto invita al vendedor a subirlo desde el banner de éxito.
5. **Revisión en el panel** (`/admin` → pestaña *Homologación*, FIFO por
   antigüedad del primer documento): el admin abre cada documento con URL firmada
   de 5 minutos, ve qué falta y verifica o rechaza con motivo. El cambio queda en
   `auditoria` por el trigger existente sobre `productos`.
6. **Sello en card y ficha**: `BadgeHomologacion` solo se pinta cuando hay algo
   que contar (verificado o en revisión); un anuncio sin expediente no se marca
   como si fuera dudoso. En la ficha, el comprador ve el checklist de lo
   verificado y el aviso cuando se declara vivienda sin proyecto homologado.
7. **Filtro "Solo homologación verificada"** en el catálogo: es el único filtro
   que no vive en `especificaciones` (es una columna), así que la consulta
   compartida lo aplica aparte (`aplicarFiltrosCatalogo`).

Esto ya nos diferencia de Wallapop/Coches.net desde el día 1: **nadie más
filtra por "camper legal para 4 plazas de dormir" y enseña qué documentación ha
revisado**.

**Garantías verificadas contra un Postgres real** (634 statements del setup +
comprobaciones de RLS): anon solo ve documentos verificados, un usuario no puede
subir documentos al anuncio de otro ni auto-verificarse, el admin sí puede
revisar, y el `user_id` de un documento no se puede cambiar.

### 2.3 Calculadora ITP + checklist de documentación (SEO + utilidad) ✅ (hecho)

**Implementado en septiembre de 2026.** Estado final:

1. **Registro de tipos por comunidad** (`src/lib/itp.ts`): 19 entradas (17 CCAA +
   Ceuta y Melilla) con tipo general, tipo incrementado (por potencia fiscal o
   por cilindrada), cuota fija para vehículos antiguos, exención por antigüedad,
   tipos de cero emisiones/ECO, plazo, modelo de autoliquidación, notas y
   **enlace a la sede tributaria oficial** de cada comunidad. `REVISADO_EN` deja
   constancia de la fecha de revisión: es lo único que hay que tocar cada año.
2. **Cálculo** (`calcularITP`): base imponible = **el mayor** entre el precio
   pactado y el valor de tablas de Hacienda depreciado con los coeficientes del
   anexo IV (100 % el primer año → 10 % a partir de los 12). Orden de decisión:
   exención por antigüedad → cuota fija → tipo. Devuelve las **reglas aplicadas**
   y los **avisos** (sin CV fiscales no se sabe si aplica el 8 %, con más de
   2.000 cc en la Comunitat Valenciana sí, el matiz de que las cuotas fijas
   están redactadas para "turismos y todoterrenos"…), no solo la cifra.
3. **Página `/calcular-itp`**: precio, comunidad, año de matriculación, CV
   fiscales, cilindrada, etiqueta DGT y —opcional— el precio de tablas del
   vehículo nuevo. Muestra el desglose, el coste total con la tasa de la DGT
   (55,70 €), el cálculo paso a paso y una **comparativa con las 19
   comunidades** (de los 3 % de Galicia a los 6 % de Cantabria, Castilla-La
   Mancha, Comunitat Valenciana y Extremadura).
4. **Landings por comunidad** (`/calcular-itp/{ccaa}`): 19 páginas con datos,
   notas, plazo, modelo, fuente oficial, calculadora preseleccionada, FAQ
   propia y enlazado interno entre comunidades. Objetivo de posicionamiento:
   "impuesto comprar camper segunda mano {comunidad}". Se enlazan desde el
   footer y desde el `sitemap.ts` (prioridad 0.8).
5. **Checklist de compra segura** (`/compra-segura-camper`): 10 comprobaciones
   generales + 5 específicas de camper (homologación declarada, plazas, MMA y
   carnet, instalación de gas, carga útil), con `HowTo` estructurado y los pasos
   de la operación (contrato → ITP → tasa DGT → cambio de nombre).
6. **Integración con el marketplace**: la ficha de cada anuncio enlaza a la
   calculadora con **el precio ya puesto** (`/calcular-itp?precio=`), y las
   páginas de ITP empujan al catálogo filtrado por **homologación verificada**
   (`/catalogo?verificada=1`), que es la Fase 0.2. Así la utilidad fiscal lleva
   tráfico hacia los anuncios que ya tienen el expediente revisado.
7. **Normalización de la etiqueta DGT (fix 2026-09-17)**: el cálculo comparaba
   el texto del select en mayúsculas con las formas largas ("C (Verde)"), así
   que elegir "ECO" o "Cero Emisiones" NUNCA aplicaba los tipos reducidos de
   cero emisiones/ECO (ni en el resultado ni en la comparativa por comunidad).
   `normalizarEtiquetaDGT()` (`src/lib/itp.ts`) reduce ahora cualquier forma a
   `'0' | 'ECO' | 'C' | 'B'` y el select ofrece las mismas opciones que el
   catálogo (`OPCIONES_DGT`). Si la comunidad bonifica por etiqueta y no se
   indica, el resultado lo avisa en lugar de dar el tipo general como cerrado.

**Mantenimiento:** los tipos cambian por ley autonómica (Cantabria bajó del 8 %
al 6 % en 2024 y todavía hay webs con el dato viejo). Actualizar `TIPOS_ITP`,
`REVISADO_EN` y `EJERCICIO_FISCAL` una vez al año; `tests/unit/itp.test.ts`
comprueba la forma del registro, el cálculo y la normalización de la etiqueta.

**Monetización desde la Fase 0:** el paquete "Destacado Premium" existente
(sistema de créditos) pasa a incluir la verificación de homologación → el
vendedor premium obtiene badge + verificación, y nosotros financiamos la
revisión manual.

---

## 3. Fase 1 — Expediente del vehículo y señal de reserva

### 3.1 Expediente documental del vehículo

```sql
create table if not exists public.documentos_vehiculo (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  tipo text not null check (tipo in
    ('ficha_tecnica','proyecto_homologacion','itv','certificado_kilometraje','otro')),
  archivo_url text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','verificado','rechazado')),
  notas text,
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_en timestamptz,
  creado_en timestamptz default now()
);
-- RLS: vendedor inserta/lee los suyos; admin todo. Índice por producto.
```

- Sección "Expediente verificado" en la ficha del producto con checklist
  visible para el comprador (qué documentos hay y su estado).
- Auto-check básico: si declara "Vehículo Vivienda (2448/3148)" pero no sube
  proyecto de homologación → aviso al vendedor y al comprador ("pendiente de
  verificar").

### 3.2 Señal de reserva online (mini-escrow, viable ya)

El escrow completo de 80.000 € no es viable al principio (límites de tarjeta,
SEPA, entidad de pago). Pero una **señal de 300-500 €** vía Bizum/Stripe sí:

1. Comprador pulsa "Reservar con señal" en la ficha → paga la señal.
2. El anuncio se marca como `reservado` (visible para todos).
3. La señal se descuenta del precio en la reunión presencial (reembolso si el
  vendedor cancela o el vehículo no se ajusta a lo anunciado).
4. Comisión de plataforma sobre la señal + prioridad en el flujo de gestoría.

 Esto resuelve el dolor real nº1 de los vendedores (pisos y compradores
 fantasma que "ya van en camino") y nos da un primer flujo de pago real con
 Stripe (fase 1) sin necesitar licencia de entidad de pago: la señal con
 reembolso es un cobro de servicio, no custodia de fondos del vehículo.

---

## 4. Fase 2 — Inspección a domicilio, contrato y gestoría

> **Estado (2026-09-17):** el MVP concierge de §4.1 (botón en ficha, tabla,
> cola en el panel, pestaña en el dashboard), el **generador de contrato**
> (§4.2, `/contrato-compraventa`, 100% navegador sin guardar nada) y la
> **captación de leads de gestoría** (§4.2, `/gestoria-cambio-nombre` +
> pestaña en el panel) están implementados. Migración:
> `202609170002_inspecciones_gestoria.sql`. Falta: red de inspectores con
> informe de 50 puntos (la columna `informe` jsonb ya espera) y gestoría
> partner con API.

### 4.1 Inspección: primero concierge, luego red

**Concierge (mes 3-5):** alianza con 2-3 camperizadores/talleres por ciudad.
Botón "Solicitar inspección" en la ficha → tabla `solicitudes_inspeccion` →
el equipo coordina email/teléfono. Precio fijo 150-250 €, comisión ~20%.
Con esto validamos demanda y precio sin construir casi nada.
**→ Implementado el MVP (2026-09-17)**: solicitud desde la ficha (no bloquea
el anuncio, coexiste con la reserva), flujo concierge completo en
`/admin?tab=inspecciones` (presupuestar → pago directo confirmado → en curso
→ completada/cancelada, con push al comprador en cada paso) y seguimiento en
`/dashboard?tab=inspecciones`. Sin bucket de informes todavía: el informe va
por email hasta que exista la red.

```sql
create table if not exists public.solicitudes_inspeccion (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  comprador_id uuid not null references auth.users(id) on delete cascade,
  estado text default 'solicitada' check (estado in
    ('solicitada','presupuestada','pagada','en_curso','completada','cancelada')),
  precio decimal(10,2),
  inspector_id uuid references auth.users(id) on delete set null,
  informe jsonb,            -- checklist 50 puntos: secciones + estado + fotos
  creado_en timestamptz default now(),
  completada_en timestamptz
);
```

**Red (mes 6+):** alta de inspectores colaboradores, calendario, pago online,
y el **informe de 50 puntos** estandarizado en JSONB con secciones:
motor/mecánica, chasis y humedades (higrómetro), instalación 12V/220V
(cableado, fusibles, batería), gas (estanqueidad, Fecha de revisión de la
botella), calefacción estacionaria, habitabilidad, y documentación.
El informe se publica en la ficha → anuncios con informe convierten más →
más vendedores lo piden → ciclo virtuoso.

### 4.2 Contrato de compraventa + gestoría

- ✅ Generador de **contrato PDF** (`/contrato-compraventa`): precarga los
  datos del anuncio (`?producto=<slug>`; matrícula y bastidor nunca, que no
  son públicos), cláusulas completas de compraventa ES y descarga por
  impresión del navegador. Los datos de las partes no salen del dispositivo.
- ✅ Cambio de nombre DGT, fase de captación (`/gestoria-cambio-nombre`):
  formulario de lead (sin login, validado en `src/lib/gestoria.ts`,
  rate-limitado, aviso por Telegram y email al equipo) + cola en
  `/admin?tab=gestoria`. El cobro lo hace la gestoría partner; falta
  el partner y su API (reenvío manual al principio).
- La calculadora ITP de la Fase 0 se conecta aquí: "tu ITP estimado es X,
  trámitalo con nosotros".

### 4.3 Financiación — solo para vendedores profesionales

La financiación instantánea de particulares no existe legalmente; la
financiación se da sobre concesionario/profesional. El sitio ya distingue
Particular vs **Profesional-Camperizador**: integrar financiación (Younited,
Cofidis, banca camperizadora) es un argumento de captación de profesionales
que publica flotas — el grueso de la oferta de calidad.

---

## 5. Fase 3 — Escrow completo y alquiler P2P (y por qué NO antes)

### 5.1 Escrow

En España, retener fondos de terceros exige ser entidad de pago autorizada
(Banco de España) o usar un partner licenciado con pasaporte europeo
(**Lemonway**, **Mangopay**; Stripe Connect también soporta retención de
pagos, con matices para vehículos de alto valor). Además, para importes de
15-80 k€ el flujo realista es **transferencia SEPA verificada** (open banking
para confirmar titularidad de la cuenta del vendedor), no tarjeta.
Requisito previo de negocio: las señales de la Fase 1 nos habrán dado el
volumen y la confianza para que un partner nos acepte.

### 5.2 Alquiler P2P

Lo más tentador y lo más peligroso: requiere seguro de alquiler a día
(cobertura específica, no un rider), contrato de arrendamiento, depósitos,
gestión de disputas y masa crítica de oferta concentrada (Madrid/Barcelona/
Valencia). Recomendación: **validar antes de construir** — campo "¿También te
interesaría alquilarla mientras se vende?" en el flujo de publicación para
medir demanda real. Si hay señal → MVP con 20 campers en 2-3 ciudades.

**Mid-step inteligente:** convenio con Yescapa/Indie Campers para vehículos
listados en venta (referidos cruzados) — monetizamos la intención sin el
riesgo operativo.

---

## 6. Resumen de monetización

| Pilar | Producto | Precio orientativo | Ingreso |
|---|---|---|---|
| 1 | Verificación homologación | incluida en Destacado Premium | créditos existentes |
| 2 | Inspección 50 puntos | 150-250 € | ~20% comisión |
| 5a | Señal de reserva | 300-500 € | comisión fija por reserva |
| 5b | Escrow venta completa | % de la venta | 0,5-1,5% |
| 6 | Gestoría cambio nombre | 89-149 € | margen sobre fee gestoría |
| 3 | Alquiler P2P | precio/día | 15-25% |

## 7. Métricas para saber si funciona

- % de anuncios con homologación verificada (objetivo año 1: >30%).
- % de conversaciones que terminan en solicitud de inspección o señal.
- Anuncios con informe de inspección: ratio de venta vs. sin informe.
- Tiempo medio de venta (el KPI que de verdad importa al vendedor).
- Ingreso medio por anuncio publicado (ARPA) por pilar.

## 8. Próximo paso propuesto

**Fase 0 en tres PRs independientes:**

1. ✅ `feat/filtros-tecnicos` — **hecho**: 16 filtros agrupados en catálogo,
   captura de tracción/MMA/longitud/altura, registro único y contención JSONB
   con índice GIN (ver §2.1). El cierre de la fase (rangos numéricos con
   columnas generadas + filtros en `/buscar`) quedó listo el 2026-09-17; lo
   único que sigue aplazado es la normalización de claves del JSONB a slugs.
2. ✅ `feat/verificacion-homologacion` — **hecho**: bucket
   `documentos-vehiculo`, columna `verificacion_homologacion`, expediente del
   vendedor, revisión admin (pestaña *Homologación*), sello en card/ficha y
   filtro "solo verificados" (ver §2.2).
3. ✅ `feat/calculadora-itp` — **hecho**: calculadora (`/calcular-itp`), 19
   landings por comunidad autónoma y checklist de compra segura
   (`/compra-segura-camper`), sin SQL (ver §2.3).

**Fase 0 completa.** Siguiente bloque del plan: Fase 1 (§3) — expediente
documental (ya cubierto por 0.2) y señal de reserva online.
