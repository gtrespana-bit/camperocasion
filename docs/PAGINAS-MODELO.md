# Páginas de modelo con precios reales de mercado

Implementado el 22/09/2026. **95 páginas** en `/modelo/[slug]`, una por cada
modelo del catálogo maestro (`src/lib/marcas.ts`).

## Por qué esto y no otro listado

El contenido único no son los anuncios: eso lo tiene cualquiera. Es la
**estadística de precio calculada con nuestro propio inventario**. Nadie en
España publica la mediana y el rango P25–P75 de una Fiat Ducato camper por
tramo de antigüedad. Eso es lo que hace que Google la prefiera y que un foro o
un medio la enlace.

## La regla que no se negocia

**Sin muestra suficiente no se publica ningún número.** Con menos de 5 anuncios
activos la página dice literalmente «Sin datos de precio todavía» y explica por
qué. Con 3 anuncios no hay estadística, hay anécdota — y una cifra inventada en
una página que la gente cita como referencia destruye justo el activo que
estamos construyendo.

## Decisiones de cálculo

| Decisión | Motivo |
|---|---|
| **Mediana**, no media | Un solo anuncio de 125.000 € desplaza la media y deja la página mintiendo |
| **Rango P25–P75** como «lo habitual» | El mínimo y el máximo casi siempre son un error de tecleo o una joya irrepetible |
| Precios fuera de **500 €–400.000 €** descartados | El clásico «1 €, llamar para negociar» envenenaría la muestra |
| Anuncios `es_demo` **excluidos** | Los anuncios de ejemplo no son mercado |
| Mínimo **3 anuncios por tramo** de antigüedad | La tabla sale con dos filas en vez de cuatro antes que rellenar huecos |
| Percentil por **interpolación lineal** | Es el método de las hojas de cálculo: si alguien comprueba los números con Excel, le cuadran |

Comprobado con un escenario realista de 12 anuncios (uno de 125.000 €, uno de
1 € y uno de demostración): la muestra quedó en 10, la mediana en 38.950 € y el
rango en 28.375–53.375 €. El outlier no arrastró la cifra principal.

## Qué contiene cada página

- **Titular con el dato**: «Fiat Ducato de ocasión: precios reales 2026».
- Cuatro tarjetas: precio mediano, rango habitual, kilometraje mediano y año
  mediano.
- **Tabla de precio por antigüedad** (hasta 3 años / 4-8 / 9-15 / +15).
- Explicación de *por qué* usamos mediana — transparencia metodológica, que es
  lo que hace citable un dato.
- **CTA a la calculadora de ITP** con el precio mediano precargado.
- Todos los anuncios del modelo, con buscador si hay más de 4.
- **Enlazado interno** a los modelos hermanos del mismo fabricante: es lo que
  reparte autoridad entre las 95 páginas en vez de dejarlas aisladas.
- CTA al vendedor con el precio de referencia («ya sabes lo que vale»).
- `JSON-LD` `Product` + `AggregateOffer` con `lowPrice`/`highPrice`/`offerCount`.

## Detalles técnicos

- **Prerenderizadas en build** (`generateStaticParams`) con **ISR de 1 hora**:
  las cifras se refrescan solas sin recompilar.
- El slug se deriva del **valor canónico** que ya está guardado en
  `productos.marca`, así que la URL y el filtro del catálogo no pueden
  divergir. `Citroën Jumper` → `citroen-jumper`, `Fiat Doblò` → `fiat-doblo`.
- Tests: los 95 slugs son **únicos**, limpios (`^[a-z0-9-]+$`) y resuelven de
  ida y vuelta a su modelo.
- Usa las columnas generadas `espec_km` y `espec_anio` que ya existían
  (migración `202609170003`), así que **no hace falta ninguna migración nueva**.

## Enlazado

- `/marcas` → enlace «Ver precios de mercado» en los 95 modelos.
- `sitemap.xml` → las 95 URLs con prioridad 0.8 y frecuencia diaria.

## Qué esperar

Estas páginas **no rinden desde el primer día**: necesitan que haya inventario
para tener datos y que Google las indexe. La secuencia natural es inventario →
datos → posicionamiento → tráfico → más inventario. Por eso la tienda de
profesionales (que trae inventario) iba antes que esto en el orden de trabajo.

Cuando tengas anuncios, merece la pena revisar en Search Console qué modelos
reciben impresiones: esos son los que conviene reforzar con contenido propio
(guía de compra del modelo, fallos típicos, consumos reales).
