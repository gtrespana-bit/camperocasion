# Valorador y avisos de renovación

Dos piezas que atacan el mismo problema desde lados opuestos: traer vendedores
nuevos (valorador) y hacer que los que ya están gasten créditos (avisos).

## 1. Valorador — `/cuanto-vale-mi-camper`

Es el mejor imán de vendedores que existe en este sector: quien busca cuánto
vale su camper está, por definición, a punto de venderla. La página termina en
un CTA a `/publicar`.

### Cómo calcula (y por qué nunca inventa)

Tres fuentes, por orden de fiabilidad:

1. **Mercado real** — mediana de los anuncios de ese modelo en la propia base
   de datos, ajustada por antigüedad (~4 %/año, tope ±35 %).
2. **Depreciación oficial** — sobre el precio de nuevo, con el coeficiente de
   Hacienda que ya usábamos para el ITP.
3. **Nada** — si no hay ni lo uno ni lo otro, se dice que no hay datos.

**Con menos de 5 anuncios activos del modelo no se da cifra.** Una estimación
sacada de dos anuncios es ruido, y un vendedor que se fía de una cifra mala y
publica 8.000 € por encima del mercado no vende, culpa al portal y se va.

Ajustes aplicados sobre la base, todos visibles para el usuario en el desglose:

| Ajuste | Regla |
|---|---|
| Kilometraje | Referencia 12.000 km/año, corrección acotada a ±20 % |
| Estado | excelente 1.08 · bueno 1.00 · correcto 0.92 · mejorable 0.80 |
| Horquilla | ±12 % alrededor del valor estimado |

Los factores de estado son deliberadamente **conservadores al alza**: todo
vendedor cree que su vehículo está excelente, así que premiarlo mucho inflaría
sistemáticamente las tasaciones. Hay un test que blinda esa asimetría.

La `confianza` que se muestra es alta (≥15 anuncios), media (mercado) o baja
(depreciación).

### Verificado

| Caso | Resultado |
|---|---|
| Página `/cuanto-vale-mi-camper` | 200, con JSON-LD `FAQPage` |
| Modelo inexistente | 400 «Modelo no reconocido» |
| Año 1850 | 400 |
| Km negativos | 400 |
| Sin mercado ni precio de nuevo | 200 sin cifra |
| Con precio de nuevo | 200, vía depreciación, confianza baja |
| Con 5 anuncios de mercado | 200, vía mercado |

Rate limit: 30 consultas/hora por IP. El endpoint es público a propósito (pedir
registro antes de dar el dato mataría el imán).

## 2. Avisos de renovación — `/api/cron/avisos-renovacion`

Diario a las 10:20 UTC. Avisa al vendedor cuando su anuncio ha perdido
visibilidad y puede arreglarlo con 1 crédito.

Dos motivos: **boost caducado** (con 1 día de gracia tras los 7) y **anuncio
hundido** (14 días publicado sin haber usado boost nunca).

### Las reglas existen para no quemar la lista

| Regla | Motivo |
|---|---|
| Nunca a vendidos, inactivos o demo | No hay nada que promocionar |
| Nunca si el boost sigue vigente | El anuncio ya está arriba |
| Nunca con menos de 10 visitas | Sin demanda el problema es el precio o las fotos, no la posición: venderle un boost sería estafarle |
| Nunca dos veces en 14 días | Un aviso repetido es spam |
| Máximo 1 aviso por vendedor y pasada | Se elige su anuncio con más visitas |

La regla de las 10 visitas es la importante: es la diferencia entre un aviso
útil y una tienda de humo. 18 tests cubren estos casos.

Si la migración `202609220003` aún no está aplicada, el cron responde
`{ok:true, reason:'migracion-pendiente'}` en vez de petar a diario.

## 3. Comparación de visitas en el panel

En «Mis anuncios», cada anuncio activo se compara con la media del propio
vendedor y solo se comenta cuando la diferencia supera el ±25 % (por debajo es
ruido estadístico). «12 vistas» no dice nada; «un 60 % menos que tus otros
anuncios» sí, y es lo que hace clicar en promocionar.

## Pendiente

Aplicar `supabase/migrations/202609220003_avisos_vendedor.sql` en Supabase (ya
está anexada al final de `setup-camperocasion.sql`) y añadir `CRON_SECRET` si
no estuviera. Validada contra PostgreSQL real; es idempotente.
