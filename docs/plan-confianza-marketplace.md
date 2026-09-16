# Plan de aplicación: de tablón de anuncios a marketplace de confianza

> Cómo aterrizamos los 6 pilares del "marketplace ganador" sobre el código
> actual de CamperOcasión (Next.js + Supabase). Septiembre 2026.

## 0. Diagnóstico: dónde estamos hoy

| Pilar | Estado | Qué ya existe en el repo |
|---|---|---|
| 1. Validador de homologaciones | 🟡 Medio | Campo `Homologación` (2448/3148 Vehículo Vivienda, Turismo 1000, Mixto 3100, Furgón 2400) en `especificaciones` JSONB (`src/lib/categorias.ts`). **Falta**: subir ficha técnica, revisión, badge. |
| 2. Inspección a domicilio | 🔴 Nada | Solo chat, reportes y reseñas post-venta. |
| 3. Venta + alquiler P2P | 🔴 Nada | — |
| 4. Filtros de arquitectura furgonetera | ✅ Hecho (2026-09) | 16 filtros técnicos en el catálogo, agrupados en mecánica/habitabilidad/autonomía, y captura de tracción, MMA, longitud y altura exterior en `/publicar`. Registro único en `src/lib/filtros-tecnicos.ts`. Ver §2.1. |
| 5. Escrow + financiación | 🔴 Nada | Solo créditos para destacar con pago manual (Bizum/transferencia/PayPal + comprobante). |
| 6. Gestoría digital | 🔴 Nada | Ni calculadora ITP ni contrato de compraventa. |

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

- Filtros por rango numérico (`kilómetros máximos`, `año mínimo`, watios de
  placa/inversor). Requieren comparar números, no texto: o se capturan como
  tramos (como MMA/longitud/altura) o se añaden columnas generadas.
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

### 2.2 Badge "Homologación Verificada" (versión manual)

Sin OCR, sin IA — el volumen inicial no lo justifica:

1. Nuevo bucket privado `documentos-vehiculo` (RLS: owner inserta, admin lee).
2. En `/publicar` y `/producto/editar`: uploader opcional de **ficha técnica
   (anexo I)**, proyecto de homologación y última ITV.
3. Columna en `productos`: `verificacion_homologacion` (`sin_verificar` /
   `pendiente` / `verificada` / `rechazada`).
4. El admin revisa en el panel existente (`/admin`) y aprueba → aparece el
   badge en `ProductCard` y ficha (mismo patrón que `BadgeVerificado`).
5. Filtro "Solo homologación verificada" en catálogo.

Esto ya nos diferencia de Wallapop/Coches.net desde el día 1: **nadie más
filtra por "camper legal para 4 plazas de dormir"**.

### 2.3 Calculadora ITP + checklist de documentación (SEO + utilidad)

- Página `/calcular-itp`: precio + CCAA + antigüedad → tipo aplicable y
  estimación. Tabla de tipos configurable por CCAA (se actualiza cada año;
  típicamente entre ~4% y ~10% con reducciones por antigüedad — mantener en
  config, no hardcodear).
- Checklist de compra segura (permiso de circulación, ficha técnica, ITV en
  vigor, certificados de reformas, contrato) como contenido estático con
  landings por CCAA — encaja con la estrategia de landings provinciales ya
  existente y captura búsquedas como "impuesto comprar camper segunda mano
  andalucía".

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

### 4.1 Inspección: primero concierge, luego red

**Concierge (mes 3-5):** alianza con 2-3 camperizadores/talleres por ciudad.
Botón "Solicitar inspección" en la ficha → tabla `solicitudes_inspeccion` →
el equipo coordina email/teléfono. Precio fijo 150-250 €, comisión ~20%.
Con esto validamos demanda y precio sin construir casi nada.

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

- Generador de **contrato PDF** autofirmado con los datos del anuncio y de las
  partes (100% software, sin partner).
- Cambio de nombre DGT vía gestoría partner con fee (89-149 €): el usuario
  rellena el formulario, la gestoría tramita. Integración con API de gestoría
  o, al principio, reenvío manual.
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
   con índice GIN (ver §2.1). Queda para la siguiente iteración lo listado como
   pendiente en ese apartado (rangos numéricos y normalización de claves).
2. ▶️ `feat/verificacion-homologacion` — **siguiente**: bucket
   `documentos-vehiculo`, columna `verificacion_homologacion`, uploader,
   revisión admin, badge en card/ficha.
3. `feat/calculadora-itp` — página + landings CCAA + checklist de compra
   segura.
